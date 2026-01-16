#ifndef BLE_CONFIG_H
#define BLE_CONFIG_H

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

/**
 * BLE Configuration Service
 *
 * Provides BLE characteristics for device configuration via mobile app:
 * - Status characteristic: Device info, battery level (read + notify)
 * - Config characteristic: WiFi credentials, gateway settings (write)
 *
 * Service UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
 * Status UUID:  beb5483e-36e1-4688-b7f5-ea07361b26a8
 * Config UUID:  beb5483e-36e1-4688-b7f5-ea07361b26a9
 */

// BLE Service and Characteristic UUIDs
#define BLE_SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_STATUS_CHAR_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define BLE_CONFIG_CHAR_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a9"

// BLE device name
#define BLE_DEVICE_NAME         "Mote"

// Initialize BLE config service
void setupBleConfig();

// Handle BLE events in loop()
void handleBleConfig();

// Send device status update via BLE notification
void sendBleStatus();

// Check if BLE client is connected
bool isBleConnected();

// Battery monitoring (forward declarations)
extern float getMoteBatteryVoltage();
extern int getMoteBatteryPercent();

#endif // BLE_CONFIG_H
