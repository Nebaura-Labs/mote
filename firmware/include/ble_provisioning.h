#ifndef BLE_PROVISIONING_H
#define BLE_PROVISIONING_H

#include <NimBLEDevice.h>

// BLE UUIDs for WiFi Provisioning
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define WIFI_SSID_UUID      "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define WIFI_PASSWORD_UUID  "1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e"
#define WIFI_STATUS_UUID    "d8de624e-140f-4a32-b0f2-1c8e1e4e9c8d"

// BLE Provisioning state
extern bool bleProvisioning;
extern bool bleConnected;

// Functions
void setupBLE();
void stopBLE();
bool isBLEProvisioning();
void handleBLE();

// WiFi credential storage
bool saveWiFiCredentials(const char* ssid, const char* password);
bool loadWiFiCredentials(char* ssid, char* password);
void clearWiFiCredentials();
bool hasWiFiCredentials();

#endif // BLE_PROVISIONING_H
