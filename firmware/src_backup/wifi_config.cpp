#include "wifi_config.h"
#include <ArduinoJson.h>

// WiFi credentials (loaded from flash or configured via BLE)
char WIFI_SSID[32] = "";
char WIFI_PASSWORD[64] = "";
char WEBSOCKET_SERVER[128] = ""; // Will be configured from mobile app
uint16_t WEBSOCKET_PORT = 3000;

// Connection state
bool wifiConnected = false;
bool websocketConnected = false;

// WebSocket client
WebsocketsClient webSocket;

// Audio playback callback (will be set from main.cpp)
void (*audioPlaybackCallback)(const uint8_t* data, size_t length) = nullptr;

/**
 * Initialize WiFi
 */
void setupWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  Serial.println("[WiFi] WiFi initialized in station mode");
}

/**
 * Connect to WiFi network
 */
bool connectToWiFi(const char* ssid, const char* password) {
  if (ssid == nullptr || strlen(ssid) == 0) {
    Serial.println("[WiFi] ERROR: SSID is empty");
    return false;
  }

  Serial.printf("[WiFi] Connecting to %s...\n", ssid);

  WiFi.begin(ssid, password);

  // Wait up to 10 seconds for connection
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\n[WiFi] Connected!");
    Serial.printf("[WiFi] IP address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WiFi] RSSI: %d dBm\n", WiFi.RSSI());
    return true;
  } else {
    wifiConnected = false;
    Serial.println("\n[WiFi] Connection failed!");
    return false;
  }
}

/**
 * Disconnect from WiFi
 */
void disconnectWiFi() {
  WiFi.disconnect();
  wifiConnected = false;
  Serial.println("[WiFi] Disconnected");
}

/**
 * Check WiFi connection status
 */
bool isWiFiConnected() {
  bool connected = (WiFi.status() == WL_CONNECTED);
  wifiConnected = connected;
  return connected;
}

/**
 * Initialize WebSocket client
 */
void setupWebSocket() {
  // Set WebSocket event handlers
  webSocket.onMessage(onWebSocketMessage);
  webSocket.onEvent(onWebSocketEvent);

  Serial.println("[WebSocket] WebSocket client initialized");
}

/**
 * Connect to WebSocket server
 */
bool connectToWebSocket(const char* serverUrl) {
  if (!wifiConnected) {
    Serial.println("[WebSocket] ERROR: WiFi not connected");
    return false;
  }

  Serial.printf("[WebSocket] Connecting to %s...\n", serverUrl);

  bool connected = webSocket.connect(serverUrl);

  if (connected) {
    websocketConnected = true;
    Serial.println("[WebSocket] Connected!");

    // Send initial hello message with device info
    JsonDocument doc;
    doc["type"] = "hello";
    doc["deviceId"] = WiFi.macAddress();
    doc["firmwareVersion"] = "1.0.0";

    String message;
    serializeJson(doc, message);
    webSocket.send(message);

    return true;
  } else {
    websocketConnected = false;
    Serial.println("[WebSocket] Connection failed!");
    return false;
  }
}

/**
 * Disconnect from WebSocket server
 */
void disconnectWebSocket() {
  webSocket.close();
  websocketConnected = false;
  Serial.println("[WebSocket] Disconnected");
}

/**
 * Poll for WebSocket messages (call in loop())
 */
void handleWebSocketMessages() {
  if (websocketConnected) {
    webSocket.poll();
  }
}

/**
 * Send audio data to server
 */
void sendAudioToServer(const uint8_t* audioData, size_t length) {
  if (!websocketConnected) {
    Serial.println("[WebSocket] ERROR: Not connected to server");
    return;
  }

  // Send binary audio data
  webSocket.sendBinary((const char*)audioData, length);
  Serial.printf("[WebSocket] Sent %d bytes of audio\n", length);
}

/**
 * WebSocket message handler
 */
void onWebSocketMessage(WebsocketsMessage message) {
  Serial.printf("[WebSocket] Received message (type: %s, length: %d)\n",
                message.isBinary() ? "binary" : "text", message.length());

  if (message.isBinary()) {
    // Received audio response from server
    Serial.println("[WebSocket] Received audio response");

    // Call playback callback if set
    if (audioPlaybackCallback != nullptr) {
      audioPlaybackCallback((const uint8_t*)message.c_str(), message.length());
    } else {
      Serial.println("[WebSocket] WARNING: No audio playback callback set");
    }
  } else {
    // Received text message (JSON)
    Serial.printf("[WebSocket] Received text: %s\n", message.data().c_str());

    // Parse JSON message
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, message.data());

    if (error) {
      Serial.printf("[WebSocket] JSON parse error: %s\n", error.c_str());
      return;
    }

    // Handle different message types
    const char* type = doc["type"];

    if (strcmp(type, "transcription") == 0) {
      const char* text = doc["text"];
      Serial.printf("[WebSocket] Transcription: %s\n", text);
    } else if (strcmp(type, "response") == 0) {
      const char* text = doc["text"];
      Serial.printf("[WebSocket] AI Response: %s\n", text);
    } else if (strcmp(type, "error") == 0) {
      const char* errorMsg = doc["message"];
      Serial.printf("[WebSocket] Error from server: %s\n", errorMsg);
    } else {
      Serial.printf("[WebSocket] Unknown message type: %s\n", type);
    }
  }
}

/**
 * WebSocket event handler
 */
void onWebSocketEvent(WebsocketsEvent event, String data) {
  switch (event) {
    case WebsocketsEvent::ConnectionOpened:
      Serial.println("[WebSocket] Connection opened");
      websocketConnected = true;
      break;

    case WebsocketsEvent::ConnectionClosed:
      Serial.println("[WebSocket] Connection closed");
      websocketConnected = false;
      break;

    case WebsocketsEvent::GotPing:
      Serial.println("[WebSocket] Got ping");
      break;

    case WebsocketsEvent::GotPong:
      Serial.println("[WebSocket] Got pong");
      break;
  }
}

/**
 * Set audio playback callback
 */
void setAudioPlaybackCallback(void (*callback)(const uint8_t*, size_t)) {
  audioPlaybackCallback = callback;
}

/**
 * Set up Mote as a WiFi Access Point
 * @param ssid The SSID for the AP (default: "Mote")
 * @param password Optional password (nullptr for open network)
 * @return true if AP started successfully
 */
bool setupMoteAP(const char* ssid, const char* password) {
  Serial.printf("[WiFi AP] Starting access point: %s\n", ssid);

  // Set WiFi mode to AP (Access Point)
  WiFi.mode(WIFI_AP);

  // Configure and start the AP
  bool success;
  if (password == nullptr || strlen(password) == 0) {
    // Open network (no password)
    success = WiFi.softAP(ssid);
    Serial.println("[WiFi AP] Starting as OPEN network");
  } else {
    // Secured network with password
    success = WiFi.softAP(ssid, password);
    Serial.println("[WiFi AP] Starting as SECURED network");
  }

  if (success) {
    // Get and print AP details
    IPAddress IP = WiFi.softAPIP();
    Serial.println("[WiFi AP] Access Point started successfully!");
    Serial.printf("[WiFi AP] SSID: %s\n", ssid);
    Serial.printf("[WiFi AP] IP address: %s\n", IP.toString().c_str());
    Serial.printf("[WiFi AP] MAC address: %s\n", WiFi.softAPmacAddress().c_str());
    return true;
  } else {
    Serial.println("[WiFi AP] Failed to start access point");
    return false;
  }
}

/**
 * Stop the Mote Access Point
 */
void stopMoteAP() {
  WiFi.softAPdisconnect(true);
  Serial.println("[WiFi AP] Access Point stopped");
}

/**
 * Check if Mote AP is running
 */
bool isMoteAPRunning() {
  return (WiFi.getMode() == WIFI_AP || WiFi.getMode() == WIFI_AP_STA);
}
