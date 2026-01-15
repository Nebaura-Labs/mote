import type { WebSocket } from "ws";
import type { Client as SSHClient, ClientChannel } from "ssh2";

import { Client } from "ssh2";
import { db, gatewayConnection, decrypt } from "@mote/db";
import { eq } from "drizzle-orm";

/**
 * Bridge protocol port on the gateway
 */
const BRIDGE_PORT = 18790;

/**
 * SSH Tunnel Manager
 * Manages SSH connection and bidirectional data proxying between WebSocket and Gateway
 */
export class SSHTunnelManager {
  private userId: string;
  private ws: WebSocket;
  private sshClient: SSHClient | null = null;
  private gatewaySocket: NodeJS.Socket | null = null;
  private isConnected = false;

  constructor(userId: string, ws: WebSocket) {
    this.userId = userId;
    this.ws = ws;
  }

  /**
   * Establish SSH connection and port forwarding to gateway
   */
  async connect(): Promise<void> {
    // Fetch and decrypt SSH configuration from database
    const config = await this.getConfig();
    if (!config) {
      throw new Error("No gateway configuration found for user");
    }

    console.log(`[ssh-tunnel] Connecting to ${config.sshHost}:${config.sshPort} for user ${this.userId}`);

    return new Promise((resolve, reject) => {
      this.sshClient = new Client();

      // SSH connection ready
      this.sshClient.on("ready", () => {
        console.log(`[ssh-tunnel] SSH connection established for user ${this.userId}`);

        // Set up port forwarding to gateway
        this.sshClient!.forwardOut(
          "127.0.0.1", // source host (local)
          0, // source port (any)
          "127.0.0.1", // destination host (gateway on remote)
          BRIDGE_PORT, // destination port
          (err, stream) => {
            if (err) {
              console.error(`[ssh-tunnel] Port forwarding failed for user ${this.userId}:`, err);
              this.updateConnectionStatus(false);
              reject(err);
              return;
            }

            console.log(`[ssh-tunnel] Port forwarding established to localhost:${BRIDGE_PORT} for user ${this.userId}`);
            this.gatewaySocket = stream as any;
            this.isConnected = true;

            // Update database connection status
            this.updateConnectionStatus(true);

            // Set up bidirectional data proxying
            this.setupProxying();

            resolve();
          }
        );
      });

      // SSH connection error
      this.sshClient.on("error", (err) => {
        console.error(`[ssh-tunnel] SSH error for user ${this.userId}:`, err);
        this.updateConnectionStatus(false);
        reject(err);
      });

      // SSH connection closed
      this.sshClient.on("close", () => {
        console.log(`[ssh-tunnel] SSH connection closed for user ${this.userId}`);
        this.isConnected = false;
        this.updateConnectionStatus(false);

        // Notify mobile app
        if (this.ws.readyState === 1) {
          this.ws.close(1011, "SSH connection closed");
        }
      });

      // Connect to SSH server with private key authentication
      this.sshClient.connect({
        host: config.sshHost,
        port: config.sshPort,
        username: config.sshUsername,
        privateKey: config.sshPrivateKey,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
      });
    });
  }

  /**
   * Set up bidirectional data proxying between WebSocket and Gateway socket
   */
  private setupProxying(): void {
    if (!this.gatewaySocket) {
      console.error(`[ssh-tunnel] No gateway socket available for user ${this.userId}`);
      return;
    }

    // Gateway → WebSocket (mobile app)
    this.gatewaySocket.on("data", (data: Buffer) => {
      if (this.ws.readyState === 1) {
        // WebSocket.OPEN
        this.ws.send(data.toString("utf-8"));
      }
    });

    // Gateway socket closed
    this.gatewaySocket.on("close", () => {
      console.log(`[ssh-tunnel] Gateway socket closed for user ${this.userId}`);
      if (this.ws.readyState === 1) {
        this.ws.close(1011, "Gateway connection closed");
      }
    });

    // Gateway socket error
    this.gatewaySocket.on("error", (err) => {
      console.error(`[ssh-tunnel] Gateway socket error for user ${this.userId}:`, err);
      if (this.ws.readyState === 1) {
        this.ws.close(1011, `Gateway error: ${err.message}`);
      }
    });
  }

  /**
   * Send message from mobile app to gateway
   * Called by WebSocket handler when mobile app sends data
   */
  sendToGateway(message: string): void {
    if (!this.gatewaySocket || !this.isConnected) {
      console.warn(`[ssh-tunnel] Cannot send to gateway - not connected (user ${this.userId})`);
      return;
    }

    this.gatewaySocket.write(message);
  }

  /**
   * Disconnect SSH tunnel and clean up
   */
  disconnect(): void {
    console.log(`[ssh-tunnel] Disconnecting tunnel for user ${this.userId}`);

    if (this.gatewaySocket) {
      this.gatewaySocket.destroy();
      this.gatewaySocket = null;
    }

    if (this.sshClient) {
      this.sshClient.end();
      this.sshClient = null;
    }

    this.isConnected = false;
    this.updateConnectionStatus(false);
  }

  /**
   * Get decrypted SSH configuration for user from database
   */
  private async getConfig() {
    const config = await db.query.gatewayConnection.findFirst({
      where: eq(gatewayConnection.userId, this.userId),
    });

    if (!config) {
      return null;
    }

    // Decrypt private key
    const privateKey = decrypt(config.sshPrivateKeyEncrypted);

    return {
      sshHost: config.sshHost,
      sshPort: config.sshPort,
      sshUsername: config.sshUsername,
      sshPrivateKey: privateKey,
      projectRoot: config.projectRoot,
      cliPath: config.cliPath,
    };
  }

  /**
   * Update connection status in database
   */
  private async updateConnectionStatus(isActive: boolean): Promise<void> {
    try {
      await db
        .update(gatewayConnection)
        .set({
          isActive,
          lastConnectedAt: isActive ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(gatewayConnection.userId, this.userId));
    } catch (error) {
      console.error(`[ssh-tunnel] Failed to update connection status for user ${this.userId}:`, error);
    }
  }
}
