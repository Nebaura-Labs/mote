# Hardware Debugging Notes

## Issue 1: RGB LED Pin Discovery - RESOLVED ✓

**Status**: RESOLVED

### Problem
- RGB LED was not responding to neopixelWrite() commands
- Was using RGB_BUILTIN (GPIO48) constant

### Solution
- User discovered RGB LED is on **GPIO38** (J3 PIN 10)
- Changed `#define RGB_LED_PIN 38`
- RGB LED now works perfectly with boot sequence and status indicators

### Verified Working
- ✓ RGB LED boot sequence: Red → Green → Blue
- ✓ WiFi AP status indicator: Green flash
- ✓ Running indicator: Dim green pulse every 2 seconds

---

## Issue 2: Server Initialization Causes Boot Crashes - CRITICAL

**Status**: UNRESOLVED - BLOCKING MOBILE APP CONNECTION

### Symptoms
- Minimal WiFi AP code works perfectly (RGB LED + "Mote" network broadcasting)
- ANY server code causes immediate boot loop
- Device "stuck on boot" - no RGB LED, no WiFi network
- Happens with BOTH WebSocket servers AND HTTP servers
- Even using built-in ESP32 WiFi libraries causes crash

### What Works ✓
```cpp
// Minimal working firmware:
WiFi.mode(WIFI_AP);
WiFi.softAP("Mote");
// RGB LED control with neopixelWrite()
// Simple loop() with delays
```

### What Crashes ✗
1. **WebSocketsServer** (links2004/WebSockets library) - Boot crash
2. **ArduinoWebsockets** (gilmaimon library) - Boot crash
3. **WiFiServer HTTP** (built-in ESP32 library) - Boot crash
4. **ArduinoJson** - May contribute to crashes

### Root Causes Identified
1. **Two WebSocket libraries conflict**: config_server.cpp uses WebSocketsServer, wifi_config.cpp uses ArduinoWebsockets
2. **Global object instantiation**: Server objects created before Arduino framework ready
3. **Memory allocation issues**: PSRAM or heap fragmentation during server init
4. **PlatformIO compiles ALL .cpp in src/**: Must move non-working files to src_backup/

### Files That Cause Crashes
- `src_backup/config_server.cpp` - WebSocket config server
- `src_backup/wifi_config.cpp` - WiFi utilities + WebSocket client
- `src_backup/http_config.cpp` - Simple HTTP server (also crashes!)
- `src_backup/ble_provisioning.cpp` - BLE provisioning (not tested)

### Attempts to Fix
1. ✗ WebSocket server on port 3000 - Boot crash
2. ✗ Simple HTTP server on port 80 (WiFiServer) - Boot crash
3. ✗ Manual JSON building (no ArduinoJson) - Still crashes
4. ✗ Minimal server initialization - Still crashes
5. ✗ Flash erase + clean rebuild - No change

### Critical Blocker
**The mobile app needs to communicate with the device to configure WiFi credentials and Gateway server settings. Without a working server, the device cannot be configured.**

### Alternative Approaches to Consider
1. **BLE (Bluetooth Low Energy)** provisioning
   - More stable on ESP32 than WiFi servers
   - Used by many ESP32 commercial products
   - Library: ESP32 BLE Arduino

2. **mDNS + UDP broadcast**
   - Device broadcasts status via UDP
   - Mobile app sends config via UDP packets
   - No persistent TCP connection needed

3. **ESP-IDF Framework** (instead of Arduino)
   - Lower-level control
   - Better memory management
   - More complex development

4. **Serial/USB configuration**
   - Configure via USB serial port
   - Requires physical connection
   - Not ideal for production

### Board Information
- Board: Freenove ESP32-S3 WROOM N8R8 (8MB Flash / 8MB PSRAM)
- Chip: ESP32-S3 (QFN56) revision v0.2
- MAC: dc:b4:d9:05:28:68
- USB: USB-Serial/JTAG mode
- RGB LED: GPIO38 ✓

### Current Working Firmware
Location: `firmware/src/main.cpp`

```cpp
// Minimal WiFi AP + RGB LED only
// NO server functionality
// ~670KB flash, 43KB RAM
// Stable and reliable
```

### Next Steps
1. Implement BLE provisioning as primary approach
2. Test BLE stability compared to WiFi servers
3. Update mobile app to use BLE instead of HTTP/WebSocket
4. Consider ESP-IDF if BLE also crashes

### Date
2026-01-16 - Updated with server crash findings
