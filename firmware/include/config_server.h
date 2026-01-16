#ifndef CONFIG_SERVER_H
#define CONFIG_SERVER_H

#include <Arduino.h>
#include <ArduinoJson.h>

/**
 * Configuration WebSocket Server
 *
 * Provides a WebSocket endpoint at port 3000 (/config) for mobile app
 * to configure WiFi credentials and Gateway server settings.
 *
 * Message Protocol:
 * - Incoming: {"type": "config", "wifiSsid": "...", "wifiPassword": "...", "websocketServer": "...", "websocketPort": 3000}
 * - Outgoing: {"type": "status", "deviceId": "...", "firmwareVersion": "...", "batteryPercent": 85, ...}
 * - Response: {"type": "ack", "message": "...", "success": true}
 * - Error: {"type": "error", "code": "...", "message": "..."}
 */

// Initialize configuration WebSocket server on port 3000
void setupConfigServer();

// Handle WebSocket events in loop()
// Call this in the main loop to process WebSocket messages
void handleConfigServerLoop();

// Send device status to specific client
// @param clientNum The WebSocket client number
void sendDeviceStatus(uint8_t clientNum);

// Handle incoming configuration message from mobile app
// @param clientNum The WebSocket client number
// @param doc Parsed JSON document containing configuration
void handleConfigMessage(uint8_t clientNum, JsonDocument& doc);

// Send acknowledgment message to client
// @param clientNum The WebSocket client number
// @param message Human-readable status message
// @param success Whether the operation succeeded
void sendAck(uint8_t clientNum, const char* message, bool success);

// Send error message to client
// @param clientNum The WebSocket client number
// @param code Error code (e.g., "WIFI_FAILED", "PARSE_ERROR")
// @param message Human-readable error description
void sendError(uint8_t clientNum, const char* code, const char* message);

// Helper function to get battery percentage (forward declaration)
// Implement this in your main.cpp if not already available
extern int getMoteBatteryPercent();
extern float getMoteBatteryVoltage();

#endif // CONFIG_SERVER_H
