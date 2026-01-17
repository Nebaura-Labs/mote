/**
 * Node Bridge Client
 * Connects to clawd.bot's node bridge TCP server to appear as a "connected" node
 * and receive node.invoke commands from clawd
 */

import net from "net";
import { Client } from "ssh2";

/**
 * Bridge protocol frame types
 */
interface BridgeHelloFrame {
  type: "hello";
  nodeId: string;
  token: string;
  displayName?: string;
  platform?: string;
  version?: string;
  deviceFamily?: string;
  caps?: string[];
  commands?: string[];
}

interface BridgeHelloOkFrame {
  type: "hello-ok";
  serverName: string;
}

interface BridgeInvokeFrame {
  type: "invoke";
  id: string;
  command: string;
  paramsJSON?: string | null;
}

interface BridgeInvokeResponseFrame {
  type: "invoke-res";
  id: string;
  ok: boolean;
  payloadJSON?: string | null;
  error?: { code: string; message: string } | null;
}

interface BridgePingFrame {
  type: "ping";
  id: string;
}

interface BridgePongFrame {
  type: "pong";
  id: string;
}

interface BridgeErrorFrame {
  type: "error";
  code: string;
  message: string;
}

type BridgeFrame =
  | BridgeHelloFrame
  | BridgeHelloOkFrame
  | BridgeInvokeFrame
  | BridgeInvokeResponseFrame
  | BridgePingFrame
  | BridgePongFrame
  | BridgeErrorFrame;

/**
 * Handler for incoming invoke commands from clawd
 */
export type BridgeInvokeHandler = (
  command: string,
  params: Record<string, unknown>
) => Promise<{ ok: boolean; payload?: unknown; error?: string }>;

/**
 * Mote node commands that can be invoked by clawd
 */
export const MOTE_NODE_COMMANDS = [
  "iot.http",      // Make HTTP request to local device
  "iot.discover",  // mDNS/SSDP discovery
  "wifi.scan",     // Scan WiFi networks
] as const;

export interface BridgeClientConfig {
  nodeId: string;
  nodeToken: string;
  sshHost: string;
  sshPort: number;
  sshUsername: string;
  sshPrivateKey: string;
  bridgePort?: number; // Default 18790
}

/**
 * Bridge client that connects to clawd.bot's node bridge
 */
export class BridgeClient {
  private config: BridgeClientConfig;
  private sshClient: Client | null = null;
  private socket: net.Socket | null = null;
  private isConnected = false;
  private buffer = "";
  private invokeHandler: BridgeInvokeHandler | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(config: BridgeClientConfig) {
    this.config = {
      ...config,
      bridgePort: config.bridgePort || 18790,
    };
  }

  /**
   * Set handler for incoming invoke commands
   */
  setInvokeHandler(handler: BridgeInvokeHandler): void {
    this.invokeHandler = handler;
  }

  /**
   * Connect to the bridge via SSH tunnel
   */
  async connect(): Promise<void> {
    console.log(`[bridge-client] Connecting to bridge via SSH tunnel...`);

    return new Promise((resolve, reject) => {
      this.sshClient = new Client();

      this.sshClient.on("ready", () => {
        console.log(`[bridge-client] SSH connection established`);

        // Forward to bridge port
        this.sshClient!.forwardOut(
          "127.0.0.1",
          0,
          "127.0.0.1",
          this.config.bridgePort!,
          (err, stream) => {
            if (err) {
              console.error(`[bridge-client] Port forwarding failed:`, err);
              reject(err);
              return;
            }

            console.log(`[bridge-client] SSH tunnel to bridge port ${this.config.bridgePort}`);

            // Use the stream as our socket
            this.socket = stream as unknown as net.Socket;
            this.setupSocketHandlers(resolve, reject);
          }
        );
      });

      this.sshClient.on("error", (err) => {
        console.error(`[bridge-client] SSH error:`, err);
        reject(err);
      });

      this.sshClient.on("close", () => {
        console.log(`[bridge-client] SSH connection closed`);
        this.handleDisconnect();
      });

      this.sshClient.connect({
        host: this.config.sshHost,
        port: this.config.sshPort,
        username: this.config.sshUsername,
        privateKey: this.config.sshPrivateKey,
        readyTimeout: 10000,
      });
    });
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketHandlers(
    resolveConnect: () => void,
    rejectConnect: (err: Error) => void
  ): void {
    if (!this.socket) return;

    let authenticated = false;

    this.socket.on("data", (data: Buffer) => {
      this.buffer += data.toString();

      // Process complete lines (newline-delimited JSON)
      let newlineIndex: number;
      while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.substring(0, newlineIndex);
        this.buffer = this.buffer.substring(newlineIndex + 1);

        if (line.trim()) {
          try {
            const frame = JSON.parse(line) as BridgeFrame;

            if (frame.type === "hello-ok") {
              console.log(`[bridge-client] Authenticated with bridge: ${(frame as BridgeHelloOkFrame).serverName}`);
              authenticated = true;
              this.isConnected = true;
              this.reconnectAttempts = 0;
              this.startPing();
              resolveConnect();
            } else if (frame.type === "error") {
              const errFrame = frame as BridgeErrorFrame;
              console.error(`[bridge-client] Bridge error: ${errFrame.code} - ${errFrame.message}`);
              if (!authenticated) {
                rejectConnect(new Error(`Bridge auth failed: ${errFrame.message}`));
              }
            } else if (frame.type === "invoke") {
              this.handleInvoke(frame as BridgeInvokeFrame);
            } else if (frame.type === "ping") {
              this.sendFrame({ type: "pong", id: (frame as BridgePingFrame).id });
            }
          } catch (err) {
            console.error(`[bridge-client] Failed to parse frame:`, line, err);
          }
        }
      }
    });

    this.socket.on("error", (err) => {
      console.error(`[bridge-client] Socket error:`, err);
      if (!authenticated) {
        rejectConnect(err);
      }
    });

    this.socket.on("close", () => {
      console.log(`[bridge-client] Socket closed`);
      this.handleDisconnect();
    });

    // Send hello frame
    this.sendHello();
  }

  /**
   * Send hello frame to authenticate with bridge
   */
  private sendHello(): void {
    const hello: BridgeHelloFrame = {
      type: "hello",
      nodeId: this.config.nodeId,
      token: this.config.nodeToken,
      displayName: "Mote",
      platform: "esp32",
      version: "1.0.0",
      deviceFamily: "mote",
      caps: ["iot"],
      commands: [...MOTE_NODE_COMMANDS],
    };

    console.log(`[bridge-client] Sending hello for node: ${this.config.nodeId}`);
    this.sendFrame(hello);
  }

  /**
   * Handle incoming invoke command from clawd
   */
  private async handleInvoke(frame: BridgeInvokeFrame): Promise<void> {
    console.log(`[bridge-client] Received invoke: ${frame.command}`);

    if (!this.invokeHandler) {
      this.sendFrame({
        type: "invoke-res",
        id: frame.id,
        ok: false,
        error: { code: "NO_HANDLER", message: "No invoke handler configured" },
      });
      return;
    }

    try {
      const params = frame.paramsJSON ? JSON.parse(frame.paramsJSON) : {};
      const result = await this.invokeHandler(frame.command, params);

      this.sendFrame({
        type: "invoke-res",
        id: frame.id,
        ok: result.ok,
        payloadJSON: result.payload ? JSON.stringify(result.payload) : null,
        error: result.error ? { code: "ERROR", message: result.error } : null,
      });
    } catch (err) {
      console.error(`[bridge-client] Invoke handler error:`, err);
      this.sendFrame({
        type: "invoke-res",
        id: frame.id,
        ok: false,
        error: { code: "INTERNAL_ERROR", message: String(err) },
      });
    }
  }

  /**
   * Send a frame to the bridge
   */
  private sendFrame(frame: BridgeFrame): void {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(JSON.stringify(frame) + "\n");
    }
  }

  /**
   * Start periodic ping to keep connection alive
   */
  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendFrame({ type: "ping", id: `ping-${Date.now()}` });
      }
    }, 30000);
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Handle disconnect and attempt reconnect
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.stopPing();

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      console.log(`[bridge-client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        this.connect().catch((err) => {
          console.error(`[bridge-client] Reconnect failed:`, err);
        });
      }, delay);
    }
  }

  /**
   * Check if connected to bridge
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from bridge
   */
  disconnect(): void {
    console.log(`[bridge-client] Disconnecting...`);
    this.isConnected = false;
    this.stopPing();
    this.socket?.destroy();
    this.sshClient?.end();
  }
}
