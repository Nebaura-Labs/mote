/**
 * Bridge Connection Manager
 *
 * Orchestrates WebSocket connection and Bridge client with automatic reconnection.
 * Implements exponential backoff strategy for resilient connections.
 */

import { v4 as uuidv4 } from 'uuid';
import { WebSocketClient, createWebSocketUrl, WebSocketStatus } from './websocket-client';
import { BridgeClient, BridgeClientConfig, BridgeClientError } from './bridge-client';
import type { BridgeMessage } from './bridge-protocol';
import { JSONLinesParser } from './json-lines-parser';
import {
  getPairingToken,
  getServerId,
  saveServerId,
  savePairingToken,
} from '../utils/bridge-storage';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'paired'
  | 'reconnecting'
  | 'error';

export interface ConnectionError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ConnectionManagerConfig {
  deviceId: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

const DEFAULT_RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 32000]; // Exponential backoff in ms
const MAX_RECONNECT_DELAY = 60000; // 1 minute max

export class BridgeConnectionManager {
  private deviceId: string;
  private autoReconnect: boolean;
  private maxReconnectAttempts: number;
  private sessionToken: string | null = null;

  private wsClient: WebSocketClient | null = null;
  private bridgeClient: BridgeClient;
  private jsonParser: JSONLinesParser;

  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Event listeners
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private errorListeners: Set<(error: ConnectionError) => void> = new Set();
  private messageListeners: Set<(message: BridgeMessage) => void> = new Set();

  constructor(config: ConnectionManagerConfig) {
    this.deviceId = config.deviceId;
    this.autoReconnect = config.autoReconnect ?? true;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;

    this.bridgeClient = new BridgeClient();
    this.jsonParser = new JSONLinesParser();

    this.setupBridgeClientEventHandlers();
  }

  /**
   * Set session token for authentication
   * Must be called before connect()
   */
  setSessionToken(token: string | null): void {
    this.sessionToken = token;
    console.log('[ConnectionManager] Session token', token ? 'updated' : 'cleared');
  }

  /**
   * Connect to clawd.bot Gateway via WebSocket proxy
   */
  async connect(): Promise<void> {
    if (this.status === 'connecting' || this.status === 'connected' || this.status === 'paired') {
      console.warn('[ConnectionManager] Already connected or connecting');
      return;
    }

    this.updateStatus('connecting');

    try {
      // Get server URL from environment
      const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL;
      if (!serverUrl) {
        throw new Error('EXPO_PUBLIC_SERVER_URL not configured');
      }

      // Create WebSocket URL
      const wsUrl = createWebSocketUrl(serverUrl);
      console.log('[ConnectionManager] Connecting to WebSocket:', wsUrl);

      // Create and configure WebSocket client
      this.wsClient = new WebSocketClient({
        url: wsUrl,
        onMessage: (message: string) => {
          // Parse incoming JSON Lines messages
          this.jsonParser.parse(message, (line: string) => {
            try {
              const bridgeMessage = JSON.parse(line) as BridgeMessage;
              this.notifyMessage(bridgeMessage);
            } catch (error) {
              console.error('[ConnectionManager] Failed to parse Bridge message:', error);
            }
          });
        },
        onStatusChange: (status: WebSocketStatus) => {
          console.log('[ConnectionManager] WebSocket status:', status);

          // Map WebSocket status to connection status
          switch (status) {
            case 'connected':
              this.handleWebSocketConnected();
              break;
            case 'disconnected':
              if (this.status !== 'disconnected' && this.autoReconnect) {
                this.scheduleReconnect();
              }
              break;
            case 'error':
              this.updateStatus('error');
              if (this.autoReconnect) {
                this.scheduleReconnect();
              }
              break;
          }
        },
        onError: (error: Error) => {
          const connectionError: ConnectionError = {
            code: 'WEBSOCKET_ERROR',
            message: error.message,
            details: error,
          };
          this.notifyError(connectionError);
        },
      });

      // Set session token for authentication
      if (this.sessionToken) {
        this.wsClient.setSessionToken(this.sessionToken);
      } else {
        throw new Error('No session token set. Please call setSessionToken() before connect().');
      }

      // Connect to WebSocket
      await this.wsClient.connect();

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

    } catch (error) {
      const connectionError: ConnectionError = {
        code: 'CONNECTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown connection error',
        details: error,
      };

      this.updateStatus('error');
      this.notifyError(connectionError);

      // Attempt reconnect if enabled
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }

      throw connectionError;
    }
  }

  /**
   * Handle WebSocket connected event and send hello message
   */
  private async handleWebSocketConnected(): Promise<void> {
    this.updateStatus('connected');
    console.log('[ConnectionManager] WebSocket connected, sending hello');

    try {
      // Load pairing token if exists
      const pairingToken = await getPairingToken();

      // Send hello message to initiate Bridge protocol handshake
      const helloMessage: BridgeMessage = {
        type: 'hello',
        deviceId: this.deviceId,
        protocolVersion: '1.0',
        pairingToken: pairingToken || undefined,
      };

      this.sendRawMessage(JSON.stringify(helloMessage));

    } catch (error) {
      console.error('[ConnectionManager] Failed to send hello message:', error);
      this.updateStatus('error');
    }
  }

  /**
   * Disconnect from Gateway
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected') {
      return;
    }

    // Cancel any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      // Disconnect WebSocket
      if (this.wsClient) {
        this.wsClient.disconnect();
        this.wsClient = null;
      }

      this.updateStatus('disconnected');
      console.log('[ConnectionManager] Disconnected');

    } catch (error) {
      console.error('[ConnectionManager] Error during disconnect:', error);

      // Force disconnected state
      this.updateStatus('disconnected');
    }
  }

  /**
   * Send a message to the Gateway
   */
  async sendMessage(message: BridgeMessage): Promise<void> {
    if (this.status !== 'paired') {
      throw new Error('Not paired. Cannot send message.');
    }

    this.sendRawMessage(JSON.stringify(message));
  }

  /**
   * Send raw message through WebSocket
   */
  private sendRawMessage(message: string): void {
    if (!this.wsClient || !this.wsClient.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    this.wsClient.send(message + '\n'); // Add newline for JSON Lines format
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if currently connected and paired
   */
  isConnected(): boolean {
    return this.status === 'paired';
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Subscribe to errors
   */
  onError(listener: (error: ConnectionError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Subscribe to incoming messages
   */
  onMessage(listener: (message: BridgeMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  /**
   * Set up event handlers for Bridge protocol messages (private)
   */
  private setupBridgeClientEventHandlers(): void {
    // Handle incoming Bridge protocol messages
    this.onMessage(async (message: BridgeMessage) => {
      console.log('[ConnectionManager] Received message:', message.type);

      switch (message.type) {
        case 'helloOk':
          console.log('[ConnectionManager] Hello acknowledged by gateway');
          // If we have a pairing token and it's accepted, we're paired
          if (message.pairingAccepted) {
            this.updateStatus('paired');
          } else {
            this.updateStatus('connected');
          }
          break;

        case 'pairOk':
          console.log('[ConnectionManager] Pairing successful!');
          this.updateStatus('paired');

          // Save pairing info to secure storage
          if (message.serverId && message.pairingToken) {
            try {
              await saveServerId(message.serverId);
              await savePairingToken(message.pairingToken);
              console.log('[ConnectionManager] Pairing info saved to secure storage');
            } catch (error) {
              console.error('[ConnectionManager] Failed to save pairing info:', error);
            }
          }
          break;

        case 'error':
          console.error('[ConnectionManager] Gateway error:', message.message);
          const connectionError: ConnectionError = {
            code: message.code || 'GATEWAY_ERROR',
            message: message.message || 'Unknown gateway error',
          };
          this.notifyError(connectionError);
          break;

        case 'pong':
          // Handle ping/pong for keep-alive
          console.log('[ConnectionManager] Received pong from gateway');
          break;

        default:
          // Forward other messages to listeners
          break;
      }
    });
  }

  /**
   * Schedule reconnection with exponential backoff (private)
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[ConnectionManager] Max reconnect attempts reached');

      const error: ConnectionError = {
        code: 'MAX_RECONNECT_ATTEMPTS',
        message: `Failed to reconnect after ${this.maxReconnectAttempts} attempts`,
      };

      this.updateStatus('error');
      this.notifyError(error);
      return;
    }

    // Cancel any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Calculate delay with exponential backoff
    const delay = this.getReconnectDelay();

    console.log(
      `[ConnectionManager] Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`
    );

    this.updateStatus('reconnecting');

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      console.log(`[ConnectionManager] Reconnect attempt ${this.reconnectAttempts}`);

      try {
        await this.connect();
      } catch (error) {
        console.error('[ConnectionManager] Reconnect failed:', error);
        // connect() will schedule another reconnect if autoReconnect is enabled
      }
    }, delay);
  }

  /**
   * Get reconnect delay with exponential backoff (private)
   */
  private getReconnectDelay(): number {
    if (this.reconnectAttempts < DEFAULT_RECONNECT_DELAYS.length) {
      return DEFAULT_RECONNECT_DELAYS[this.reconnectAttempts];
    }

    // Use max delay for attempts beyond the predefined list
    return MAX_RECONNECT_DELAY;
  }

  /**
   * Update status and notify listeners (private)
   */
  private updateStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('[ConnectionManager] Error in status listener:', error);
      }
    });
  }

  /**
   * Notify error listeners (private)
   */
  private notifyError(error: ConnectionError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('[ConnectionManager] Error in error listener:', err);
      }
    });
  }

  /**
   * Notify message listeners (private)
   */
  private notifyMessage(message: BridgeMessage): void {
    this.messageListeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('[ConnectionManager] Error in message listener:', error);
      }
    });
  }
}

/**
 * Create a new Bridge connection manager instance
 */
export function createBridgeConnectionManager(
  config: ConnectionManagerConfig
): BridgeConnectionManager {
  return new BridgeConnectionManager(config);
}
