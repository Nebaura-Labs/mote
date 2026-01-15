/**
 * Bridge Client
 *
 * Manages TCP connection to clawd.bot Bridge protocol.
 * Handles message sending/receiving, pairing, and ping/pong keepalive.
 */

import TcpSocket from 'react-native-tcp-socket';
import { v4 as uuidv4 } from 'uuid';
import {
  BridgeMessage,
  BRIDGE_PORT,
  PING_INTERVAL_MS,
  createHelloMessage,
  createPairRequestMessage,
  createPongMessage,
  serializeBridgeMessage,
} from './bridge-protocol';
import { JSONLinesParser } from './json-lines-parser';
import type { Socket } from 'react-native-tcp-socket';

export type BridgeClientStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'paired'
  | 'error';

export interface BridgeClientError {
  code: string;
  message: string;
  details?: unknown;
}

export interface BridgeClientConfig {
  localPort: number; // Local port from SSH tunnel
  deviceId: string;
  pairingToken?: string; // If already paired
}

export class BridgeClient {
  private socket: Socket | null = null;
  private parser = new JSONLinesParser();
  private status: BridgeClientStatus = 'disconnected';
  private config: BridgeClientConfig | null = null;

  private serverId: string | null = null;
  private pairingToken: string | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPongTime: number = 0;

  // Event listeners
  private statusListeners: Set<(status: BridgeClientStatus) => void> = new Set();
  private errorListeners: Set<(error: BridgeClientError) => void> = new Set();
  private messageListeners: Set<(message: BridgeMessage) => void> = new Set();
  private pairedListeners: Set<(serverId: string, token: string) => void> = new Set();

  /**
   * Connect to Bridge server at localhost:localPort
   */
  async connect(config: BridgeClientConfig): Promise<void> {
    if (this.status === 'connecting' || this.status === 'connected' || this.status === 'paired') {
      throw new Error('Bridge client already connected or connecting');
    }

    this.config = config;
    this.pairingToken = config.pairingToken || null;
    this.updateStatus('connecting');

    try {
      // Create TCP socket connection to local port (from SSH tunnel)
      this.socket = TcpSocket.createConnection(
        {
          host: '127.0.0.1',
          port: config.localPort,
        },
        () => {
          console.log(`[BridgeClient] Connected to localhost:${config.localPort}`);
          this.onConnected();
        }
      );

      // Set up socket event handlers
      this.socket.on('data', (data) => {
        this.onData(data);
      });

      this.socket.on('error', (error) => {
        this.onSocketError(error);
      });

      this.socket.on('close', () => {
        this.onSocketClose();
      });

    } catch (error) {
      const bridgeError: BridgeClientError = {
        code: 'BRIDGE_CONNECTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown connection error',
        details: error,
      };

      this.updateStatus('error');
      this.notifyError(bridgeError);

      throw bridgeError;
    }
  }

  /**
   * Disconnect from Bridge server
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected') {
      return;
    }

    try {
      // Stop ping interval
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Close socket
      if (this.socket) {
        this.socket.destroy();
        this.socket = null;
      }

      // Reset state
      this.parser = new JSONLinesParser();
      this.serverId = null;
      this.config = null;
      this.updateStatus('disconnected');

      console.log('[BridgeClient] Disconnected');
    } catch (error) {
      console.error('[BridgeClient] Error during disconnect:', error);

      // Force disconnected state
      this.socket = null;
      this.parser = new JSONLinesParser();
      this.serverId = null;
      this.config = null;
      this.updateStatus('disconnected');
    }
  }

  /**
   * Send a message to the Bridge server
   */
  async sendMessage(message: BridgeMessage): Promise<void> {
    if (!this.socket) {
      throw new Error('Bridge client not connected');
    }

    const serialized = serializeBridgeMessage(message);
    this.socket.write(serialized);

    console.log('[BridgeClient] Sent:', message.type, message.id);
  }

  /**
   * Get current client status
   */
  getStatus(): BridgeClientStatus {
    return this.status;
  }

  /**
   * Get server ID (only available after hello)
   */
  getServerId(): string | null {
    return this.serverId;
  }

  /**
   * Get pairing token (only available after pairing)
   */
  getPairingToken(): string | null {
    return this.pairingToken;
  }

  /**
   * Check if client is paired
   */
  isPaired(): boolean {
    return this.status === 'paired';
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(listener: (status: BridgeClientStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Subscribe to errors
   */
  onError(listener: (error: BridgeClientError) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Subscribe to all incoming messages
   */
  onMessage(listener: (message: BridgeMessage) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  /**
   * Subscribe to pairing completion
   */
  onPaired(listener: (serverId: string, token: string) => void): () => void {
    this.pairedListeners.add(listener);
    return () => this.pairedListeners.delete(listener);
  }

  /**
   * Handle successful socket connection (private)
   */
  private async onConnected(): Promise<void> {
    this.updateStatus('connected');

    // Send hello message
    const hello = createHelloMessage({
      deviceId: this.config!.deviceId,
      platform: 'react-native',
      version: '1.0.0',
    });

    await this.sendMessage(hello);

    // Start ping interval
    this.startPingInterval();
  }

  /**
   * Handle incoming data (private)
   */
  private onData(data: Buffer): void {
    // Parse JSON Lines
    const messages = this.parser.feed(data.toString('utf8'));

    for (const message of messages) {
      this.handleMessage(message);
    }
  }

  /**
   * Handle socket error (private)
   */
  private onSocketError(error: Error): void {
    console.error('[BridgeClient] Socket error:', error);

    const bridgeError: BridgeClientError = {
      code: 'SOCKET_ERROR',
      message: error.message,
      details: error,
    };

    this.updateStatus('error');
    this.notifyError(bridgeError);
  }

  /**
   * Handle socket close (private)
   */
  private onSocketClose(): void {
    console.log('[BridgeClient] Socket closed');

    // Stop ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Only update status if not already disconnected
    if (this.status !== 'disconnected') {
      this.updateStatus('disconnected');
    }
  }

  /**
   * Handle incoming Bridge message (private)
   */
  private async handleMessage(message: BridgeMessage): Promise<void> {
    console.log('[BridgeClient] Received:', message.type, message.id);

    // Notify message listeners
    this.notifyMessage(message);

    // Handle specific message types
    switch (message.type) {
      case 'helloOk':
        await this.handleHelloOk(message);
        break;

      case 'pairOk':
        await this.handlePairOk(message);
        break;

      case 'ping':
        await this.handlePing(message);
        break;

      case 'pong':
        this.handlePong(message);
        break;

      case 'error':
        this.handleError(message);
        break;

      default:
        // Other message types handled by listeners
        break;
    }
  }

  /**
   * Handle helloOk message (private)
   */
  private async handleHelloOk(message: BridgeMessage & { type: 'helloOk' }): Promise<void> {
    this.serverId = message.serverId;
    console.log('[BridgeClient] Server ID:', this.serverId);

    // If we have a pairing token, we're already paired
    if (this.pairingToken) {
      this.updateStatus('paired');
      return;
    }

    // Otherwise, send pair request (automatic approval mode)
    const pairRequest = createPairRequestMessage({
      deviceName: 'Mote Device',
      capabilities: ['voice', 'audio'],
    });

    await this.sendMessage(pairRequest);
  }

  /**
   * Handle pairOk message (private)
   */
  private async handlePairOk(message: BridgeMessage & { type: 'pairOk' }): Promise<void> {
    this.pairingToken = message.token;
    this.updateStatus('paired');

    console.log('[BridgeClient] Paired with token:', this.pairingToken);

    // Notify paired listeners
    this.notifyPaired(this.serverId!, this.pairingToken);
  }

  /**
   * Handle ping message (private)
   */
  private async handlePing(message: BridgeMessage & { type: 'ping' }): Promise<void> {
    // Respond with pong
    const pong = createPongMessage(message.id);
    await this.sendMessage(pong);
  }

  /**
   * Handle pong message (private)
   */
  private handlePong(_message: BridgeMessage & { type: 'pong' }): void {
    this.lastPongTime = Date.now();
  }

  /**
   * Handle error message (private)
   */
  private handleError(message: BridgeMessage & { type: 'error' }): void {
    const bridgeError: BridgeClientError = {
      code: message.code || 'UNKNOWN_ERROR',
      message: message.message || 'Unknown Bridge error',
      details: message,
    };

    this.notifyError(bridgeError);
  }

  /**
   * Start ping interval (private)
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.lastPongTime = Date.now();

    this.pingInterval = setInterval(async () => {
      if (!this.socket) {
        return;
      }

      // Check if we've received a pong recently
      const timeSinceLastPong = Date.now() - this.lastPongTime;
      if (timeSinceLastPong > PING_INTERVAL_MS * 2) {
        console.warn('[BridgeClient] No pong received, connection may be dead');

        const error: BridgeClientError = {
          code: 'PING_TIMEOUT',
          message: 'No pong received from server',
        };

        this.notifyError(error);
        return;
      }

      // Send ping
      const ping = createHelloMessage({ deviceId: this.config!.deviceId });
      ping.type = 'ping' as any; // Type hack for ping
      await this.sendMessage(ping as any);

    }, PING_INTERVAL_MS);
  }

  /**
   * Update status and notify listeners (private)
   */
  private updateStatus(status: BridgeClientStatus): void {
    this.status = status;
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('[BridgeClient] Error in status listener:', error);
      }
    });
  }

  /**
   * Notify error listeners (private)
   */
  private notifyError(error: BridgeClientError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('[BridgeClient] Error in error listener:', err);
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
        console.error('[BridgeClient] Error in message listener:', error);
      }
    });
  }

  /**
   * Notify paired listeners (private)
   */
  private notifyPaired(serverId: string, token: string): void {
    this.pairedListeners.forEach(listener => {
      try {
        listener(serverId, token);
      } catch (error) {
        console.error('[BridgeClient] Error in paired listener:', error);
      }
    });
  }
}

/**
 * Create a new Bridge client instance
 */
export function createBridgeClient(): BridgeClient {
  return new BridgeClient();
}
