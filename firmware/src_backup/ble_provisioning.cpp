#include "ble_provisioning.h"
#include "wifi_config.h"
#include <Preferences.h>

// BLE Server and Characteristics
static NimBLEServer* pServer = nullptr;
static NimBLECharacteristic* pSSIDCharacteristic = nullptr;
static NimBLECharacteristic* pPasswordCharacteristic = nullptr;
static NimBLECharacteristic* pStatusCharacteristic = nullptr;

// State
bool bleProvisioning = false;
bool bleConnected = false;

// Preferences for persistent storage
Preferences preferences;

// Temporary storage for credentials during BLE config
static char tempSSID[32] = "";
static char tempPassword[64] = "";
static bool credentialsReceived = false;

/**
 * BLE Server Callbacks
 */
class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer) {
    bleConnected = true;
    Serial.println("[BLE] Client connected");
  }

  void onDisconnect(NimBLEServer* pServer) {
    bleConnected = false;
    Serial.println("[BLE] Client disconnected");

    // Restart advertising
    if (bleProvisioning) {
      NimBLEDevice::startAdvertising();
      Serial.println("[BLE] Restarted advertising");
    }
  }
};

/**
 * SSID Characteristic Callback
 */
class SSIDCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pCharacteristic) {
    std::string value = pCharacteristic->getValue();

    if (value.length() > 0 && value.length() < 32) {
      strncpy(tempSSID, value.c_str(), sizeof(tempSSID) - 1);
      tempSSID[sizeof(tempSSID) - 1] = '\0';
      Serial.printf("[BLE] Received SSID: %s\n", tempSSID);

      // Check if we have both credentials
      if (strlen(tempPassword) > 0) {
        credentialsReceived = true;
      }
    }
  }
};

/**
 * Password Characteristic Callback
 */
class PasswordCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pCharacteristic) {
    std::string value = pCharacteristic->getValue();

    if (value.length() < 64) {
      strncpy(tempPassword, value.c_str(), sizeof(tempPassword) - 1);
      tempPassword[sizeof(tempPassword) - 1] = '\0';
      Serial.printf("[BLE] Received password (length: %d)\n", value.length());

      // Check if we have both credentials
      if (strlen(tempSSID) > 0) {
        credentialsReceived = true;
      }
    }
  }
};

/**
 * Initialize BLE for WiFi provisioning
 */
void setupBLE() {
  Serial.println("[BLE] Initializing BLE provisioning...");

  // Initialize NimBLE
  NimBLEDevice::init("Mote");
  NimBLEDevice::setPower(ESP_PWR_LVL_P9); // Max power

  // Create BLE Server
  pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  // Create BLE Service
  NimBLEService* pService = pServer->createService(SERVICE_UUID);

  // Create SSID Characteristic (Write)
  pSSIDCharacteristic = pService->createCharacteristic(
    WIFI_SSID_UUID,
    NIMBLE_PROPERTY::WRITE
  );
  pSSIDCharacteristic->setCallbacks(new SSIDCallbacks());

  // Create Password Characteristic (Write)
  pPasswordCharacteristic = pService->createCharacteristic(
    WIFI_PASSWORD_UUID,
    NIMBLE_PROPERTY::WRITE
  );
  pPasswordCharacteristic->setCallbacks(new PasswordCallbacks());

  // Create Status Characteristic (Read/Notify)
  pStatusCharacteristic = pService->createCharacteristic(
    WIFI_STATUS_UUID,
    NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
  );
  pStatusCharacteristic->setValue("waiting");

  // Start the service
  pService->start();

  // Start advertising
  NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMaxPreferred(0x12);
  NimBLEDevice::startAdvertising();

  bleProvisioning = true;
  Serial.println("[BLE] Provisioning mode active - device is discoverable as 'Mote'");
}

/**
 * Stop BLE provisioning
 */
void stopBLE() {
  if (!bleProvisioning) return;

  Serial.println("[BLE] Stopping BLE provisioning...");

  NimBLEDevice::stopAdvertising();
  if (pServer) {
    pServer->disconnect(0);
  }
  NimBLEDevice::deinit(true);

  bleProvisioning = false;
  bleConnected = false;

  Serial.println("[BLE] BLE stopped");
}

/**
 * Check if BLE provisioning is active
 */
bool isBLEProvisioning() {
  return bleProvisioning;
}

/**
 * Handle BLE events (call in loop)
 */
void handleBLE() {
  if (!bleProvisioning) return;

  // Check if we received credentials
  if (credentialsReceived) {
    credentialsReceived = false;

    Serial.println("[BLE] Processing received credentials...");

    // Try to connect to WiFi
    pStatusCharacteristic->setValue("connecting");
    pStatusCharacteristic->notify();

    bool connected = connectToWiFi(tempSSID, tempPassword);

    if (connected) {
      Serial.println("[BLE] WiFi connection successful!");

      // Save credentials
      saveWiFiCredentials(tempSSID, tempPassword);

      // Update status
      pStatusCharacteristic->setValue("connected");
      pStatusCharacteristic->notify();

      // Give time for notification to send
      delay(1000);

      // Stop BLE provisioning
      stopBLE();

      Serial.println("[BLE] Provisioning complete!");
    } else {
      Serial.println("[BLE] WiFi connection failed!");

      pStatusCharacteristic->setValue("failed");
      pStatusCharacteristic->notify();

      // Clear temp credentials
      memset(tempSSID, 0, sizeof(tempSSID));
      memset(tempPassword, 0, sizeof(tempPassword));
    }
  }
}

/**
 * Save WiFi credentials to flash
 */
bool saveWiFiCredentials(const char* ssid, const char* password) {
  preferences.begin("wifi", false);

  bool success = true;
  success &= preferences.putString("ssid", ssid);
  success &= preferences.putString("password", password);

  preferences.end();

  if (success) {
    Serial.println("[Storage] WiFi credentials saved to flash");
  } else {
    Serial.println("[Storage] Failed to save WiFi credentials");
  }

  return success;
}

/**
 * Load WiFi credentials from flash
 */
bool loadWiFiCredentials(char* ssid, char* password) {
  preferences.begin("wifi", true); // Read-only

  String storedSSID = preferences.getString("ssid", "");
  String storedPassword = preferences.getString("password", "");

  preferences.end();

  if (storedSSID.length() > 0) {
    strncpy(ssid, storedSSID.c_str(), 31);
    ssid[31] = '\0';

    strncpy(password, storedPassword.c_str(), 63);
    password[63] = '\0';

    Serial.printf("[Storage] Loaded WiFi credentials: SSID=%s\n", ssid);
    return true;
  }

  Serial.println("[Storage] No WiFi credentials found in flash");
  return false;
}

/**
 * Clear WiFi credentials from flash
 */
void clearWiFiCredentials() {
  preferences.begin("wifi", false);
  preferences.clear();
  preferences.end();

  Serial.println("[Storage] WiFi credentials cleared");
}

/**
 * Check if WiFi credentials exist in flash
 */
bool hasWiFiCredentials() {
  preferences.begin("wifi", true);
  String ssid = preferences.getString("ssid", "");
  preferences.end();

  return ssid.length() > 0;
}
