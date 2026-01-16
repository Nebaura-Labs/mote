/**
 * Mote WebSocket Client
 *
 * Manages WebSocket communication with the Mote hardware device.
 * Connects to the device's Access Point at ws://192.168.4.1:3000/config
 * to configure WiFi credentials and Gateway server settings.
 */

import type {
  MoteMessage,
  MoteConfigMessage,
  MoteStatusMessage,
} from './mote-protocol';

/**
 * WebSocket client for communicating with Mote hardware device
 *
 * Usage:
 * ```typescript
 * const client = new MoteWebSocketClient();
 * await client.connect();
 * client.onMessage((msg) => console.log('Received:', msg));
 * client.sendConfig({
 *   wifiSsid: 'HomeNetwork',
 *   wifiPassword: 'password123',
 *   websocketServer: 'wss://gateway.example.com',
 *   websocketPort: 3000
 * });
 * ```
 */
export class MoteWebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers: ((msg: MoteMessage) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000; // ms

  /**
   * Connect to the Mote device's WebSocket server
   *
   * @returns Promise that resolves when connection is established
   * @throws Error if connection fails after max retry attempts
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[MoteWS] Connecting to ws://192.168.4.1:3000/config...');
        this.ws = new WebSocket('ws://192.168.4.1:3000/config');

        this.ws.onopen = () => {
          console.log('[MoteWS] Connected to Mote device');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('[MoteWS] Connection error:', error);
          reject(new Error('Failed to connect to Mote device. Make sure you are connected to the "Mote" WiFi network.'));
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as MoteMessage;
            console.log('[MoteWS] Received:', message);
            this.messageHandlers.forEach(handler => handler(message));
          } catch (error) {
            console.error('[MoteWS] Failed to parse message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[MoteWS] Disconnected from Mote', event.code, event.reason);

          // Attempt to reconnect if not a clean close and under retry limit
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[MoteWS] Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => {
              this.connect().catch(err => {
                console.error('[MoteWS] Reconnect failed:', err);
              });
            }, this.reconnectDelay);
          }
        };
      } catch (error) {
        console.error('[MoteWS] Connection setup error:', error);
        reject(error);
      }
    });
  }

  /**
   * Send configuration message to Mote device
   *
   * @param config WiFi and Gateway server configuration
   * @throws Error if WebSocket is not connected
   */
  sendConfig(config: Omit<MoteConfigMessage, 'type'>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected. Call connect() first.');
    }

    const message: MoteConfigMessage = {
      type: 'config',
      ...config,
    };

    console.log('[MoteWS] Sending config:', message);
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Request current device status
   *
   * Note: The Mote device automatically sends status on connect,
   * but this method can be used to request an updated status.
   *
   * @throws Error if WebSocket is not connected
   */
  requestStatus(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected. Call connect() first.');
    }

    // Send a ping to trigger status update
    const pingMessage = { type: 'ping' };
    console.log('[MoteWS] Requesting status...');
    this.ws.send(JSON.stringify(pingMessage));
  }

  /**
   * Register a message handler
   *
   * @param handler Callback function to handle received messages
   * @returns Cleanup function to unregister the handler
   */
  onMessage(handler: (msg: MoteMessage) => void): () => void {
    this.messageHandlers.push(handler);

    // Return cleanup function
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Disconnect from the Mote device
   */
  disconnect(): void {
    if (this.ws) {
      console.log('[MoteWS] Closing connection...');
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }

  /**
   * Check if WebSocket is currently connected
   */
  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current connection state
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}
