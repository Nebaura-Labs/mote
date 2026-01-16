/**
 * Bridge Context
 *
 * React context for app-wide Bridge connection state.
 * Provides access to connection manager and connection status.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  BridgeConnectionManager,
  createBridgeConnectionManager,
  ConnectionStatus,
  ConnectionError,
} from '../lib/bridge-connection-manager';
import type { BridgeMessage } from '../lib/bridge-protocol';
import { isBridgeConfigured, isBridgePaired } from '../utils/bridge-storage';
import { useAuth } from './auth-context';

// ============================================================================
// Types
// ============================================================================

export interface BridgeContextValue {
  // Connection state
  status: ConnectionStatus;
  isConfigured: boolean;
  isPaired: boolean;
  error: ConnectionError | null;

  // Connection actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (message: BridgeMessage) => Promise<void>;

  // Message subscription
  onMessage: (listener: (message: BridgeMessage) => void) => () => void;

  // Refresh configuration status
  refreshConfigStatus: () => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const BridgeContext = createContext<BridgeContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface BridgeProviderProps {
  children: React.ReactNode;
  deviceId?: string;
  autoReconnect?: boolean;
}

// Singleton connection manager to prevent multiple instances
let singletonConnectionManager: BridgeConnectionManager | null = null;
let singletonDeviceId: string | null = null;

function getConnectionManager(deviceId: string, autoReconnect: boolean): BridgeConnectionManager {
  if (!singletonConnectionManager || singletonDeviceId !== deviceId) {
    console.log('[BridgeContext] Creating new connection manager singleton');
    singletonDeviceId = deviceId;
    singletonConnectionManager = createBridgeConnectionManager({
      deviceId,
      autoReconnect,
    });
  } else {
    console.log('[BridgeContext] Reusing existing connection manager singleton');
  }
  return singletonConnectionManager;
}

export function BridgeProvider({
  children,
  deviceId: providedDeviceId,
  autoReconnect = true,
}: BridgeProviderProps) {
  // Get auth context to access session token
  const { session } = useAuth();

  // Generate or use provided device ID (stable across re-renders)
  const deviceId = useRef(providedDeviceId || uuidv4()).current;

  // Get singleton connection manager
  const connectionManager = getConnectionManager(deviceId, autoReconnect);

  // State
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isPaired, setIsPaired] = useState(false);
  const [error, setError] = useState<ConnectionError | null>(null);

  /**
   * Check configuration status
   */
  const refreshConfigStatus = useCallback(async () => {
    const [configured, paired] = await Promise.all([
      isBridgeConfigured(),
      isBridgePaired(),
    ]);

    setIsConfigured(configured);
    setIsPaired(paired);
  }, []);

  /**
   * Connect to Gateway
   */
  const connect = useCallback(async () => {
    try {
      setError(null);
      await connectionManager.connect();
    } catch (err) {
      console.error('[BridgeContext] Connection failed:', err);
      // Error is already handled by connection manager error listener
    }
  }, [connectionManager]);

  /**
   * Disconnect from Gateway
   */
  const disconnect = useCallback(async () => {
    try {
      setError(null);
      await connectionManager.disconnect();
    } catch (err) {
      console.error('[BridgeContext] Disconnect failed:', err);
    }
  }, [connectionManager]);

  /**
   * Send message to Gateway
   */
  const sendMessage = useCallback(
    async (message: BridgeMessage) => {
      try {
        await connectionManager.sendMessage(message);
      } catch (err) {
        console.error('[BridgeContext] Send message failed:', err);
        throw err;
      }
    },
    [connectionManager]
  );

  /**
   * Subscribe to incoming messages
   */
  const onMessage = useCallback(
    (listener: (message: BridgeMessage) => void) => {
      return connectionManager.onMessage(listener);
    },
    [connectionManager]
  );

  /**
   * Set up connection manager event listeners
   */
  useEffect(() => {
    // Status change listener
    const unsubscribeStatus = connectionManager.onStatusChange((newStatus) => {
      setStatus(newStatus);

      // Clear error when successfully connected
      if (newStatus === 'connected' || newStatus === 'paired') {
        setError(null);
      }
    });

    // Error listener
    const unsubscribeError = connectionManager.onError((newError) => {
      setError(newError);
    });

    // Initial status
    setStatus(connectionManager.getStatus());

    return () => {
      unsubscribeStatus();
      unsubscribeError();
    };
  }, [connectionManager]);

  /**
   * Load initial configuration status
   */
  useEffect(() => {
    refreshConfigStatus();
  }, [refreshConfigStatus]);

  /**
   * Update session token when it changes
   */
  useEffect(() => {
    // Get session token from Better Auth session
    const token = session?.session?.token || session?.token || null;
    console.log('[BridgeContext] Session token', token ? `available (${token.length} chars)` : 'not available');
    connectionManager.setSessionToken(token);
  }, [session, connectionManager]);

  /**
   * Auto-connect to Gateway when session is available
   */
  const hasAttemptedAutoConnect = useRef(false);
  const autoConnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const token = session?.session?.token || session?.token || null;
    const currentStatus = connectionManager.getStatus();
    const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL;

    // Reset flag if session is cleared
    if (!token) {
      hasAttemptedAutoConnect.current = false;
      return;
    }

    // Only auto-connect once per session if:
    // 1. We have a session token
    // 2. We have a server URL configured
    // 3. We're currently disconnected
    // 4. We haven't already attempted auto-connect
    // 5. No timer is already pending
    if (token && serverUrl && currentStatus === 'disconnected' && !hasAttemptedAutoConnect.current && !autoConnectTimerRef.current) {
      hasAttemptedAutoConnect.current = true;
      console.log('[BridgeContext] Auto-connecting to Gateway in 2s...');

      // Small delay to ensure everything is initialized
      autoConnectTimerRef.current = setTimeout(() => {
        autoConnectTimerRef.current = null;
        console.log('[BridgeContext] Executing auto-connect...');
        connect().catch((err) => {
          console.log('[BridgeContext] Auto-connect failed, will retry via autoReconnect:', err);
        });
      }, 2000);
    }
  }, [session, connect, connectionManager]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoConnectTimerRef.current) {
        clearTimeout(autoConnectTimerRef.current);
        autoConnectTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      connectionManager.disconnect();
    };
  }, [connectionManager]);

  // Context value
  const value: BridgeContextValue = {
    status,
    isConfigured,
    isPaired,
    error,
    connect,
    disconnect,
    sendMessage,
    onMessage,
    refreshConfigStatus,
  };

  return (
    <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Use Bridge context
 * @throws Error if used outside of BridgeProvider
 */
export function useBridge(): BridgeContextValue {
  const context = useContext(BridgeContext);

  if (!context) {
    throw new Error('useBridge must be used within a BridgeProvider');
  }

  return context;
}

// ============================================================================
// Status Helpers
// ============================================================================

/**
 * Check if status indicates an active connection
 */
export function isConnectedStatus(status: ConnectionStatus): boolean {
  return status === 'connected' || status === 'paired';
}

/**
 * Check if status indicates connection in progress
 */
export function isConnectingStatus(status: ConnectionStatus): boolean {
  return status === 'connecting' || status === 'reconnecting';
}

/**
 * Get human-readable status message
 */
export function getStatusMessage(status: ConnectionStatus): string {
  switch (status) {
    case 'disconnected':
      return 'Disconnected';
    case 'connecting':
      return 'Connecting...';
    case 'connected':
      return 'Connected';
    case 'paired':
      return 'Connected and paired';
    case 'reconnecting':
      return 'Reconnecting...';
    case 'error':
      return 'Connection error';
    default:
      return 'Unknown status';
  }
}
