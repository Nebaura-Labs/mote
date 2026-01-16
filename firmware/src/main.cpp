#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include "ble_config.h"
#include "mote_face.h"

// Device mode
enum DeviceMode {
  MODE_BLE,    // BLE configuration mode (no WiFi config saved)
  MODE_WIFI    // WiFi mode (config saved, BLE disabled)
};

DeviceMode currentMode = MODE_BLE;

// WiFi configuration
char wifiSsid[32] = "";
char wifiPassword[64] = "";
char gatewayServer[128] = "";
uint16_t gatewayPort = 3000;
char gatewayToken[128] = "";

#define RGB_LED_PIN 38      // GPIO38 for RGB LED
#define BATTERY_ADC_PIN 2   // GPIO2 for battery monitoring (ADC1_CH1, pin 38)

/**
 * Get battery voltage
 * Uses 2:1 voltage divider (100kΩ/100kΩ)
 */
float getMoteBatteryVoltage() {
  int raw = analogRead(BATTERY_ADC_PIN);
  // 2:1 voltage divider, 3.3V ADC reference, 12-bit ADC (4095 max)
  float voltage = (raw / 4095.0) * 3.3 * 2.0;
  return voltage;
}

/**
 * Get battery percentage (0-100)
 * LiPo: 4.2V = 100%, 3.0V = 0%
 */
int getMoteBatteryPercent() {
  float voltage = getMoteBatteryVoltage();
  if (voltage >= 4.2) return 100;
  if (voltage <= 3.0) return 0;
  return (int)((voltage - 3.0) / 1.2 * 100);
}

void setup() {
  delay(1000);

  // Initialize Serial
  Serial.begin(115200);
  Serial.println("\n[Mote] Starting...");

  // Configure ADC for battery monitoring
  pinMode(BATTERY_ADC_PIN, INPUT);
  analogReadResolution(12);  // 12-bit resolution (0-4095)
  analogSetAttenuation(ADC_11db);  // Full 0-3.3V range

  // Check if WiFi config exists in flash FIRST (before display/BLE init!)
  Preferences prefs;
  prefs.begin("mote", true); // Read-only
  bool hasWifiConfig = prefs.isKey("wifi_ssid");

  // Flash RGB LED to show boot
  neopixelWrite(RGB_LED_PIN, 255, 0, 0);  // Red
  delay(200);
  neopixelWrite(RGB_LED_PIN, 0, 255, 0);  // Green
  delay(200);
  neopixelWrite(RGB_LED_PIN, 0, 0, 255);  // Blue
  delay(200);
  neopixelWrite(RGB_LED_PIN, 0, 0, 0);    // Off

  // Initialize face display (always)
  setupFaceDisplay();
  setFaceState(FACE_SLEEPING);
  delay(500);
  setFaceState(FACE_SURPRISED);
  delay(300);
  waveAnimation();
  setFaceState(FACE_HAPPY);
  delay(500);

  if (hasWifiConfig) {
    // Load WiFi config
    String ssid = prefs.getString("wifi_ssid", "");
    String password = prefs.getString("wifi_password", "");
    String server = prefs.getString("gw_server", "");
    uint16_t port = prefs.getUShort("gw_port", 3000);
    String token = prefs.getString("gw_token", "");

    strncpy(wifiSsid, ssid.c_str(), sizeof(wifiSsid) - 1);
    strncpy(wifiPassword, password.c_str(), sizeof(wifiPassword) - 1);
    strncpy(gatewayServer, server.c_str(), sizeof(gatewayServer) - 1);
    strncpy(gatewayToken, token.c_str(), sizeof(gatewayToken) - 1);
    gatewayPort = port;

    prefs.end();

    // Start in WiFi mode
    currentMode = MODE_WIFI;
    Serial.println("[Mote] WiFi config found - starting in WiFi mode");
    Serial.printf("[WiFi] SSID: %s, Server: %s:%d\n", wifiSsid, gatewayServer, gatewayPort);

    // WiFi will be started in loop() to avoid blocking setup()

  } else {
    prefs.end();

    // Start in BLE mode for configuration
    currentMode = MODE_BLE;
    Serial.println("[Mote] No WiFi config - starting in BLE mode");
  }

  // Initialize BLE (always, for app communication)
  setupBleConfig();

  // Flash blue to show BLE started
  neopixelWrite(RGB_LED_PIN, 0, 0, 255);  // Blue ON
  delay(300);
  neopixelWrite(RGB_LED_PIN, 0, 0, 0);    // Off

  // Face now idle and ready
  setFaceState(FACE_IDLE);

  Serial.printf("[Mote] Setup complete! Mode: %s, Battery: %.2fV (%d%%)\n",
                currentMode == MODE_BLE ? "BLE" : "WiFi",
                getMoteBatteryVoltage(), getMoteBatteryPercent());
}

void loop() {
  // WiFi mode: Start WiFi connection after 2 second delay (once)
  if (currentMode == MODE_WIFI) {
    static bool wifiStarted = false;
    static unsigned long bootTime = millis();

    if (!wifiStarted && (millis() - bootTime > 2000)) {
      Serial.println("[WiFi] Starting WiFi connection...");

      // Disable watchdog timers during WiFi initialization
      disableCore0WDT();
      disableLoopWDT();

      WiFi.mode(WIFI_STA);
      WiFi.begin(wifiSsid, wifiPassword);

      // Give WiFi time to initialize with yields to feed any remaining watchdogs
      for (int i = 0; i < 50; i++) {
        delay(100);
        yield();
      }

      // Re-enable watchdog
      enableCore0WDT();
      enableLoopWDT();

      wifiStarted = true;
      Serial.println("[WiFi] WiFi.begin() complete, checking status...");
    }
  }

  // Handle BLE events (always, for app communication)
  handleBleConfig();

  // BLE mode: Update face based on BLE connection
  if (currentMode == MODE_BLE) {

    // Update face state based on BLE connection
    static bool wasConnected = false;
    bool isConnected = isBleConnected();

    if (isConnected && !wasConnected) {
      // Just connected - happy face!
      setFaceState(FACE_HAPPY);
      neopixelWrite(RGB_LED_PIN, 0, 255, 255);  // Bright cyan
      delay(100);
      neopixelWrite(RGB_LED_PIN, 0, 0, 0);
      delay(1000);
      setFaceState(FACE_IDLE);
    } else if (!isConnected && wasConnected) {
      // Disconnected - back to idle
      setFaceState(FACE_IDLE);
    }

    wasConnected = isConnected;
  }

  // Update face animation (30 FPS)
  updateFaceAnimation();

  // Update status indicators every 5 seconds
  static unsigned long lastStatusUpdate = 0;

  if (millis() - lastStatusUpdate > 5000) {
    // Battery indicator
    int raw = analogRead(BATTERY_ADC_PIN);
    float voltage = getMoteBatteryVoltage();
    int batteryPercent = getMoteBatteryPercent();
    bool charging = false; // TODO: Add charging detection
    Serial.printf("[Battery] Raw ADC: %d, Voltage: %.2fV, Percent: %d%%\n", raw, voltage, batteryPercent);
    drawBatteryIndicator(batteryPercent, charging);

    // WiFi status indicator (only in WiFi mode)
    bool wifiConnected = false;
    if (currentMode == MODE_WIFI) {
      wl_status_t wifiStatus = WiFi.status();
      wifiConnected = (wifiStatus == WL_CONNECTED);

      // Log WiFi status
      const char* statusStr = "";
      switch (wifiStatus) {
        case WL_IDLE_STATUS: statusStr = "IDLE"; break;
        case WL_NO_SSID_AVAIL: statusStr = "NO_SSID"; break;
        case WL_SCAN_COMPLETED: statusStr = "SCAN_COMPLETED"; break;
        case WL_CONNECTED: statusStr = "CONNECTED"; break;
        case WL_CONNECT_FAILED: statusStr = "CONNECT_FAILED"; break;
        case WL_CONNECTION_LOST: statusStr = "CONNECTION_LOST"; break;
        case WL_DISCONNECTED: statusStr = "DISCONNECTED"; break;
        default: statusStr = "UNKNOWN"; break;
      }
      Serial.printf("[WiFi] Status: %s, IP: %s\n", statusStr, WiFi.localIP().toString().c_str());

      drawWifiStatus(wifiConnected);

      // Gateway status indicator (TODO: implement WebSocket connection)
      bool gatewayConnected = false; // TODO: Track Gateway WebSocket state
      drawGatewayStatus(gatewayConnected);
    } else {
      // BLE mode - show disconnected status
      drawWifiStatus(false);
      drawGatewayStatus(false);
    }

    lastStatusUpdate = millis();
  }

  // Subtle LED pulse for status (only in BLE mode)
  if (currentMode == MODE_BLE) {
    static unsigned long lastLedUpdate = 0;
    if (millis() - lastLedUpdate > 2000) {
      bool isConnected = isBleConnected();
      if (isConnected) {
        neopixelWrite(RGB_LED_PIN, 0, 10, 10);  // Very dim cyan (connected)
      } else {
        neopixelWrite(RGB_LED_PIN, 0, 0, 10);   // Very dim blue (advertising)
      }
      delay(50);
      neopixelWrite(RGB_LED_PIN, 0, 0, 0);
      lastLedUpdate = millis();
    }
  }

  delay(10);
}
