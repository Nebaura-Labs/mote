/**
 * Mote BLE Client
 *
 * Handles Bluetooth Low Energy connection to Mote hardware device.
 * Replaces WebSocket connection with more stable BLE communication.
 */

import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import type { MoteStatusMessage } from './mote-protocol';

// BLE Service and Characteristic UUIDs (must match firmware)
const MOTE_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const STATUS_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const CONFIG_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';

export class MoteBleClient {
  private manager: BleManager;
  private device: Device | null = null;
  private statusCharacteristic: Characteristic | null = null;
  private configCharacteristic: Characteristic | null = null;
  private messageListeners: Array<(message: any) => void> = [];
  private disconnectListeners: Array<() => void> = [];
  private disconnectSubscription: { remove: () => void } | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  /**
   * Request Bluetooth permissions (Android only)
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      // iOS handles permissions automatically
      return true;
    }

    // Android 12+ requires multiple permissions
    if (Platform.Version >= 31) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      return (
        granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      // Android 11 and below
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  }

  /**
   * Scan for Mote devices
   * @returns Array of discovered Mote devices
   */
  async scanForDevices(timeoutMs: number = 10000): Promise<Device[]> {
    console.log('[MoteBLE] Starting scan (skipping state check due to iOS bug)...');

    const devices: Device[] = [];
    const deviceIds = new Set<string>();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        console.log(`[MoteBLE] Scan complete. Found ${devices.length} device(s)`);
        resolve(devices);
      }, timeoutMs);

      this.manager.startDeviceScan(
        null, // Scan for all devices, not just specific service UUID
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            clearTimeout(timeout);
            this.manager.stopDeviceScan();
            console.error('[MoteBLE] Scan error:', error);
            reject(new Error(`Bluetooth scan failed: ${error.message}`));
            return;
          }

          // Log all discovered devices for debugging
          if (device) {
            console.log('[MoteBLE] Discovered device:', device.name || 'Unknown', device.id);
          }

          if (device && device.name && device.name.includes('Mote') && !deviceIds.has(device.id)) {
            deviceIds.add(device.id);
            devices.push(device);
            console.log('[MoteBLE] Found Mote device:', device.name, device.id);
          }
        }
      );
    });
  }

  /**
   * Connect to a specific Mote device
   */
  async connect(deviceId: string): Promise<void> {
    console.log('[MoteBLE] Connecting to device:', deviceId);

    try {
      // Stop any ongoing scans
      this.manager.stopDeviceScan();

      // Connect to device
      this.device = await this.manager.connectToDevice(deviceId);
      console.log('[MoteBLE] Device connected:', this.device.name);

      // Discover services and characteristics
      await this.device.discoverAllServicesAndCharacteristics();
      console.log('[MoteBLE] Services discovered');

      // Get characteristics
      const characteristics = await this.device.characteristicsForService(MOTE_SERVICE_UUID);

      this.statusCharacteristic =
        characteristics.find((c) => c.uuid.toLowerCase() === STATUS_CHAR_UUID.toLowerCase()) ||
        null;
      this.configCharacteristic =
        characteristics.find((c) => c.uuid.toLowerCase() === CONFIG_CHAR_UUID.toLowerCase()) ||
        null;

      if (!this.statusCharacteristic || !this.configCharacteristic) {
        throw new Error('Required characteristics not found on device');
      }

      console.log('[MoteBLE] Characteristics found');

      // Subscribe to status updates
      this.device.monitorCharacteristicForService(
        MOTE_SERVICE_UUID,
        STATUS_CHAR_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('[MoteBLE] Monitor error:', error);
            return;
          }

          if (characteristic?.value) {
            try {
              // Decode base64 value
              const decoded = atob(characteristic.value);
              const message = JSON.parse(decoded);
              console.log('[MoteBLE] Received status:', message);

              // Notify listeners
              this.messageListeners.forEach((listener) => listener(message));
            } catch (error) {
              console.error('[MoteBLE] Failed to parse status message:', error);
            }
          }
        }
      );

      console.log('[MoteBLE] Status monitoring started');

      // Read initial status
      const initialStatus = await this.statusCharacteristic.read();
      if (initialStatus.value) {
        const decoded = atob(initialStatus.value);
        const message = JSON.parse(decoded);
        console.log('[MoteBLE] Initial status:', message);
        this.messageListeners.forEach((listener) => listener(message));
      }

      // Set up disconnect listener
      this.disconnectSubscription = this.manager.onDeviceDisconnected(
        deviceId,
        (error, device) => {
          console.log('[MoteBLE] Device disconnected:', device?.name, error?.message);
          this.device = null;
          this.statusCharacteristic = null;
          this.configCharacteristic = null;

          // Notify disconnect listeners
          this.disconnectListeners.forEach((listener) => listener());
        }
      );
    } catch (error) {
      console.error('[MoteBLE] Connection failed:', error);
      this.device = null;
      throw error;
    }
  }

  /**
   * Send WiFi configuration to device
   */
  async sendConfig(config: {
    wifiSsid: string;
    wifiPassword: string;
    websocketServer: string;
    websocketPort: number;
    gatewayToken: string;
  }): Promise<void> {
    if (!this.device || !this.configCharacteristic) {
      throw new Error('Not connected to device');
    }

    const configJson = JSON.stringify({
      ssid: config.wifiSsid,
      password: config.wifiPassword,
      server: config.websocketServer,
      port: config.websocketPort,
      token: config.gatewayToken,
    });

    console.log('[MoteBLE] Sending config:', configJson);

    try {
      // Write configuration to characteristic (encode as base64)
      const encoded = btoa(configJson);
      await this.configCharacteristic.writeWithResponse(encoded);
      console.log('[MoteBLE] Configuration sent successfully');
    } catch (error) {
      console.error('[MoteBLE] Failed to send config:', error);
      throw new Error('Failed to send configuration to device');
    }
  }

  /**
   * Disconnect from device
   */
  disconnect(): void {
    // Remove disconnect subscription first to avoid triggering reconnect
    if (this.disconnectSubscription) {
      this.disconnectSubscription.remove();
      this.disconnectSubscription = null;
    }

    if (this.device) {
      console.log('[MoteBLE] Disconnecting from device');
      this.manager.cancelDeviceConnection(this.device.id).catch((error) => {
        console.error('[MoteBLE] Disconnect error:', error);
      });
      this.device = null;
      this.statusCharacteristic = null;
      this.configCharacteristic = null;
    }
  }

  /**
   * Check if connected to device
   */
  isConnected(): boolean {
    return this.device !== null;
  }

  /**
   * Register message listener
   */
  onMessage(callback: (message: any) => void): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((listener) => listener !== callback);
    };
  }

  /**
   * Register disconnect listener
   */
  onDisconnect(callback: () => void): () => void {
    this.disconnectListeners.push(callback);
    return () => {
      this.disconnectListeners = this.disconnectListeners.filter((listener) => listener !== callback);
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disconnect();
    this.manager.destroy();
  }
}
