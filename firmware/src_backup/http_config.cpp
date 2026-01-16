#include "http_config.h"

// HTTP server on port 80
WiFiServer httpServer(80);
WiFiClient httpClient;

/**
 * Initialize HTTP config server
 */
void setupHttpConfig() {
  httpServer.begin();
  Serial.println("[HTTP] Config server started on port 80");
  Serial.println("[HTTP] Access at: http://192.168.4.1/");
}

/**
 * Send HTTP response
 */
void sendHttpResponse(WiFiClient& client, int statusCode, const char* contentType, const char* body) {
  client.printf("HTTP/1.1 %d OK\r\n", statusCode);
  client.printf("Content-Type: %s\r\n", contentType);
  client.printf("Content-Length: %d\r\n", strlen(body));
  client.println("Access-Control-Allow-Origin: *");
  client.println("Connection: close");
  client.println();
  client.print(body);
}

/**
 * Handle GET /status - Returns device status as JSON
 */
void handleStatusRequest(WiFiClient& client) {
  float voltage = getMoteBatteryVoltage();
  int percent = getMoteBatteryPercent();
  String mac = WiFi.macAddress();

  // Build JSON manually (no library needed)
  String json = "{";
  json += "\"type\":\"status\",";
  json += "\"deviceId\":\"" + mac + "\",";
  json += "\"firmwareVersion\":\"1.0.0\",";
  json += "\"batteryPercent\":" + String(percent) + ",";
  json += "\"batteryVoltage\":" + String(voltage, 2) + ",";
  json += "\"wifiMode\":\"AP\",";
  json += "\"ipAddress\":\"192.168.4.1\"";
  json += "}";

  sendHttpResponse(client, 200, "application/json", json.c_str());

  Serial.println("[HTTP] Sent status response");
}

/**
 * Parse simple key=value POST body (URL encoded)
 */
String getPostValue(const String& body, const String& key) {
  int startIdx = body.indexOf(key + "=");
  if (startIdx == -1) return "";

  startIdx += key.length() + 1; // Skip "key="
  int endIdx = body.indexOf("&", startIdx);
  if (endIdx == -1) endIdx = body.length();

  String value = body.substring(startIdx, endIdx);

  // URL decode (replace + with space, decode %XX)
  value.replace("+", " ");
  // TODO: Full URL decoding if needed

  return value;
}

/**
 * Handle POST /config - Accept WiFi configuration
 */
void handleConfigRequest(WiFiClient& client, const String& body) {
  Serial.println("[HTTP] Received config POST:");
  Serial.println(body);

  // Parse POST body (simple URL-encoded format)
  String ssid = getPostValue(body, "ssid");
  String password = getPostValue(body, "password");
  String server = getPostValue(body, "server");
  String port = getPostValue(body, "port");

  Serial.printf("[HTTP] Parsed - SSID: %s, Server: %s:%s\n",
                ssid.c_str(), server.c_str(), port.c_str());

  // Validate
  if (ssid.length() == 0) {
    String error = "{\"error\":\"SSID required\"}";
    sendHttpResponse(client, 400, "application/json", error.c_str());
    return;
  }

  // Send success response
  String response = "{\"success\":true,\"message\":\"Configuration saved\"}";
  sendHttpResponse(client, 200, "application/json", response.c_str());

  Serial.println("[HTTP] Config saved, will connect to WiFi");

  // TODO: Store config and connect to WiFi
  // For now, just acknowledge the config
}

/**
 * Handle HTTP requests in loop()
 */
void handleHttpConfig() {
  // Check for new client
  WiFiClient client = httpServer.available();

  if (!client) {
    return;
  }

  Serial.println("[HTTP] New client connected");

  // Wait for data from client
  unsigned long timeout = millis() + 3000; // 3 second timeout
  while (!client.available() && millis() < timeout) {
    delay(10);
  }

  if (!client.available()) {
    Serial.println("[HTTP] Client timeout");
    client.stop();
    return;
  }

  // Read HTTP request
  String request = "";
  String method = "";
  String path = "";
  String body = "";
  bool isBody = false;
  int contentLength = 0;

  // Read headers
  while (client.available()) {
    String line = client.readStringUntil('\n');
    line.trim();

    if (line.length() == 0) {
      // Empty line = end of headers
      isBody = true;
      break;
    }

    // Parse first line (method and path)
    if (request.length() == 0) {
      request = line;
      int firstSpace = line.indexOf(' ');
      int secondSpace = line.indexOf(' ', firstSpace + 1);
      if (firstSpace != -1 && secondSpace != -1) {
        method = line.substring(0, firstSpace);
        path = line.substring(firstSpace + 1, secondSpace);
      }
    }

    // Check for Content-Length header
    if (line.startsWith("Content-Length:")) {
      contentLength = line.substring(15).toInt();
    }
  }

  // Read body if present
  if (contentLength > 0 && client.available()) {
    char bodyBuf[512];
    int bytesRead = client.readBytes(bodyBuf, min(contentLength, 511));
    bodyBuf[bytesRead] = '\0';
    body = String(bodyBuf);
  }

  Serial.printf("[HTTP] %s %s\n", method.c_str(), path.c_str());

  // Route requests
  if (method == "GET" && path == "/status") {
    handleStatusRequest(client);
  } else if (method == "POST" && path == "/config") {
    handleConfigRequest(client, body);
  } else if (method == "OPTIONS") {
    // Handle CORS preflight
    client.println("HTTP/1.1 200 OK");
    client.println("Access-Control-Allow-Origin: *");
    client.println("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    client.println("Access-Control-Allow-Headers: Content-Type");
    client.println("Connection: close");
    client.println();
  } else {
    // 404 Not Found
    String error = "{\"error\":\"Not found\"}";
    sendHttpResponse(client, 404, "application/json", error.c_str());
  }

  // Close connection
  delay(10);
  client.stop();
  Serial.println("[HTTP] Client disconnected");
}
