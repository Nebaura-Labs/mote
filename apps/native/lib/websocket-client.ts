/**
 * WebSocket client for connecting to the web server's SSH proxy
 * Replaces native SSH tunnel with server-side tunneling
 */

export type WebSocketStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WebSocketClientConfig {
  url: string;
  onMessage: (message: string) => void;
  onStatusChange: (status: WebSocketStatus) => void;
  onError?: (error: Error) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketClientConfig;
  private status: WebSocketStatus = "disconnected";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private sessionToken: string | null = null;

  constructor(config: WebSocketClientConfig) {
    this.config = config;
  }

  /**
   * Set session token for authentication
   * Must be called before connect()
   */
  setSessionToken(token: string | null): void {
    this.sessionToken = token;
    console.log(`[websocket-client] Session token ${token ? `set (${token.length} chars, starts with ${token.substring(0, 10)}...)` : "cleared"}`);
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws && this.status === "connected") {
      console.log("[websocket-client] Already connected");
      return;
    }

    this.updateStatus("connecting");

    try {
      // Verify we have a session token
      if (!this.sessionToken) {
        throw new Error("No session token set. Please login first and call setSessionToken().");
      }

      // Add token to WebSocket URL as query parameter
      const wsUrl = `${this.config.url}?token=${encodeURIComponent(this.sessionToken)}`;
      console.log(`[websocket-client] Connecting to ${this.config.url} with auth token`);

      // Create WebSocket connection
      this.ws = new WebSocket(wsUrl);

      // Connection opened
      this.ws.onopen = () => {
        console.log("[websocket-client] Connected");
        this.updateStatus("connected");
        this.reconnectAttempts = 0;
      };

      // Received message from server
      this.ws.onmessage = (event) => {
        try {
          const message = event.data as string;
          this.config.onMessage(message);
        } catch (error) {
          console.error("[websocket-client] Error handling message:", error);
        }
      };

      // Connection closed
      this.ws.onclose = (event) => {
        console.log(`[websocket-client] Disconnected: ${event.code} - ${event.reason}`);
        this.updateStatus("disconnected");
        this.ws = null;

        // Don't reconnect for configuration errors (1011 = server error)
        // or authentication failures (401)
        const isConfigError = event.code === 1011 ||
                              event.code === 1008 ||
                              event.reason?.includes("configuration") ||
                              event.reason?.includes("Unauthorized") ||
                              event.reason?.includes("failed");

        if (isConfigError) {
          console.log("[websocket-client] Configuration/auth error - not reconnecting");
          this.reconnectAttempts = this.maxReconnectAttempts; // Disable reconnects
          this.updateStatus("error");
          if (this.config.onError) {
            this.config.onError(new Error(event.reason || "Configuration error"));
          }
          return;
        }

        // Attempt reconnection with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 60000); // Max 60s
          console.log(`[websocket-client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

          this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, delay);
        } else {
          console.error("[websocket-client] Max reconnection attempts reached");
          this.updateStatus("error");
          if (this.config.onError) {
            this.config.onError(new Error("Max reconnection attempts reached"));
          }
        }
      };

      // Connection error
      this.ws.onerror = (event) => {
        console.error("[websocket-client] WebSocket error:", event);
        this.updateStatus("error");

        if (this.config.onError) {
          this.config.onError(new Error("WebSocket connection error"));
        }
      };

    } catch (error) {
      console.error("[websocket-client] Failed to create WebSocket:", error);
      this.updateStatus("error");
      throw error;
    }
  }

  /**
   * Send message to server (and through to gateway)
   */
  send(message: string): void {
    if (!this.ws || this.status !== "connected") {
      console.warn("[websocket-client] Cannot send - not connected");
      throw new Error("WebSocket not connected");
    }

    this.ws.send(message);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log("[websocket-client] Disconnecting");

    // Clear reconnection timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Reset reconnection attempts
    this.reconnectAttempts = this.maxReconnectAttempts;

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.updateStatus("disconnected");
  }

  /**
   * Get current connection status
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === "connected";
  }

  /**
   * Update status and notify listeners
   */
  private updateStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.config.onStatusChange(status);
    }
  }
}

/**
 * Create WebSocket URL from server URL
 * Converts http://localhost:3001 to ws://localhost:3001/api/ws
 */
export function createWebSocketUrl(serverUrl: string): string {
  const url = new URL(serverUrl);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}/api/ws`;
}
