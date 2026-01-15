# Mote Hardware Wiring Diagram

## Overview

This document contains the complete wiring specification for the Mote AI voice assistant hardware prototype.

**Breadboard:** 63 columns, Column 1 on RIGHT (USB side), Column 63 on LEFT  
**Top half:** rows a-e | **Bottom half:** rows f-j | **Center gap** between e and f

---

## Components List

| Component | Model | Specs |
|-----------|-------|-------|
| Microcontroller | ESP32-S3-WROOM | Dual-core, WiFi, Bluetooth |
| Microphone | INMP441 | I2S digital mic, 3.3V |
| Amplifier | MAX98357A | I2S DAC + 3W Class D amp, 5V |
| Speaker | Generic | 3W |
| Display | Waveshare ST7789 | 240x320 IPS LCD, SPI, 3.3V |
| Battery Charger | TP4056 | USB-C LiPo charger |
| Battery | LiPo | 3.7V 2000mAh |
| Resistors | 100kΩ x2 | For voltage divider |

---

## Component Placement

| Component | Rows | Columns | Notes |
|-----------|------|---------|-------|
| **ESP32-S3** | b & i | 1-22 | USB port on RIGHT (column 1 side) |
| **INMP441 Mic** | e & f | 35-37 | Straddles center gap. Row e: L/R, WS, SCK. Row f: GND, VDD, SD |
| **MAX98357A Amp** | e | 45-51 | Pins in row e, screw terminal hangs over bottom half |
| **TP4056 Charger** | a | 58-63 | OUT+:58, B+:59, (gap 60-61), B-:62, OUT-:63. USB-C hangs off left edge |
| **Resistors (100kΩ x2)** | e | 55-57 | Voltage divider: R1(55-56), R2(56-57) |
| **ST7789 Display** | Various | Various | Connected via ribbon cable with male-to-male adapters |
| **Speaker (3W)** | N/A | N/A | Soldered to amp screw terminal |
| **LiPo Battery** | N/A | 59, 62 | Red→d59 (B+), Black→c62 (B-) |

---

## ESP32-S3 Pinout

### Row b (Top row of ESP32) - Columns 1→22 from right to left

| Col | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 |
|-----|---|---|---|---|---|---|---|---|---|----|----|----|----|----|----|----|----|----|----|----|----|-----|
| **GPIO** | GND | GND | 19 | 20 | 21 | 47 | 48 | 45 | 0 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 2 | 1 | RX | TX | GND |

### Row i (Bottom row of ESP32) - Columns 1→22 from right to left

| Col | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 |
|-----|---|---|---|---|---|---|---|---|---|----|----|----|----|----|----|----|----|----|----|----|----|-----|
| **GPIO** | GND | 5V | 14 | 13 | 12 | 11 | 10 | 9 | 46 | 3 | 8 | 18 | 17 | 16 | 15 | 7 | 6 | 5 | 4 | RST | 3V3 | 3V3 |

---

## Power Rails

| Rail | Voltage | Source | Components Powered |
|------|---------|--------|-------------------|
| Top + rail | 3.3V | j21 (ESP32 3V3) | Microphone, Display |
| Top - rail | GND | a1 (ESP32 GND) | All grounds |
| Bottom + rail | 5V | j2 (ESP32 5V) | Amplifier, TP4056 OUT+ |
| Bottom - rail | GND | j1 (ESP32 GND) | All grounds |

**Note:** Top and bottom GND rails are bridged together.

---

## Complete Wiring Specification

### Power Rails

| From | To | Wire Color |
|------|----|------------|
| j21 (3V3) | Top + rail | 🔴 Red |
| a1 (GND) | Top - rail | ⚫ Black |
| j2 (5V) | Bottom + rail | 🔴 Red |
| j1 (GND) | Bottom - rail | ⚫ Black |
| Top - rail | Bottom - rail | ⚫ Black (bridge) |

### INMP441 Microphone (I2S Input)

**Power:** 3.3V (⚠️ Do NOT use 5V - will damage mic!)

| Mic Pin | Mic Location | Wire From | Wire To | Wire Color | ESP32 GPIO |
|---------|--------------|-----------|---------|------------|------------|
| L/R | e35 | c35 | Top - rail (GND) | ⚫ Black | N/A (selects left channel) |
| GND | f35 | h35 | Top - rail (GND) | 🔘 Grey | GND |
| VDD | f36 | h36 | Top + rail (3.3V) | 🔴 Red | 3.3V |
| WS | e36 | c36 | a10 | 🟡 Yellow | **GPIO 35** |
| SCK | e37 | c37 | a11 | 🟢 Green | **GPIO 36** |
| SD | f37 | h37 | a12 | 🔵 Blue | **GPIO 37** |

### MAX98357A Amplifier (I2S Output)

**Power:** 5V  
**Output:** 3W max  
**Pins (columns 45-51):** LRC(45), BCLK(46), DIN(47), GAIN(48), SD(49), GND(50), VIN(51)

| Amp Pin | Amp Location | Wire From | Wire To | Wire Color | ESP32 GPIO |
|---------|--------------|-----------|---------|------------|------------|
| VIN | e51 | c51 | Bottom + rail (5V) | 🔴 Red | 5V |
| GND | e50 | c50 | Bottom - rail (GND) | 🔘 Grey | GND |
| BCLK | e46 | c46 | j14 | 🟠 Orange | **GPIO 16** |
| LRC | e45 | c45 | j13 | 🟣 Purple | **GPIO 17** |
| DIN | e47 | c47 | j12 | ⚪ White | **GPIO 18** |
| GAIN | e48 | - | Not connected | - | Default 9dB gain |
| SD | e49 | - | Not connected | - | Amp always on |

### Speaker (3W)

| Speaker | Connects To | Notes |
|---------|-------------|-------|
| + (positive) | Amp screw terminal + (right) | Soldered male pin to speaker pad |
| - (negative) | Amp screw terminal - (left) | Soldered male pin to speaker pad |

### TP4056 Charger Module

**Input:** 5V via USB-C  
**Output:** 4.2V max (LiPo charging voltage)  
**Pin Layout:** OUT+(58), B+(59), gap(60-61), B-(62), OUT-(63)

| TP4056 Pin | Location | Wire From | Wire To | Wire Color |
|------------|----------|-----------|---------|------------|
| OUT+ | a58 | c58 | Bottom + rail (5V) | 🟢 Green |
| OUT- | a63 | c63 | Bottom - rail (GND) | 🔘 Grey |
| B+ | a59 | d59 | Battery + (red wire) | Battery Red |
| B- | a62 | c62 | Battery - (black wire) | Battery Black |

### Battery Voltage Divider

**Purpose:** Divide battery voltage (4.2V max) to safe level for ESP32 ADC (3.3V max)  
**Resistors:** Two 100kΩ in series  
**Formula:** V_out = V_in × (R2 / (R1 + R2)) = 4.2V × (100kΩ / 200kΩ) = 2.1V

| Component | From | To | Wire Color |
|-----------|------|-----|------------|
| Wire from B+ | c59 | c55 | 🔵 Blue |
| Resistor 1 (100kΩ) | e55 | e56 | Component |
| Resistor 2 (100kΩ) | d56 | d57 | Component |
| Wire to GND | c57 | Top - rail (GND) | 🔘 Grey |
| Wire to ADC | c56 (junction) | a17 | 🟣 Purple |

**ADC Pin:** GPIO 2 (column 17, row a/b)

### ST7789 Display (SPI)

**Power:** 3.3V  
**Resolution:** 240x320  
**Interface:** SPI

| Display Pin | Wire To | Wire Color | ESP32 GPIO |
|-------------|---------|------------|------------|
| VCC | j22 (3V3) | 🟣 Purple | 3.3V |
| GND | Bottom - rail (col 30) | ⚪ White | GND |
| DIN (MOSI) | j6 | 🟢 Green | **GPIO 11** |
| CLK (SCK) | j4 | 🟠 Orange | **GPIO 13** |
| CS | j7 | 🟡 Yellow | **GPIO 10** |
| DC | j8 | 🔵 Blue | **GPIO 9** |
| RST | j3 | 🟤 Brown/Olive | **GPIO 14** |
| BL (Backlight) | j11 | ⚪ White | **GPIO 8** |

### LiPo Battery (3.7V 2000mAh)

| Battery Wire | Connects To | Notes |
|--------------|-------------|-------|
| Red (+) | d59 (TP4056 B+ column) | Male pin inserted into JST connector |
| Black (-) | c62 (TP4056 B- column) | Male pin inserted into JST connector |

---

## GPIO Pin Summary (For Code)

### Microphone (I2S Input)
```c
#define I2S_MIC_WS      35
#define I2S_MIC_SCK     36
#define I2S_MIC_SD      37
```

### Amplifier (I2S Output)
```c
#define I2S_AMP_BCLK    16
#define I2S_AMP_LRC     17
#define I2S_AMP_DIN     18
```

### Display (SPI)
```c
#define TFT_MOSI        11
#define TFT_SCLK        13
#define TFT_CS          10
#define TFT_DC          9
#define TFT_RST         14
#define TFT_BL          8
```

### Battery Monitoring (ADC)
```c
#define BATTERY_ADC_PIN 2

// Voltage calculation (with voltage divider)
// ADC reads 0-4095 for 0-3.3V
// Actual battery voltage = ADC_voltage * 2
// Battery full = 4.2V → ADC reads ~2.1V → ~2600 raw
// Battery empty = 3.0V → ADC reads ~1.5V → ~1860 raw
```

---

## Hardware Specifications

| Component | Voltage | Current (max) | Power |
|-----------|---------|---------------|-------|
| ESP32-S3 | 3.3V / 5V | 500mA | ~1.5W |
| INMP441 Mic | 3.3V | 1.4mA | 5mW |
| MAX98357A Amp | 5V | 650mA | 3W (output) |
| ST7789 Display | 3.3V | 40mA | 130mW |
| TP4056 Charger | 5V input | 1A (charging) | N/A |
| LiPo Battery | 3.7V nominal | 2000mAh capacity | 7.4Wh |

---

## Important Warnings

⚠️ **Microphone Power:** INMP441 uses 3.3V ONLY. Connecting to 5V will permanently damage it!

⚠️ **Battery Safety:** Never short the battery terminals. Always double-check polarity before connecting.

⚠️ **Display Power:** ST7789 uses 3.3V logic. Do not connect to 5V signals.

---

## I2S Configuration Notes

### Microphone (INMP441)
- **Protocol:** I2S, Philips standard
- **Sample Rate:** 16000 Hz recommended for voice
- **Bits per Sample:** 32 (24-bit data in 32-bit frame)
- **Channel:** Left (L/R pin connected to GND)

### Amplifier (MAX98357A)
- **Protocol:** I2S, Philips standard
- **Sample Rate:** Supports 8kHz - 96kHz
- **Bits per Sample:** 16 or 32
- **Gain:** 9dB default (GAIN pin floating)

---

## SPI Configuration Notes

### Display (ST7789)
- **SPI Mode:** Mode 0 (CPOL=0, CPHA=0)
- **Max SPI Clock:** 80MHz
- **Color Format:** RGB565 (16-bit)
- **Resolution:** 240x320 pixels

---

## File Information

**Project:** Mote AI Voice Assistant  
**Company:** Nebaura  
**Version:** 1.0  
**Date:** January 2025
