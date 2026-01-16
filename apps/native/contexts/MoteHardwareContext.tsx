/**
 * Mote Hardware Context
 *
 * Provides state management for Mote hardware device connection and configuration.
 * Uses Bluetooth Low Energy (BLE) for stable device communication.
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { MoteBleClient } from '../lib/mote-ble-client';
import type { MoteStatusMessage } from '../lib/mote-protocol';
import type { Device } from 'react-native-ble-plx';

interface MoteHardwareContextType {
  // Connection state
  isConnected: boolean;
  isScanning: boolean;
  isConnecting: boolean;
  connectionError: string | null;

  // Device information
  deviceStatus: MoteStatusMessage | null;
  discoveredDevices: Device[];

  // Actions
  scanForDevices: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: () => void;
  sendConfig: (config: {
    wifiSsid: string;
    wifiPassword: string;
    websocketServer: string;
    websocketPort: number;
    gatewayToken: string;
  }) => Promise<void>;
  clearError: () => void;
}

const MoteHardwareContext = createContext<MoteHardwareContextType | null>(null);

const DEVICE_STATUS_KEY = 'mote_device_status';
const LAST_DEVICE_ID_KEY = 'mote_last_device_id';

// Auto-reconnect settings
const AUTO_RECONNECT_DELAY = 3000; // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

// Singleton BLE client to prevent multiple instances
let singletonBleClient: MoteBleClient | null = null;
let bleClientInitialized = false;

function getBleClient(): MoteBleClient {
  if (!singletonBleClient) {
    console.log('[MoteHardware] Creating BLE client singleton');
    singletonBleClient = new MoteBleClient();
  } else {
    console.log('[MoteHardware] Reusing existing BLE client singleton');
  }
  return singletonBleClient;
}

/**
 * Mote Hardware Provider
 *
 * Manages BLE connection to Mote device and handles device status updates.
 * Automatically reconnects to the last known device on startup and after disconnection.
 *
 * Usage:
 * ```tsx
 * <MoteHardwareProvider>
 *   <App />
 * </MoteHardwareProvider>
 * ```
 */
export function MoteHardwareProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<MoteStatusMessage | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDeviceIdRef = useRef<string | null>(null);
  const isManualDisconnectRef = useRef(false);

  // Get singleton BLE client
  const bleClient = getBleClient();

  /**
   * Attempt to reconnect to last known device
   */
  const attemptReconnect = async (deviceId: string) => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[MoteHardware] Max reconnect attempts reached');
      reconnectAttemptsRef.current = 0;
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`[MoteHardware] Auto-reconnect attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS} to ${deviceId}`);

    setIsConnecting(true);
    setConnectionError(null);

    try {
      await bleClient.connect(deviceId);
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      console.log('[MoteHardware] Auto-reconnect successful');
    } catch (error) {
      console.log('[MoteHardware] Auto-reconnect failed, will retry...');
      setIsConnected(false);

      // Schedule next reconnect attempt
      reconnectTimerRef.current = setTimeout(() => {
        attemptReconnect(deviceId);
      }, AUTO_RECONNECT_DELAY * reconnectAttemptsRef.current); // Exponential backoff
    } finally {
      setIsConnecting(false);
    }
  };

  // Initialize BLE client on mount (only once globally)
  useEffect(() => {
    // Only initialize once using module-level flag
    if (bleClientInitialized) {
      console.log('[MoteHardware] BLE already initialized globally, skipping');
      return;
    }
    bleClientInitialized = true;
    console.log('[MoteHardware] Initializing BLE...');

    // Request BLE permissions and auto-connect
    const initBLE = async () => {
      try {
        const granted = await bleClient.requestPermissions();
        if (!granted) {
          setConnectionError('Bluetooth permissions not granted');
          console.error('[MoteHardware] Bluetooth permissions denied');
          return;
        }

        console.log('[MoteHardware] Bluetooth permissions granted');

        // Try to auto-connect to last known device
        const lastDeviceId = await SecureStore.getItemAsync(LAST_DEVICE_ID_KEY);
        console.log('[MoteHardware] Last device ID from storage:', lastDeviceId || 'none');

        if (lastDeviceId) {
          lastDeviceIdRef.current = lastDeviceId;
          console.log('[MoteHardware] Auto-connecting to last device in 1.5s:', lastDeviceId);
          // Small delay to let the app fully initialize
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            attemptReconnect(lastDeviceId);
          }, 1500);
        }
      } catch (error) {
        console.error('[MoteHardware] Failed to request permissions:', error);
      }
    };

    initBLE();

    // Load saved device status
    SecureStore.getItemAsync(DEVICE_STATUS_KEY)
      .then((saved) => {
        if (saved) {
          try {
            const parsedStatus = JSON.parse(saved) as MoteStatusMessage;
            setDeviceStatus(parsedStatus);
            console.log('[MoteHardware] Loaded saved device status:', parsedStatus);
          } catch (error) {
            console.error('[MoteHardware] Failed to parse saved device status:', error);
          }
        }
      })
      .catch((error) => {
        console.error('[MoteHardware] Failed to load saved device status:', error);
      });

    return () => {
      // Cleanup timers on unmount (don't destroy singleton BLE client)
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  // Set up message and disconnect handlers when client is available
  useEffect(() => {
    const unsubscribeMessage = bleClient.onMessage((message) => {
      console.log('[MoteHardware] Received message:', message);

      switch (message.type) {
        case 'status':
          setDeviceStatus(message);
          // Save to SecureStore for persistence
          SecureStore.setItemAsync(DEVICE_STATUS_KEY, JSON.stringify(message))
            .catch((error) => {
              console.error('[MoteHardware] Failed to save device status:', error);
            });
          break;

        case 'error':
          setConnectionError(message.message);
          console.error('[MoteHardware] Device error:', message.code, message.message);
          break;

        case 'ack':
          console.log('[MoteHardware] Acknowledgment:', message.message);
          if (!message.success) {
            setConnectionError(message.message);
          }
          break;

        default:
          console.warn('[MoteHardware] Unknown message type:', message);
      }
    });

    // Set up disconnect handler for auto-reconnect
    const unsubscribeDisconnect = bleClient.onDisconnect(() => {
      handleUnexpectedDisconnect();
    });

    return () => {
      unsubscribeMessage();
      unsubscribeDisconnect();
    };
  }, [bleClient]);

  /**
   * Scan for Mote devices
   */
  const scanForDevices = async () => {
    setIsScanning(true);
    setConnectionError(null);
    setDiscoveredDevices([]);

    try {
      const devices = await bleClient.scanForDevices(10000); // 10 second scan
      setDiscoveredDevices(devices);
      console.log('[MoteHardware] Found', devices.length, 'device(s)');

      if (devices.length === 0) {
        setConnectionError('No Mote devices found. Make sure your device is powered on and nearby.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to scan for devices';
      setConnectionError(errorMessage);
      console.error('[MoteHardware] Scan failed:', errorMessage);
    } finally {
      setIsScanning(false);
    }
  };

  /**
   * Connect to specific Mote device via BLE
   */
  const connect = async (deviceId: string) => {
    // Cancel any pending reconnect
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    isManualDisconnectRef.current = false;
    setIsConnecting(true);
    setConnectionError(null);

    try {
      await bleClient.connect(deviceId);
      setIsConnected(true);

      // Save device ID for auto-reconnect
      lastDeviceIdRef.current = deviceId;
      await SecureStore.setItemAsync(LAST_DEVICE_ID_KEY, deviceId);
      reconnectAttemptsRef.current = 0;

      console.log('[MoteHardware] Successfully connected to Mote device');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Mote device';
      setConnectionError(errorMessage);
      setIsConnected(false);
      console.error('[MoteHardware] Connection failed:', errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Disconnect from Mote device (manual disconnect)
   */
  const disconnect = () => {
    isManualDisconnectRef.current = true;

    // Cancel any pending reconnect
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    bleClient.disconnect();
    setIsConnected(false);
    console.log('[MoteHardware] Manually disconnected from Mote device');
  };

  /**
   * Handle unexpected disconnection - trigger auto-reconnect
   */
  const handleUnexpectedDisconnect = () => {
    if (isManualDisconnectRef.current) {
      console.log('[MoteHardware] Manual disconnect, not auto-reconnecting');
      return;
    }

    setIsConnected(false);
    console.log('[MoteHardware] Unexpected disconnect detected');

    // Try to reconnect if we have a saved device
    if (lastDeviceIdRef.current) {
      console.log('[MoteHardware] Scheduling auto-reconnect...');
      reconnectTimerRef.current = setTimeout(() => {
        attemptReconnect(lastDeviceIdRef.current!);
      }, AUTO_RECONNECT_DELAY);
    }
  };

  /**
   * Send WiFi and Gateway configuration to Mote device
   */
  const sendConfig = async (config: {
    wifiSsid: string;
    wifiPassword: string;
    websocketServer: string;
    websocketPort: number;
    gatewayToken: string;
  }) => {
    if (!isConnected) {
      throw new Error('Not connected to Mote device. Please connect first.');
    }

    try {
      bleClient.sendConfig(config);
      console.log('[MoteHardware] Configuration sent to device');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send configuration';
      setConnectionError(errorMessage);
      throw error;
    }
  };

  /**
   * Clear connection error
   */
  const clearError = () => {
    setConnectionError(null);
  };

  return (
    <MoteHardwareContext.Provider
      value={{
        isConnected,
        isScanning,
        isConnecting,
        connectionError,
        deviceStatus,
        discoveredDevices,
        scanForDevices,
        connect,
        disconnect,
        sendConfig,
        clearError,
      }}
    >
      {children}
    </MoteHardwareContext.Provider>
  );
}

/**
 * Hook to use Mote Hardware context
 *
 * @throws Error if used outside of MoteHardwareProvider
 *
 * Usage:
 * ```tsx
 * const { isConnected, connect, deviceStatus } = useMoteHardware();
 * ```
 */
export function useMoteHardware() {
  const context = useContext(MoteHardwareContext);
  if (!context) {
    throw new Error('useMoteHardware must be used within MoteHardwareProvider');
  }
  return context;
}
