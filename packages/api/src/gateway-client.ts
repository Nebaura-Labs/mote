/**
 * Gateway WebSocket Client
 * Implements the Bridge Protocol for communicating with clawd.bot Gateway
 */

import WebSocket from "ws";
import type { IncomingMessage } from "http";
import { Client } from "ssh2";
import { db, gatewayConnection, decrypt } from "@mote/db";
import { eq } from "drizzle-orm";

interface BridgeRequest {
  type: "req";
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface BridgeResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

interface BridgeEvent {
  type: "event";
  event: string;
  payload: unknown;
}

type BridgeMessage = BridgeRequest | BridgeResponse | BridgeEvent;

/**
 * Handler for incoming node.invoke requests
 */
export type NodeInvokeHandler = (
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

/**
 * Gateway client for a specific user
 */
export class GatewayClient {
  private userId: string;
  private ws: WebSocket | null = null;
  private sshClient: Client | null = null;
  private token: string;
  private gatewayUrl: string;
  private isConnected = false;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private eventHandlers = new Map<string, Set<(payload: unknown) => void>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private pongReceived = true;

  // Mote node properties
  private nodeId: string;
  private nodeInvokeHandler: NodeInvokeHandler | null = null;
  private isNodeRegistered = false;

  constructor(userId: string, token: string, gatewayUrl: string) {
    this.userId = userId;
    this.token = token;
    this.gatewayUrl = gatewayUrl;
    // Generate unique node ID based on user ID
    this.nodeId = `mote-${userId.substring(0, 8)}`;
  }

  /**
   * Set handler for incoming node.invoke requests from clawd
   */
  setNodeInvokeHandler(handler: NodeInvokeHandler): void {
    this.nodeInvokeHandler = handler;
  }

  /**
   * Get the node ID for this Mote instance
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Connect to Gateway via SSH tunnel
   */
  async connect(): Promise<void> {
    // Check if we need SSH tunnel (localhost) or direct connection
    const url = new URL(this.gatewayUrl);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";

    if (isLocalhost) {
      await this.connectViaSSHTunnel();
    } else {
      await this.connectDirect();
    }
  }

  /**
   * Connect directly to Gateway (no SSH tunnel)
   */
  private async connectDirect(): Promise<void> {
    const url = new URL(this.gatewayUrl);
    const wsUrl = `ws://${url.host}`;

    console.log(`[gateway-client] Connecting to ${wsUrl} for user ${this.userId}`);

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on("open", async () => {
        console.log(`[gateway-client] WebSocket connected for user ${this.userId}`);
        try {
          await this.authenticate();
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.setupMessageHandler();
          this.startKeepalive();
          // Register as Mote node after connecting
          await this.registerNode();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.ws.on("error", (error) => {
        console.error(`[gateway-client] WebSocket error for user ${this.userId}:`, error);
        reject(error);
      });

      this.ws.on("close", () => {
        console.log(`[gateway-client] WebSocket closed for user ${this.userId}`);
        this.isConnected = false;
        this.isNodeRegistered = false;
        this.handleDisconnect();
      });
    });
  }

  /**
   * Connect to Gateway via SSH tunnel
   */
  private async connectViaSSHTunnel(): Promise<void> {
    // Get SSH config
    const config = await this.getSSHConfig();
    if (!config) {
      throw new Error("No SSH configuration found");
    }

    console.log(`[gateway-client] Creating SSH tunnel to ${config.sshHost}:${config.sshPort} for user ${this.userId}`);

    return new Promise((resolve, reject) => {
      this.sshClient = new Client();

      this.sshClient.on("ready", () => {
        console.log(`[gateway-client] SSH connection established for user ${this.userId}`);

        // Extract port from gatewayUrl
        const url = new URL(this.gatewayUrl);
        const gatewayPort = parseInt(url.port || "18789");

        // Forward to Gateway control plane
        this.sshClient!.forwardOut(
          "127.0.0.1",
          0,
          "127.0.0.1",
          gatewayPort,
          (err, stream) => {
            if (err) {
              console.error(`[gateway-client] Port forwarding failed for user ${this.userId}:`, err);
              reject(err);
              return;
            }

            console.log(`[gateway-client] SSH tunnel established to localhost:${gatewayPort} for user ${this.userId}`);

            // Create WebSocket over SSH tunnel
            this.ws = new WebSocket(`ws://dummy`, {
              createConnection: () => stream as any,
            });

            this.ws.on("open", async () => {
              console.log(`[gateway-client] WebSocket connected via SSH tunnel for user ${this.userId}`);
              try {
                await this.authenticate();
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.setupMessageHandler();
                this.startKeepalive();
                // Register as Mote node after connecting
                await this.registerNode();
                resolve();
              } catch (error) {
                reject(error);
              }
            });

            this.ws.on("error", (error) => {
              console.error(`[gateway-client] WebSocket error for user ${this.userId}:`, error);
              this.isConnected = false;
              this.isNodeRegistered = false;
            });

            this.ws.on("close", () => {
              console.log(`[gateway-client] WebSocket closed for user ${this.userId}`);
              this.isConnected = false;
              this.isNodeRegistered = false;
              this.handleDisconnect();
            });
          }
        );
      });

      this.sshClient.on("error", (err) => {
        console.error(`[gateway-client] SSH error for user ${this.userId}:`, err);
        reject(err);
      });

      this.sshClient.connect({
        host: config.sshHost,
        port: config.sshPort,
        username: config.sshUsername,
        privateKey: config.sshPrivateKey,
        readyTimeout: 10000,
      });
    });
  }

  /**
   * Send hello frame to authenticate with Gateway
   */
  private async authenticate(): Promise<void> {
    const helloFrame = {
      type: "req" as const,
      id: this.generateId(),
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "gateway-client",
          mode: "backend",
          version: "1.0.0",
          platform: "node",
        },
        caps: ["chat"],
        auth: {
          token: this.token,
        },
      },
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Authentication timeout"));
      }, 10000);

      const handler = (data: Buffer) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString()) as BridgeResponse;
          console.log(`[gateway-client] Received auth response:`, JSON.stringify(response, null, 2));
          if (response.type === "res" && response.id === helloFrame.id) {
            this.ws?.off("message", handler);
            if (response.ok) {
              console.log(`[gateway-client] Authenticated for user ${this.userId}`);
              resolve();
            } else {
              reject(new Error(`Authentication failed: ${JSON.stringify(response.error || response)}`));
            }
          }
        } catch (error) {
          console.error(`[gateway-client] Failed to parse auth response:`, data.toString(), error);
        }
      };

      this.ws?.on("message", handler);
      console.log(`[gateway-client] Sending auth frame:`, JSON.stringify(helloFrame, null, 2));
      this.send(helloFrame);
    });
  }

  /**
   * Register this client as a Mote node with the Gateway
   * This allows clawd to invoke IoT commands on the ESP32
   */
  async registerNode(): Promise<void> {
    if (this.isNodeRegistered) {
      console.log(`[gateway-client] Node already registered: ${this.nodeId}`);
      return;
    }

    console.log(`[gateway-client] Registering Mote node: ${this.nodeId}`);

    try {
      const result = await this.request("node.pair.request", {
        nodeId: this.nodeId,
        displayName: "Mote",
        platform: "esp32",
        version: "1.0.0",
        deviceFamily: "mote",
        caps: ["iot"],
        commands: [...MOTE_NODE_COMMANDS],
        silent: true, // Don't require manual approval for Mote
      });

      console.log(`[gateway-client] Node registration result:`, result);
      this.isNodeRegistered = true;
    } catch (error) {
      console.error(`[gateway-client] Failed to register node:`, error);
      // Don't throw - node registration is optional, voice still works
    }
  }

  /**
   * Send a response to an incoming request
   */
  private sendResponse(id: string, ok: boolean, payload?: unknown, error?: string): void {
    const response: BridgeResponse = {
      type: "res",
      id,
      ok,
      payload,
      error,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response) + "\n");
    }
  }

  /**
   * Handle incoming node.invoke request from Gateway
   */
  private async handleNodeInvoke(requestId: string, params: Record<string, unknown>): Promise<void> {
    const command = params.command as string;
    const invokeParams = (params.params as Record<string, unknown>) || {};

    console.log(`[gateway-client] Received node.invoke: command=${command}, params=`, invokeParams);

    if (!this.nodeInvokeHandler) {
      console.warn(`[gateway-client] No node invoke handler set, rejecting command: ${command}`);
      this.sendResponse(requestId, false, undefined, "No handler configured");
      return;
    }

    try {
      const result = await this.nodeInvokeHandler(command, invokeParams);
      this.sendResponse(requestId, result.ok, result.payload, result.error);
    } catch (error) {
      console.error(`[gateway-client] Error handling node.invoke:`, error);
      this.sendResponse(requestId, false, undefined, String(error));
    }
  }

  /**
   * Set up message handler for incoming messages
   */
  private setupMessageHandler(): void {
    this.ws?.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as BridgeMessage;

        if (message.type === "req") {
          // Incoming request from Gateway (e.g., node.invoke from clawd)
          console.log(`[gateway-client] Received request: method=${message.method}`);

          if (message.method === "node.invoke") {
            // Handle node invoke asynchronously
            this.handleNodeInvoke(message.id, message.params).catch((err: unknown) => {
              console.error(`[gateway-client] Error in handleNodeInvoke:`, err);
            });
          } else {
            // Unknown method - respond with error
            console.warn(`[gateway-client] Unknown incoming method: ${message.method}`);
            this.sendResponse(message.id, false, undefined, `Unknown method: ${message.method}`);
          }
        } else if (message.type === "res") {
          // Response to a request we sent
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            this.pendingRequests.delete(message.id);
            if (message.ok) {
              pending.resolve(message.payload);
            } else {
              const errorMsg = typeof message.error === 'string'
                ? message.error
                : JSON.stringify(message.error) || "Request failed";
              console.error(`[gateway-client] Request failed:`, message.error);
              pending.reject(new Error(errorMsg));
            }
          }
        } else if (message.type === "event") {
          // Event notification
          console.log(`[gateway-client] Raw event received - type: ${message.event}, payload.runId: ${(message.payload as any)?.runId}, seq: ${(message.payload as any)?.seq}`);
          const handlers = this.eventHandlers.get(message.event);
          if (handlers) {
            handlers.forEach((handler) => handler(message.payload));
          }
        }
      } catch (error) {
        console.error(`[gateway-client] Failed to parse message for user ${this.userId}:`, error);
      }
    });

    // Handle pong frames
    this.ws?.on("pong", () => {
      this.pongReceived = true;
    });
  }

  /**
   * Start keepalive pings to prevent connection timeout
   */
  private startKeepalive(): void {
    // Stop any existing keepalive
    this.stopKeepalive();

    // Send ping every 30 seconds
    this.pingInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      // Check if pong was received for last ping
      if (!this.pongReceived) {
        console.warn(`[gateway-client] No pong received for user ${this.userId}, connection may be dead`);
        this.stopKeepalive();
        this.ws?.terminate();
        return;
      }

      // Send ping
      this.pongReceived = false;
      this.ws.ping();
    }, 30000);
  }

  /**
   * Stop keepalive pings
   */
  private stopKeepalive(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Send a request to Gateway and wait for response
   */
  async request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.isConnected || !this.ws) {
      throw new Error("Gateway client not connected");
    }

    const id = this.generateId();
    const request: BridgeRequest = {
      type: "req",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error("Request timeout"));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.send(request);
    });
  }

  /**
   * Send chat message
   */
  async sendChatMessage(params: {
    sessionKey: string;
    message: string;
    idempotencyKey: string;
  }): Promise<{ runId: string; status: string }> {
    const response = await this.request("chat.send", params);
    return response as { runId: string; status: string };
  }

  /**
   * Send chat message and wait for complete response
   */
  async sendChatMessageAndWait(params: {
    sessionKey: string;
    message: string;
    idempotencyKey: string;
  }): Promise<{ runId: string; content: string; status: string }> {
    // Send the message
    const { runId } = await this.sendChatMessage(params);

    // Wait for the response via events
    return new Promise((resolve, reject) => {
      let responseContent = "";
      let isComplete = false;
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Response timeout"));
      }, 60000); // 60 second timeout

      const handler = (payload: any) => {
        try {
          // Filter events for this runId
          if (payload.runId !== runId) {
            return;
          }

          console.log(`[gateway-client] Received event seq ${payload.seq}:`, JSON.stringify(payload, null, 2));

          // Handle different event states
          if (payload.state === "delta" && payload.message?.content) {
            // Accumulate text deltas from content array
            for (const item of payload.message.content) {
              if (item.type === "text" && item.text) {
                console.log(`[gateway-client] Adding delta text: ${item.text}`);
                responseContent += item.text;
              }
            }
          } else if (payload.state === "final") {
            // Response complete - use the final event's complete text
            let finalContent = "";

            console.log(`[gateway-client] Final event payload keys:`, Object.keys(payload));
            console.log(`[gateway-client] Final event full payload:`, JSON.stringify(payload, null, 2));

            // Extract complete text from final event
            if (payload.message?.content) {
              for (const item of payload.message.content) {
                if (item.type === "text" && item.text) {
                  finalContent = item.text;
                  console.log(`[gateway-client] Using complete text from final event (${finalContent.length} chars)`);
                  break; // Use first text item
                }
              }
            }

            // Fallback to accumulated deltas if final event has no text
            if (!finalContent && responseContent) {
              console.log(`[gateway-client] No text in final event, using accumulated deltas (${responseContent.length} chars)`);
              finalContent = responseContent;
            }

            if (!finalContent) {
              console.log(`[gateway-client] WARNING: No response text received from Gateway (no deltas, no final message)`);
              finalContent = "I received your question but didn't generate a response. Please try again.";
            }

            console.log(`[gateway-client] Chat response completed, content: ${finalContent.substring(0, 100)}...`);
            isComplete = true;
            cleanup();
            clearTimeout(timeout);
            resolve({
              runId,
              content: finalContent || "No response",
              status: "completed",
            });
          } else if (payload.state === "error" || payload.status === "failed") {
            console.log(`[gateway-client] Chat response failed:`, payload.error);
            cleanup();
            clearTimeout(timeout);
            reject(new Error(payload.error || "Chat failed"));
          }
        } catch (error) {
          console.error("[gateway-client] Error handling chat event:", error);
        }
      };

      const cleanup = () => {
        this.offChatEvent(handler);
      };

      // Subscribe to chat events
      console.log(`[gateway-client] Subscribing to chat events for runId: ${runId}`);
      this.onChatEvent(handler);
    });
  }

  /**
   * Get chat history
   */
  async getChatHistory(sessionKey: string, limit = 200): Promise<unknown> {
    return this.request("chat.history", { sessionKey, limit });
  }

  /**
   * Subscribe to chat events for a session
   */
  onChatEvent(handler: (payload: unknown) => void): void {
    if (!this.eventHandlers.has("chat")) {
      this.eventHandlers.set("chat", new Set());
    }
    this.eventHandlers.get("chat")!.add(handler);
  }

  /**
   * Unsubscribe from chat events
   */
  offChatEvent(handler: (payload: unknown) => void): void {
    this.eventHandlers.get("chat")?.delete(handler);
  }

  /**
   * Send message to Gateway
   */
  private send(message: BridgeRequest): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message) + "\n");
    }
  }

  /**
   * Handle disconnect and attempt reconnect
   */
  private handleDisconnect(): void {
    // Reject all pending requests
    this.pendingRequests.forEach((pending) => {
      pending.reject(new Error("Gateway disconnected"));
    });
    this.pendingRequests.clear();

    // Attempt reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`[gateway-client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error(`[gateway-client] Reconnect failed for user ${this.userId}:`, error);
        });
      }, delay);
    }
  }

  /**
   * Check if connected
   */
  isClientConnected(): boolean {
    return this.isConnected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect from Gateway
   */
  disconnect(): void {
    console.log(`[gateway-client] Disconnecting for user ${this.userId}`);
    this.isConnected = false;
    this.stopKeepalive();
    this.ws?.close();
    this.sshClient?.end();
  }

  /**
   * Get SSH configuration from database
   */
  private async getSSHConfig() {
    const config = await db.query.gatewayConnection.findFirst({
      where: eq(gatewayConnection.userId, this.userId),
    });

    if (!config) {
      return null;
    }

    return {
      sshHost: config.sshHost,
      sshPort: config.sshPort,
      sshUsername: config.sshUsername,
      sshPrivateKey: decrypt(config.sshPrivateKeyEncrypted),
    };
  }

  /**
   * Generate unique ID for requests
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Gateway client pool - one client per user
 */
class GatewayClientPool {
  private clients = new Map<string, GatewayClient>();

  async getClient(userId: string, token: string, gatewayUrl: string): Promise<GatewayClient> {
    let client = this.clients.get(userId);

    // Check if client exists and is actually connected
    if (!client || !client.isClientConnected()) {
      console.log(`[gateway-client-pool] Creating new connection for user ${userId}`);

      // Clean up old client if exists
      if (client) {
        try {
          client.disconnect();
        } catch (err) {
          console.error(`[gateway-client-pool] Failed to disconnect old client:`, err);
        }
      }

      client = new GatewayClient(userId, token, gatewayUrl);
      this.clients.set(userId, client);
      await client.connect();
    } else {
      console.log(`[gateway-client-pool] Reusing existing connection for user ${userId}`);
    }

    return client;
  }

  removeClient(userId: string): void {
    const client = this.clients.get(userId);
    if (client) {
      client.disconnect();
      this.clients.delete(userId);
    }
  }
}

export const gatewayClientPool = new GatewayClientPool();
