#ifndef WIFI_CONFIG_H
#define WIFI_CONFIG_H

#include <WiFi.h>
#include <ArduinoWebsockets.h>

using namespace websockets;

// WiFi Configuration
// These will be set from mobile app via BLE during initial setup
extern char WIFI_SSID[32];
extern char WIFI_PASSWORD[64];
extern char WEBSOCKET_SERVER[128];
extern uint16_t WEBSOCKET_PORT;

// Connection state
extern bool wifiConnected;
extern bool websocketConnected;

// WebSocket client
extern WebsocketsClient webSocket;

// WiFi functions
void setupWiFi();
bool connectToWiFi(const char* ssid, const char* password);
void disconnectWiFi();
bool isWiFiConnected();

// Access Point functions
bool setupMoteAP(const char* ssid = "Mote", const char* password = nullptr);
void stopMoteAP();
bool isMoteAPRunning();

// WebSocket functions
void setupWebSocket();
bool connectToWebSocket(const char* serverUrl);
void disconnectWebSocket();
void handleWebSocketMessages();
void sendAudioToServer(const uint8_t* audioData, size_t length);

// WebSocket event handlers
void onWebSocketMessage(WebsocketsMessage message);
void onWebSocketEvent(WebsocketsEvent event, String data);

// Audio playback callback
void setAudioPlaybackCallback(void (*callback)(const uint8_t*, size_t));

#endif // WIFI_CONFIG_H
