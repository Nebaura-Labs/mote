# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the firmware for the **Nebaura Labs Mote**, a compact open-source voice assistant device featuring an animated face display on a 2" IPS LCD. The device is built around an ESP32-S3 microcontroller and acts as a hardware terminal for a personal AI companion.

**Key Hardware Components:**
- **MCU:** ESP32-S3 N8R8 DevKit (8MB Flash, 8MB PSRAM)
- **Display:** Waveshare 2" IPS LCD (240×320, ST7789V)
- **Audio Input:** INMP441 I2S MEMS microphone
- **Audio Output:** MAX98357A I2S 3W Class D amplifier + speaker
- **Power:** 3.7V 2000mAh LiPo battery with TP4056 USB-C charger
- **Controls:** 3 tactile buttons (Volume Up, Volume Down, Mute)

## Build System

This project uses **PlatformIO** as its build system.

### Common Commands

```bash
# Build the firmware
pio run

# Upload to device
pio run --target upload

# Build and upload
pio run -t upload

# Clean build files
pio run --target clean

# Open serial monitor
pio device monitor

# Build and upload, then monitor
pio run -t upload && pio device monitor

# Run tests
pio test

# Update PlatformIO platform/libraries
pio pkg update
```

### Environment Configuration

The project is configured for `esp32-s3-devkitc-1` in `platformio.ini`. The ESP32-S3 uses the Arduino framework.

## Pin Configuration

**Critical:** All pin assignments must match the hardware wiring specified below.

### Display (SPI)
```cpp
#define TFT_MOSI  11  // Green wire -> Display DIN
#define TFT_SCLK  13  // Orange wire -> Display CLK
#define TFT_CS    10  // Yellow wire -> Display CS
#define TFT_DC    9   // Blue wire -> Display DC
#define TFT_RST   14  // Brown wire -> Display RST
#define TFT_BL    8   // White wire -> Display BL (backlight)
```

**Important:** This display requires hardware SPI using the HSPI bus:
```cpp
spi = new SPIClass(HSPI);
spi->begin(TFT_SCLK, -1, TFT_MOSI, -1);
spi->setFrequency(40000000); // 40MHz
```

See `docs/display.md` for complete usage guide.

### Microphone (I2S Input)
```cpp
// NOTE: GPIO 33-37 are reserved for PSRAM on ESP32-S3 with 8MB PSRAM!
#define I2S_MIC_WS   39  // Yellow wire
#define I2S_MIC_SCK  40  // Green wire
#define I2S_MIC_SD   41  // Blue wire
```

### Amplifier (I2S Output)
```cpp
#define I2S_AMP_BCLK  16  // Orange wire
#define I2S_AMP_LRC   17  // Purple wire
#define I2S_AMP_DIN   18  // White wire
```

### Battery Monitor
```cpp
#define BATTERY_ADC_PIN  2  // Purple wire from voltage divider
```

Connected via 100kΩ/100kΩ voltage divider (divides 4.2V max to 2.1V safe for ADC).

## Architecture

### System Flow

```
Mote Device (Hardware) ←→ Mobile App (Bridge) ←→ AI Gateway (Clawdbot)
```

The Mote handles:
- Wake word detection
- Audio input/output via I2S
- Animated face display rendering
- Physical button controls
- Battery monitoring

The mobile app bridges WiFi/Bluetooth communication to the AI backend.

### Code Organization

```
src/
  main.cpp          # Main firmware entry point
include/            # Project header files
lib/                # Project-specific libraries
test/               # Unit tests
```

## Audio Architecture

### I2S Configuration

The device uses two I2S interfaces:
1. **I2S Input (I2S0):** INMP441 microphone
2. **I2S Output (I2S1):** MAX98357A amplifier

Both must be configured with appropriate sample rates (typically 16kHz for voice).

### Volume Control

Software volume control is implemented by scaling PCM samples:

```cpp
void adjustVolume(int16_t* samples, size_t count) {
    for (size_t i = 0; i < count; i++) {
        samples[i] = (samples[i] * moteVolume) / 100;
    }
}
```

## Display System

**Resolution:** 320×240 (Landscape mode)
**Controller:** ST7789V
**SPI Speed:** 40MHz (hardware HSPI)
**Color Format:** RGB565 (16-bit)

### Face Animation

The Mote's primary UI is an animated face on the 2" LCD. The face should:
- Express emotion through eye and mouth animations
- Indicate system state (listening, thinking, speaking)
- Show battery level via eye color:
  - Green tint: >75% battery
  - Yellow tint: 25-75% battery
  - Red tint: <25% battery
  - Pulsing: Charging

### Display Functions

The firmware includes custom lightweight display functions:
- `fillScreen(color)` - Fill entire screen with a color
- `fillRect(x, y, w, h, color)` - Draw filled rectangle
- `drawPixel(x, y, color)` - Draw single pixel
- `setWindow(x0, y0, x1, y1)` - Set drawing window
- `initDisplay()` - Initialize ST7789V

See `docs/display.md` for complete API and examples.

### Color Definitions

Pre-defined RGB565 colors available:
```cpp
COLOR_BLACK, COLOR_WHITE, COLOR_RED, COLOR_GREEN,
COLOR_BLUE, COLOR_YELLOW, COLOR_CYAN, COLOR_MAGENTA
```

## Battery Management

### Reading Battery Voltage

```cpp
float getMoteBatteryVoltage() {
    int raw = analogRead(MOTE_BATTERY_ADC);
    // 2:1 voltage divider, 3.3V ADC reference
    float voltage = (raw / 4095.0) * 3.3 * 2;
    return voltage;
}

int getMoteBatteryPercent() {
    float v = getMoteBatteryVoltage();
    if (v >= 4.2) return 100;
    if (v <= 3.0) return 0;
    return (int)((v - 3.0) / 1.2 * 100);
}
```

### Power Considerations

- ESP32-S3 runs from TP4056 output (switchable via slide switch)
- Display backlight (GPIO17) should support PWM for brightness control
- Amplifier requires 5V, sourced from USB or battery boost if needed

## Wake Word Detection

The firmware integrates **Picovoice Porcupine** for wake word detection. Audio from the INMP441 microphone is continuously processed for the wake word trigger.

## Common Troubleshooting

| Issue | Solution |
|-------|----------|
| Blank display | Verify BL pin HIGH, check SPI wiring |
| No audio output | Check amplifier 5V power, verify I2S pins |
| Mic not working | Ensure L/R pin connected to GND |
| Buttons not responding | Use INPUT_PULLUP mode |
| Incorrect battery reading | Verify 100kΩ voltage divider |

## Development Workflow

1. Make changes to `src/main.cpp` or add files to `src/`
2. Build with `pio run` to check for compilation errors
3. Upload with `pio run -t upload`
4. Monitor serial output with `pio device monitor` (baud rate auto-configured)
5. For rapid iteration, use `pio run -t upload && pio device monitor`

## Library Dependencies

Key libraries to include in `platformio.ini`:
- TFT_eSPI or LovyanGFX (display)
- ESP32 I2S (built into ESP-IDF)
- WiFi/BLE (built into ESP32 Arduino)
- Picovoice Porcupine (wake word)

## Hardware Constraints

- **Flash:** ESP32-S3 has 8MB flash (N8R8)
- **RAM:** 8MB PSRAM available
- **Display:** 320×240 pixels (landscape), 16-bit RGB565 color, 40MHz SPI
- **Battery:** Monitor and warn user below 10% to prevent damage
- **Speaker:** 4Ω 3W - limit volume to prevent distortion

## Documentation

Detailed component documentation available in `docs/`:
- `docs/display.md` - Display API, SPI configuration, face animation guide
- `docs/audio.md` - I2S microphone and speaker setup
- `docs/battery.md` - Battery monitoring and power management
- `docs/buttons.md` - Button handling and debouncing
