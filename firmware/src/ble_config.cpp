#include "ble_config.h"
#include "audio.h"
#include <WiFi.h>
#include <Preferences.h>

Preferences preferences;

// BLE Server and Characteristics
BLEServer* bleServer = nullptr;
BLECharacteristic* statusCharacteristic = nullptr;
BLECharacteristic* configCharacteristic = nullptr;
bool bleClientConnected = false;

// WiFi configuration (to be set via BLE)
char configuredWifiSsid[32] = "";
char configuredWifiPassword[64] = "";
char configuredGatewayServer[128] = "";
uint16_t configuredGatewayPort = 3000;
char configuredGatewayToken[128] = "";

/**
 * BLE Server Callbacks
 */
class ServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        bleClientConnected = true;
        Serial.println("[BLE] Client connected");
    }

    void onDisconnect(BLEServer* pServer) {
        bleClientConnected = false;
        Serial.println("[BLE] Client disconnected");

        // Restart advertising so another client can connect
        BLEDevice::startAdvertising();
        Serial.println("[BLE] Advertising restarted");
    }
};

/**
 * Config Characteristic Callbacks
 * Handles incoming configuration from mobile app
 */
class ConfigCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pCharacteristic) {
        std::string value = pCharacteristic->getValue();

        if (value.length() > 0) {
            Serial.printf("[BLE] Received config: %s\n", value.c_str());

            // Parse simple JSON manually
            String json = String(value.c_str());

            // Check if this is a volume command (format: {"volume":50})
            int volumeStart = json.indexOf("\"volume\":");
            if (volumeStart >= 0) {
                volumeStart += 9;
                String volumeStr = json.substring(volumeStart);
                int volumeEnd = volumeStr.indexOf(",");
                if (volumeEnd == -1) volumeEnd = volumeStr.indexOf("}");
                if (volumeEnd > 0) {
                    int volume = volumeStr.substring(0, volumeEnd).toInt();
                    if (volume >= 0 && volume <= 100) {
                        setVolume((uint8_t)volume);
                        Serial.printf("[BLE] Volume set to %d%%\n", volume);
                        // Send updated status with new volume
                        sendBleStatus();
                    }
                }
                return; // Volume command handled, don't process as config
            }

            // Regular WiFi/Gateway config (format: {"ssid":"...","password":"...","server":"...","port":3000})

            // Extract SSID
            int ssidStart = json.indexOf("\"ssid\":\"") + 8;
            int ssidEnd = json.indexOf("\"", ssidStart);
            if (ssidStart > 7 && ssidEnd > ssidStart) {
                String ssid = json.substring(ssidStart, ssidEnd);
                strncpy(configuredWifiSsid, ssid.c_str(), sizeof(configuredWifiSsid) - 1);
                configuredWifiSsid[sizeof(configuredWifiSsid) - 1] = '\0';
            }

            // Extract password
            int pwdStart = json.indexOf("\"password\":\"") + 12;
            int pwdEnd = json.indexOf("\"", pwdStart);
            if (pwdStart > 11 && pwdEnd > pwdStart) {
                String password = json.substring(pwdStart, pwdEnd);
                strncpy(configuredWifiPassword, password.c_str(), sizeof(configuredWifiPassword) - 1);
                configuredWifiPassword[sizeof(configuredWifiPassword) - 1] = '\0';
            }

            // Extract server
            int serverStart = json.indexOf("\"server\":\"") + 10;
            int serverEnd = json.indexOf("\"", serverStart);
            if (serverStart > 9 && serverEnd > serverStart) {
                String server = json.substring(serverStart, serverEnd);
                strncpy(configuredGatewayServer, server.c_str(), sizeof(configuredGatewayServer) - 1);
                configuredGatewayServer[sizeof(configuredGatewayServer) - 1] = '\0';
            }

            // Extract port
            int portStart = json.indexOf("\"port\":") + 7;
            if (portStart > 6) {
                String portStr = json.substring(portStart);
                int portEnd = portStr.indexOf(",");
                if (portEnd == -1) portEnd = portStr.indexOf("}");
                if (portEnd > 0) {
                    configuredGatewayPort = portStr.substring(0, portEnd).toInt();
                }
            }

            // Extract token
            int tokenStart = json.indexOf("\"token\":\"") + 9;
            int tokenEnd = json.indexOf("\"", tokenStart);
            if (tokenStart > 8 && tokenEnd > tokenStart) {
                String token = json.substring(tokenStart, tokenEnd);
                strncpy(configuredGatewayToken, token.c_str(), sizeof(configuredGatewayToken) - 1);
                configuredGatewayToken[sizeof(configuredGatewayToken) - 1] = '\0';
            }

            Serial.printf("[BLE] Parsed config - SSID: %s, Server: %s:%d, Token: %s\n",
                         configuredWifiSsid, configuredGatewayServer, configuredGatewayPort,
                         strlen(configuredGatewayToken) > 0 ? "[SET]" : "[EMPTY]");

            // Save config to NVS (persistent storage)
            preferences.begin("mote", false);
            preferences.putString("wifi_ssid", configuredWifiSsid);
            preferences.putString("wifi_password", configuredWifiPassword);
            preferences.putString("gw_server", configuredGatewayServer);
            preferences.putUShort("gw_port", configuredGatewayPort);
            preferences.putString("gw_token", configuredGatewayToken);
            preferences.end();
            Serial.println("[BLE] Config saved to flash");

            // Send updated status
            sendBleStatus();

            // Reboot to WiFi mode (BLE and WiFi can't coexist)
            Serial.println("[BLE] Rebooting to WiFi mode...");
            delay(1000); // Give time for BLE notification to send
            ESP.restart();
        }
    }
};

/**
 * Initialize BLE configuration service
 */
void setupBleConfig() {
    Serial.println("[BLE] Initializing BLE...");

    // Load saved config from NVS so we can report it in status messages
    preferences.begin("mote", true); // Read-only
    String ssid = preferences.getString("wifi_ssid", "");
    String password = preferences.getString("wifi_password", "");
    String server = preferences.getString("gw_server", "");
    uint16_t port = preferences.getUShort("gw_port", 3000);
    String token = preferences.getString("gw_token", "");
    preferences.end();

    strncpy(configuredWifiSsid, ssid.c_str(), sizeof(configuredWifiSsid) - 1);
    configuredWifiSsid[sizeof(configuredWifiSsid) - 1] = '\0';
    strncpy(configuredWifiPassword, password.c_str(), sizeof(configuredWifiPassword) - 1);
    configuredWifiPassword[sizeof(configuredWifiPassword) - 1] = '\0';
    strncpy(configuredGatewayServer, server.c_str(), sizeof(configuredGatewayServer) - 1);
    configuredGatewayServer[sizeof(configuredGatewayServer) - 1] = '\0';
    configuredGatewayPort = port;
    strncpy(configuredGatewayToken, token.c_str(), sizeof(configuredGatewayToken) - 1);
    configuredGatewayToken[sizeof(configuredGatewayToken) - 1] = '\0';

    Serial.printf("[BLE] Loaded config - SSID: %s, Server: %s:%d\n",
                  configuredWifiSsid, configuredGatewayServer, configuredGatewayPort);

    // Initialize BLE FIRST (before WiFi to avoid conflicts)
    BLEDevice::init(BLE_DEVICE_NAME);

    // Create BLE Server
    bleServer = BLEDevice::createServer();
    bleServer->setCallbacks(new ServerCallbacks());

    // Create BLE Service
    BLEService* service = bleServer->createService(BLE_SERVICE_UUID);

    // Create Status Characteristic (Read + Notify)
    statusCharacteristic = service->createCharacteristic(
        BLE_STATUS_CHAR_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    statusCharacteristic->addDescriptor(new BLE2902());

    // Create Config Characteristic (Write)
    configCharacteristic = service->createCharacteristic(
        BLE_CONFIG_CHAR_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    configCharacteristic->setCallbacks(new ConfigCallbacks());

    // Start the service
    service->start();

    // Start advertising
    BLEAdvertising* advertising = BLEDevice::getAdvertising();
    advertising->addServiceUUID(BLE_SERVICE_UUID);
    advertising->setScanResponse(true);
    advertising->setMinPreferred(0x06);  // helps with iPhone connections
    advertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();

    Serial.println("[BLE] BLE service started and advertising");
    Serial.printf("[BLE] Device name: %s\n", BLE_DEVICE_NAME);
    Serial.printf("[BLE] Service UUID: %s\n", BLE_SERVICE_UUID);
}

/**
 * Handle BLE events in loop()
 */
void handleBleConfig() {
    // BLE library handles events automatically
    // Just send periodic status updates if connected
    static unsigned long lastStatusUpdate = 0;

    if (bleClientConnected && millis() - lastStatusUpdate > 5000) {
        sendBleStatus();
        lastStatusUpdate = millis();
    }
}

/**
 * Send device status via BLE notification
 */
void sendBleStatus() {
    if (!bleClientConnected || statusCharacteristic == nullptr) {
        return;
    }

    // Build JSON status manually
    bool wifiConnected = (WiFi.status() == WL_CONNECTED);
    bool gatewayConnected = false; // TODO: Track actual Gateway WebSocket connection state
    String status = "{";
    status += "\"type\":\"status\",";
    status += "\"deviceId\":\"" + String(WiFi.macAddress()) + "\",";
    status += "\"firmwareVersion\":\"1.0.0\",";
    status += "\"batteryPercent\":" + String(getMoteBatteryPercent()) + ",";
    status += "\"batteryVoltage\":" + String(getMoteBatteryVoltage(), 2) + ",";
    status += "\"volume\":" + String(getVolume()) + ",";
    status += "\"wifiConfigured\":" + String(strlen(configuredWifiSsid) > 0 ? "true" : "false") + ",";
    status += "\"wifiConnected\":" + String(wifiConnected ? "true" : "false") + ",";
    status += "\"wifiSsid\":\"" + String(configuredWifiSsid) + "\",";
    status += "\"gatewayConfigured\":" + String(strlen(configuredGatewayServer) > 0 ? "true" : "false") + ",";
    status += "\"gatewayConnected\":" + String(gatewayConnected ? "true" : "false") + ",";
    status += "\"gatewayServer\":\"" + String(configuredGatewayServer) + "\",";
    status += "\"gatewayPort\":" + String(configuredGatewayPort);
    status += "}";

    statusCharacteristic->setValue(status.c_str());
    statusCharacteristic->notify();

    Serial.printf("[BLE] Sent status update (%d bytes)\n", status.length());
}

/**
 * Check if BLE client is connected
 */
bool isBleConnected() {
    return bleClientConnected;
}
