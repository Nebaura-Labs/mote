/**
 * Mote Device Communication Protocol
 *
 * This module defines the message types for communication between the mobile app
 * and the Mote hardware device via WebSocket (ws://192.168.4.1:3000/config).
 *
 * The protocol uses JSON messages with a discriminated union type system.
 */

/**
 * Union type of all possible Mote messages
 */
export type MoteMessage =
  | MoteConfigMessage
  | MoteVolumeMessage
  | MoteStatusMessage
  | MoteAckMessage
  | MoteErrorMessage;

/**
 * Configuration message sent from app to Mote device
 *
 * This message contains WiFi credentials and Gateway server information
 * that the Mote needs to connect to the user's home network and backend.
 */
export interface MoteConfigMessage {
  type: 'config';
  wifiSsid: string;         // Home WiFi network name
  wifiPassword: string;     // Home WiFi password
  websocketServer: string;  // Gateway WebSocket URL (e.g., "wss://gateway.example.com")
  websocketPort: number;    // Gateway WebSocket port (e.g., 3000)
}

/**
 * Volume control message sent from app to Mote device
 *
 * This message sets the speaker volume on the device.
 */
export interface MoteVolumeMessage {
  volume: number;  // Volume level (0-100)
}

/**
 * Status message sent from Mote device to app
 *
 * Contains current device state including battery level, firmware version,
 * connection status, and network information.
 */
export interface MoteStatusMessage {
  type: 'status';
  deviceId: string;            // MAC address (e.g., "AA:BB:CC:DD:EE:FF")
  firmwareVersion: string;     // Firmware version (e.g., "1.0.0")
  batteryPercent: number;      // Battery percentage (0-100)
  batteryVoltage: number;      // Battery voltage in volts (e.g., 3.95)
  volume: number;              // Speaker volume level (0-100)
  wifiConfigured: boolean;     // true if WiFi credentials have been configured
  wifiConnected: boolean;      // true if WiFi is currently connected
  wifiSsid?: string;           // Configured WiFi SSID (for prefilling forms)
  gatewayConfigured: boolean;  // true if Gateway server has been configured
  gatewayConnected?: boolean;  // true if Gateway WebSocket is connected (optional, future)
  gatewayServer?: string;      // Configured gateway server URL (for prefilling forms)
  gatewayPort?: number;        // Configured gateway port (for prefilling forms)
}

/**
 * Acknowledgment message sent from Mote device to app
 *
 * Confirms receipt and processing of a configuration message.
 */
export interface MoteAckMessage {
  type: 'ack';
  message: string;  // Human-readable status message
  success: boolean; // true if operation succeeded
}

/**
 * Error message sent from Mote device to app
 *
 * Indicates a failure in processing a configuration or connection attempt.
 */
export interface MoteErrorMessage {
  type: 'error';
  code: string;     // Error code (e.g., "WIFI_FAILED", "PARSE_ERROR")
  message: string;  // Human-readable error description
}

/**
 * Type guard to check if a message is a MoteStatusMessage
 */
export function isMoteStatusMessage(msg: MoteMessage): msg is MoteStatusMessage {
  return msg.type === 'status';
}

/**
 * Type guard to check if a message is a MoteAckMessage
 */
export function isMoteAckMessage(msg: MoteMessage): msg is MoteAckMessage {
  return msg.type === 'ack';
}

/**
 * Type guard to check if a message is a MoteErrorMessage
 */
export function isMoteErrorMessage(msg: MoteMessage): msg is MoteErrorMessage {
  return msg.type === 'error';
}

/**
 * Type guard to check if a message is a MoteConfigMessage
 */
export function isMoteConfigMessage(msg: MoteMessage): msg is MoteConfigMessage {
  return msg.type === 'config';
}
