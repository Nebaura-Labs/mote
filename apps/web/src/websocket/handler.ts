import type { IncomingMessage } from "http";
import type { Duplex } from "stream";

import { WebSocketServer, WebSocket } from "ws";
import { auth } from "@mote/auth";
import { db, session } from "@mote/db";
import { eq } from "drizzle-orm";
import { SSHTunnelManager } from "./ssh-tunnel-manager";

/**
 * Active WebSocket connections mapped by user ID
 * One connection per user - new connections disconnect old ones
 */
const activeConnections = new Map<string, WebSocket>();

/**
 * SSH tunnel managers mapped by user ID
 */
const tunnelManagers = new Map<string, SSHTunnelManager>();

/**
 * WebSocket server instance
 */
const wss = new WebSocketServer({ noServer: true });

/**
 * Handle HTTP upgrade request to establish WebSocket connection
 */
export async function handleWebSocketUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer
) {
  try {
    // Parse URL to get token from query parameter
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    console.log(`[websocket] Connection attempt - Token present: ${!!token}`);
    if (token) {
      console.log(`[websocket] Token length: ${token.length}, First 10 chars: ${token.substring(0, 10)}...`);
    }

    let userId: string;

    if (token) {
      // Authenticate via token (for React Native)
      // Validate token directly against database
      const sessionRecord = await db.query.session.findFirst({
        where: eq(session.token, token),
        with: {
          user: true,
        },
      });

      console.log(`[websocket] Session found in DB: ${!!sessionRecord}`);

      if (!sessionRecord || !sessionRecord.user) {
        console.error("[websocket] Invalid or expired session token");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      // Check if session is expired
      if (sessionRecord.expiresAt < new Date()) {
        console.error("[websocket] Session expired");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      userId = sessionRecord.userId;
      console.log(`[websocket] Authenticated user ${userId} via token`);
    } else {
      // Authenticate via session cookie (for web browsers)
      const authSession = await auth.api.getSession({
        headers: req.headers as any,
      });

      if (!authSession?.user) {
        console.error("[websocket] Unauthorized connection attempt");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      userId = authSession.user.id;
      console.log(`[websocket] Authenticated user ${userId} via cookie`);
    }

    // Upgrade to WebSocket
    wss.handleUpgrade(req, socket, head, (ws) => {
      console.log(`[websocket] User ${userId} connected`);

      // Disconnect old connection if exists (one device per user)
      const existingConnection = activeConnections.get(userId);
      if (existingConnection && existingConnection.readyState === WebSocket.OPEN) {
        console.log(`[websocket] Disconnecting old connection for user ${userId}`);
        existingConnection.close(1000, "New connection established");

        // Clean up old tunnel
        const existingTunnel = tunnelManagers.get(userId);
        if (existingTunnel) {
          existingTunnel.disconnect();
          tunnelManagers.delete(userId);
        }
      }

      // Store new connection
      activeConnections.set(userId, ws);

      // Create SSH tunnel manager for this user
      const tunnelManager = new SSHTunnelManager(userId, ws);
      tunnelManagers.set(userId, tunnelManager);

      // Connect to gateway
      tunnelManager.connect().catch((error) => {
        console.error(`[websocket] Failed to connect tunnel for user ${userId}:`, error);
        ws.close(1011, `Tunnel connection failed: ${error.message}`);
      });

      // Handle incoming messages from mobile app
      ws.on("message", (data: Buffer) => {
        try {
          const message = data.toString("utf-8");
          tunnelManager.sendToGateway(message);
        } catch (error) {
          console.error(`[websocket] Error handling message from user ${userId}:`, error);
        }
      });

      // Handle WebSocket close
      ws.on("close", () => {
        console.log(`[websocket] User ${userId} disconnected`);
        activeConnections.delete(userId);

        const manager = tunnelManagers.get(userId);
        if (manager) {
          manager.disconnect();
          tunnelManagers.delete(userId);
        }
      });

      // Handle WebSocket errors
      ws.on("error", (error) => {
        console.error(`[websocket] Error for user ${userId}:`, error);
      });
    });
  } catch (error) {
    console.error("[websocket] Error during upgrade:", error);
    socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    socket.destroy();
  }
}

/**
 * Get active connection for a user (for debugging/monitoring)
 */
export function getActiveConnection(userId: string): WebSocket | undefined {
  return activeConnections.get(userId);
}

/**
 * Get all active user IDs (for debugging/monitoring)
 */
export function getActiveUserIds(): string[] {
  return Array.from(activeConnections.keys());
}
