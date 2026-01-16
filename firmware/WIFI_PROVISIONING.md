# WiFi Provisioning via BLE

The Mote firmware now supports WiFi configuration via Bluetooth Low Energy (BLE) from the mobile app.

## How It Works

1. **On first boot** (no WiFi credentials stored):
   - Device enters BLE provisioning mode
   - Display shows "WiFi Setup - Connect via app"
   - Device broadcasts as "Mote" over BLE

2. **Mobile app sends credentials**:
   - User enters WiFi SSID and password in app
   - App sends credentials via BLE
   - Device attempts to connect to WiFi

3. **Connection successful**:
   - Credentials saved to flash memory (Preferences)
   - BLE stops, WiFi connects
   - Device connects to backend WebSocket server

4. **Next boot**:
   - Credentials loaded from flash
   - Auto-connects to WiFi
   - No BLE provisioning needed

## Integration Example

### In `main.cpp` setup():

\`\`\`cpp
#include "ble_provisioning.h"
#include "wifi_config.h"

void setup() {
  Serial.begin(115200);

  // Initialize display
  initDisplay();

  // Check if WiFi credentials exist
  if (hasWiFiCredentials()) {
    // Load saved credentials
    loadWiFiCredentials(WIFI_SSID, WIFI_PASSWORD);

    // Show "Connecting to WiFi..." on display
    fillScreen(COLOR_BLACK);
    fillRect(60, 80, 200, 80, COLOR_YELLOW);

    // Setup WiFi
    setupWiFi();

    // Try to connect
    if (connectToWiFi(WIFI_SSID, WIFI_PASSWORD)) {
      Serial.println("WiFi connected!");

      // Show "WiFi Connected" on display
      fillScreen(COLOR_BLACK);
      fillRect(60, 80, 200, 80, COLOR_GREEN);
      delay(1000);

      // Setup WebSocket
      setupWebSocket();
      connectToWebSocket(WEBSOCKET_SERVER);

    } else {
      Serial.println("WiFi connection failed, entering setup mode");

      // Clear bad credentials
      clearWiFiCredentials();

      // Enter provisioning mode
      setupBLE();

      // Show "WiFi Setup" on display
      fillScreen(COLOR_BLACK);
      fillRect(60, 80, 200, 80, COLOR_CYAN);
    }

  } else {
    // No credentials, enter provisioning mode
    Serial.println("No WiFi credentials, entering setup mode");

    setupBLE();

    // Show "WiFi Setup" on display
    fillScreen(COLOR_BLACK);
    fillRect(60, 80, 200, 80, COLOR_CYAN);
  }
}

void loop() {
  // Handle BLE provisioning
  if (isBLEProvisioning()) {
    handleBLE();
  }

  // Handle WebSocket messages
  if (websocketConnected) {
    handleWebSocketMessages();
  }

  // Your other code here...
}
\`\`\`

## BLE Service UUIDs

The device exposes a BLE service with these characteristics:

- **Service UUID**: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **SSID Characteristic** (Write): `beb5483e-36e1-4688-b7f5-ea07361b26a8`
- **Password Characteristic** (Write): `1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e`
- **Status Characteristic** (Read/Notify): `d8de624e-140f-4a32-b0f2-1c8e1e4e9c8d`

## Mobile App Integration

The mobile app needs to:

1. Scan for BLE device named "Mote"
2. Connect to device
3. Find service with UUID `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
4. Write SSID to characteristic `beb5483e-36e1-4688-b7f5-ea07361b26a8`
5. Write password to characteristic `1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e`
6. Subscribe to status characteristic `d8de624e-140f-4a32-b0f2-1c8e1e4e9c8d`
7. Wait for status notification:
   - `"connecting"` - Attempting WiFi connection
   - `"connected"` - Success! BLE will disconnect
   - `"failed"` - Connection failed, try again

## Storage

WiFi credentials are stored in ESP32 NVS (Non-Volatile Storage) using the Preferences library:
- **Namespace**: `"wifi"`
- **Keys**: `"ssid"` and `"password"`

## Functions

### Provisioning
- `setupBLE()` - Start BLE provisioning mode
- `stopBLE()` - Stop BLE provisioning
- `handleBLE()` - Process BLE events (call in loop)
- `isBLEProvisioning()` - Check if provisioning is active

### Storage
- `saveWiFiCredentials(ssid, password)` - Save to flash
- `loadWiFiCredentials(ssid, password)` - Load from flash
- `hasWiFiCredentials()` - Check if credentials exist
- `clearWiFiCredentials()` - Erase saved credentials

## Display States

Suggested color codes for display:
- **CYAN**: WiFi Setup mode (BLE active)
- **YELLOW**: Connecting to WiFi
- **GREEN**: WiFi connected
- **RED**: WiFi connection failed
- **BLUE**: Normal operation (WebSocket connected)

## Security Notes

⚠️ **Important**: WiFi password is transmitted in plaintext over BLE. For production:
1. Use BLE pairing/bonding
2. Encrypt the password before transmission
3. Implement proper BLE security (MITM protection)

For development/prototype, this is sufficient.
