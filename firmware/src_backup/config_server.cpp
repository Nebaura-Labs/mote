#include "config_server.h"
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include "wifi_config.h"

// WebSocket server on port 3000
WebSocketsServer configServer = WebSocketsServer(3000);

/**
 * WebSocket event handler
 *
 * Handles connection, disconnection, and incoming messages
 */
void onConfigWebSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.printf("[ConfigWS] Client #%u disconnected\n", num);
      break;

    case WStype_CONNECTED: {
      IPAddress ip = configServer.remoteIP(num);
      Serial.printf("[ConfigWS] Client #%u connected from %s\n", num, ip.toString().c_str());

      // Send device status immediately on connect
      sendDeviceStatus(num);
      break;
    }

    case WStype_TEXT: {
      Serial.printf("[ConfigWS] Received text from #%u: %s\n", num, payload);

      // Parse JSON message
      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, payload, length);

      if (error) {
        Serial.printf("[ConfigWS] JSON parse error: %s\n", error.c_str());
        sendError(num, "PARSE_ERROR", "Failed to parse JSON message");
        return;
      }

      // Get message type
      const char* type = doc["type"];
      if (type == nullptr) {
        sendError(num, "MISSING_TYPE", "Message type is required");
        return;
      }

      // Handle different message types
      if (strcmp(type, "config") == 0) {
        handleConfigMessage(num, doc);
      } else if (strcmp(type, "ping") == 0) {
        // Respond to ping with updated status
        sendDeviceStatus(num);
      } else {
        Serial.printf("[ConfigWS] Unknown message type: %s\n", type);
        sendError(num, "UNKNOWN_TYPE", "Unknown message type");
      }
      break;
    }

    case WStype_BIN:
      Serial.printf("[ConfigWS] Received binary data from #%u (ignored)\n", num);
      break;

    case WStype_ERROR:
      Serial.printf("[ConfigWS] Error on client #%u\n", num);
      break;

    default:
      break;
  }
}

/**
 * Initialize configuration WebSocket server
 */
void setupConfigServer() {
  configServer.begin();
  configServer.onEvent(onConfigWebSocketEvent);
  Serial.println("[ConfigWS] Configuration WebSocket server started on port 3000");
  Serial.println("[ConfigWS] Endpoint: ws://192.168.4.1:3000/config");
}

/**
 * Handle WebSocket events in loop()
 */
void handleConfigServerLoop() {
  configServer.loop();
}

/**
 * Send device status to client
 */
void sendDeviceStatus(uint8_t clientNum) {
  JsonDocument doc;

  doc["type"] = "status";
  doc["deviceId"] = WiFi.macAddress();
  doc["firmwareVersion"] = "1.0.0";  // TODO: Make this configurable
  doc["batteryPercent"] = getMoteBatteryPercent();
  doc["batteryVoltage"] = getMoteBatteryVoltage();
  doc["wifiConnected"] = isWiFiConnected();
  doc["websocketConnected"] = websocketConnected;

  // Add IP address if connected to WiFi
  if (isWiFiConnected()) {
    doc["ipAddress"] = WiFi.localIP().toString();
  } else {
    doc["ipAddress"] = nullptr;
  }

  // Serialize and send
  String message;
  serializeJson(doc, message);
  configServer.sendTXT(clientNum, message);

  Serial.printf("[ConfigWS] Sent status to client #%u\n", clientNum);
}

/**
 * Handle incoming configuration message
 */
void handleConfigMessage(uint8_t clientNum, JsonDocument& doc) {
  Serial.println("[ConfigWS] Processing configuration message...");

  // Extract configuration parameters
  const char* wifiSsid = doc["wifiSsid"];
  const char* wifiPassword = doc["wifiPassword"];
  const char* websocketServer = doc["websocketServer"];
  uint16_t websocketPort = doc["websocketPort"] | 3000;  // Default to 3000 if not provided

  // Validate WiFi SSID
  if (wifiSsid == nullptr || strlen(wifiSsid) == 0) {
    Serial.println("[ConfigWS] Error: WiFi SSID is required");
    sendError(clientNum, "INVALID_SSID", "WiFi SSID is required");
    return;
  }

  // Validate WebSocket server
  if (websocketServer == nullptr || strlen(websocketServer) == 0) {
    Serial.println("[ConfigWS] Error: WebSocket server is required");
    sendError(clientNum, "INVALID_SERVER", "WebSocket server is required");
    return;
  }

  // Save configuration to globals
  Serial.printf("[ConfigWS] Saving config - SSID: %s, Server: %s:%d\n",
                wifiSsid, websocketServer, websocketPort);

  strncpy(WIFI_SSID, wifiSsid, sizeof(WIFI_SSID) - 1);
  WIFI_SSID[sizeof(WIFI_SSID) - 1] = '\0';  // Ensure null termination

  if (wifiPassword != nullptr) {
    strncpy(WIFI_PASSWORD, wifiPassword, sizeof(WIFI_PASSWORD) - 1);
    WIFI_PASSWORD[sizeof(WIFI_PASSWORD) - 1] = '\0';
  } else {
    WIFI_PASSWORD[0] = '\0';  // Empty password for open networks
  }

  strncpy(WEBSOCKET_SERVER, websocketServer, sizeof(WEBSOCKET_SERVER) - 1);
  WEBSOCKET_SERVER[sizeof(WEBSOCKET_SERVER) - 1] = '\0';

  WEBSOCKET_PORT = websocketPort;

  // Send acknowledgment
  sendAck(clientNum, "Configuration saved, connecting to WiFi...", true);

  // Stop Access Point mode
  Serial.println("[ConfigWS] Stopping Access Point...");
  stopMoteAP();

  // Small delay to allow ack to be sent
  delay(100);

  // Connect to WiFi
  Serial.printf("[ConfigWS] Connecting to WiFi: %s\n", WIFI_SSID);
  bool wifiSuccess = connectToWiFi(WIFI_SSID, WIFI_PASSWORD);

  if (wifiSuccess) {
    Serial.println("[ConfigWS] WiFi connected!");

    // Connect to WebSocket Gateway
    String wsUrl = String(WEBSOCKET_SERVER);
    if (websocketPort != 80 && websocketPort != 443) {
      wsUrl += ":" + String(websocketPort);
    }

    Serial.printf("[ConfigWS] Connecting to Gateway: %s\n", wsUrl.c_str());
    bool wsSuccess = connectToWebSocket(wsUrl.c_str());

    if (wsSuccess) {
      Serial.println("[ConfigWS] Successfully connected to Gateway!");
      sendAck(clientNum, "Successfully connected to WiFi and Gateway!", true);
    } else {
      Serial.println("[ConfigWS] Failed to connect to Gateway");
      sendError(clientNum, "WEBSOCKET_FAILED", "Connected to WiFi but failed to connect to Gateway");
    }
  } else {
    Serial.println("[ConfigWS] Failed to connect to WiFi");
    sendError(clientNum, "WIFI_FAILED", "Failed to connect to WiFi network");

    // Restart Access Point if WiFi connection failed
    Serial.println("[ConfigWS] Restarting Access Point...");
    setupMoteAP("Mote");
  }

  // Send updated status
  sendDeviceStatus(clientNum);
}

/**
 * Send acknowledgment message
 */
void sendAck(uint8_t clientNum, const char* message, bool success) {
  JsonDocument doc;

  doc["type"] = "ack";
  doc["message"] = message;
  doc["success"] = success;

  String json;
  serializeJson(doc, json);
  configServer.sendTXT(clientNum, json);

  Serial.printf("[ConfigWS] Sent ack to client #%u: %s\n", clientNum, message);
}

/**
 * Send error message
 */
void sendError(uint8_t clientNum, const char* code, const char* message) {
  JsonDocument doc;

  doc["type"] = "error";
  doc["code"] = code;
  doc["message"] = message;

  String json;
  serializeJson(doc, json);
  configServer.sendTXT(clientNum, json);

  Serial.printf("[ConfigWS] Sent error to client #%u: [%s] %s\n", clientNum, code, message);
}
