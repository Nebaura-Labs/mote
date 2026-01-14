# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the firmware for the **Nebaura Labs Mote**, a compact open-source voice assistant device featuring an animated face display on a 2" IPS LCD. The device is built around an ESP32-S3 microcontroller and acts as a hardware terminal for a personal AI companion.

**Key Hardware Components:**
- **MCU:** ESP32-S3 N16R8 DevKit
- **Display:** Waveshare 2" IPS LCD (240×320, ST7789)
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
#define MOTE_TFT_MOSI  23
#define MOTE_TFT_SCLK  18
#define MOTE_TFT_CS    5
#define MOTE_TFT_DC    4
#define MOTE_TFT_RST   2
#define MOTE_TFT_BL    17
```

### Microphone (I2S Input)
```cpp
#define MOTE_MIC_SCK   14
#define MOTE_MIC_WS    32
#define MOTE_MIC_SD    15
```

### Amplifier (I2S Output)
```cpp
#define MOTE_AMP_BCLK  26
#define MOTE_AMP_LRC   25
#define MOTE_AMP_DIN   22
```

### Buttons (Active LOW, use INPUT_PULLUP)
```cpp
#define MOTE_BTN_VOL_UP    33
#define MOTE_BTN_VOL_DOWN  27
#define MOTE_BTN_MUTE      12
```

### Battery Monitor
```cpp
#define MOTE_BATTERY_ADC   34  // Connected via 100kΩ/100kΩ voltage divider
```

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

### Face Animation

The Mote's primary UI is an animated face on the 2" LCD. The face should:
- Express emotion through eye and mouth animations
- Indicate system state (listening, thinking, speaking)
- Show battery level via eye color:
  - Green tint: >75% battery
  - Yellow tint: 25-75% battery
  - Red tint: <25% battery
  - Pulsing: Charging

### Display Libraries

Use either:
- **TFT_eSPI** - Popular, well-documented
- **LovyanGFX** - More performant for animations

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

- **Flash:** ESP32-S3 has 16MB flash (N16R8)
- **RAM:** 8MB PSRAM available
- **Display:** 240×320 pixels, 16-bit color
- **Battery:** Monitor and warn user below 10% to prevent damage
- **Speaker:** 4Ω 3W - limit volume to prevent distortion
