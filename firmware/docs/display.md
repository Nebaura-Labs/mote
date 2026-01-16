# Display Module Documentation

## Overview

The Mote uses a **Waveshare 2" IPS LCD Module** with an ST7789V controller. The display is controlled via hardware SPI at 40MHz for fast rendering of animated faces.

**Specifications:**
- **Resolution:** 320×240 pixels (landscape orientation)
- **Controller:** ST7789V
- **Interface:** 4-wire SPI
- **Color Format:** RGB565 (16-bit, 65,536 colors)
- **Viewing Angle:** 170°
- **Brightness:** Controllable via backlight pin
- **Power:** 3.3V logic and power

## Pin Configuration

```cpp
#define TFT_MOSI  11  // SPI Data Out (Green wire -> Display DIN)
#define TFT_SCLK  13  // SPI Clock (Orange wire -> Display CLK)
#define TFT_CS    10  // Chip Select (Yellow wire -> Display CS)
#define TFT_DC    9   // Data/Command (Blue wire -> Display DC)
#define TFT_RST   14  // Reset (Brown wire -> Display RST)
#define TFT_BL    8   // Backlight (White wire -> Display BL)
```

**Physical Connections (from wiring diagram):**
- **VCC** → j22 (ESP32 3.3V) via Purple wire
- **GND** → Bottom GND rail via White wire
- **DIN** → j6 (GPIO 11) via Green wire
- **CLK** → j4 (GPIO 13) via Orange wire
- **CS** → j7 (GPIO 10) via Yellow wire
- **DC** → j8 (GPIO 9) via Blue wire
- **RST** → j3 (GPIO 14) via Brown/Olive wire
- **BL** → j11 (GPIO 8) via White wire

## Hardware SPI Initialization

**CRITICAL:** The ESP32-S3 requires explicit HSPI bus initialization for custom pins to work correctly.

```cpp
#include <SPI.h>

SPIClass *spi = NULL;

void setup() {
  // Setup GPIO pins
  pinMode(TFT_BL, OUTPUT);
  pinMode(TFT_CS, OUTPUT);
  pinMode(TFT_DC, OUTPUT);
  pinMode(TFT_RST, OUTPUT);

  digitalWrite(TFT_CS, HIGH);
  digitalWrite(TFT_DC, HIGH);
  digitalWrite(TFT_BL, HIGH);

  // Initialize SPI with HSPI bus and custom pins
  spi = new SPIClass(HSPI);
  spi->begin(TFT_SCLK, -1, TFT_MOSI, -1);
  spi->setFrequency(40000000); // 40MHz
  spi->setDataMode(SPI_MODE0);
  spi->setBitOrder(MSBFIRST);

  // Initialize display
  initDisplay();
}
```

**Why HSPI?** The default `SPI.begin()` does not work correctly with custom pins on ESP32-S3. You must explicitly create a new `SPIClass(HSPI)` instance.

## Display Initialization

```cpp
void initDisplay() {
  // Hardware reset
  digitalWrite(TFT_RST, LOW);
  delay(20);
  digitalWrite(TFT_RST, HIGH);
  delay(150);

  // Software reset
  writeCommand(0x01); // SWRESET
  delay(150);

  // Sleep out
  writeCommand(0x11); // SLPOUT
  delay(120);

  // Color mode - 16-bit RGB565
  writeCommand(0x3A); // COLMOD
  writeData(0x55);

  // Memory access control - Landscape mode
  writeCommand(0x36); // MADCTL
  writeData(0x60); // MV=1, MX=1 for 90° rotation

  // Inversion on (required for many ST7789 displays)
  writeCommand(0x21); // INVON

  // Display on
  writeCommand(0x29); // DISPON
  delay(100);
}
```

### MADCTL Values for Different Orientations

```cpp
// Portrait (240×320)
writeData(0x00);

// Landscape (320×240) - Current configuration
writeData(0x60);

// Portrait flipped 180°
writeData(0xC0);

// Landscape flipped 180°
writeData(0xA0);
```

## API Functions

### Low-Level SPI Communication

```cpp
void writeCommand(uint8_t cmd) {
  digitalWrite(TFT_DC, LOW);   // Command mode
  digitalWrite(TFT_CS, LOW);
  spi->transfer(cmd);
  digitalWrite(TFT_CS, HIGH);
}

void writeData(uint8_t data) {
  digitalWrite(TFT_DC, HIGH);  // Data mode
  digitalWrite(TFT_CS, LOW);
  spi->transfer(data);
  digitalWrite(TFT_CS, HIGH);
}
```

### Drawing Functions

#### Fill Entire Screen

```cpp
void fillScreen(uint16_t color);
```

Fills the entire 320×240 screen with a single color.

**Example:**
```cpp
fillScreen(COLOR_BLACK);  // Clear to black
fillScreen(COLOR_WHITE);  // Fill with white
fillScreen(0x07E0);       // Fill with green (RGB565)
```

#### Draw Filled Rectangle

```cpp
void fillRect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t color);
```

Draws a filled rectangle at position (x, y) with width w and height h.

**Example:**
```cpp
// Draw white eye at position (80, 80), size 40×40
fillRect(80, 80, 40, 40, COLOR_WHITE);

// Draw black pupil inside eye
fillRect(90, 90, 20, 20, COLOR_BLACK);
```

#### Draw Single Pixel

```cpp
void drawPixel(uint16_t x, uint16_t y, uint16_t color);
```

Draws a single pixel at position (x, y).

**Example:**
```cpp
drawPixel(160, 120, COLOR_RED);  // Center pixel
```

#### Set Drawing Window

```cpp
void setWindow(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1);
```

Sets the active drawing window for bulk pixel transfers. Used internally by `fillScreen()` and `fillRect()`.

## Color Format (RGB565)

The display uses 16-bit RGB565 format:
- **5 bits Red** (31 levels)
- **6 bits Green** (63 levels)
- **5 bits Blue** (31 levels)

### Pre-defined Colors

```cpp
#define COLOR_BLACK   0x0000
#define COLOR_WHITE   0xFFFF
#define COLOR_RED     0xF800
#define COLOR_GREEN   0x07E0
#define COLOR_BLUE    0x001F
#define COLOR_YELLOW  0xFFE0
#define COLOR_CYAN    0x07FF
#define COLOR_MAGENTA 0xF81F
```

### Creating Custom Colors

```cpp
// Convert RGB888 (8-bit per channel) to RGB565
uint16_t rgb888to565(uint8_t r, uint8_t g, uint8_t b) {
  return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}

// Example: Orange color (255, 165, 0)
uint16_t orange = rgb888to565(255, 165, 0);  // 0xFD20
```

## Backlight Control

The backlight can be controlled via GPIO 8:

```cpp
// Turn backlight on
digitalWrite(TFT_BL, HIGH);

// Turn backlight off
digitalWrite(TFT_BL, LOW);
```

**PWM Brightness Control:**

```cpp
// Setup PWM on backlight pin
ledcSetup(0, 5000, 8);  // Channel 0, 5kHz, 8-bit resolution
ledcAttachPin(TFT_BL, 0);

// Set brightness (0-255)
ledcWrite(0, 128);  // 50% brightness
ledcWrite(0, 255);  // 100% brightness
ledcWrite(0, 32);   // ~12% brightness
```

## Face Animation Guide

### Simple Face Example

```cpp
void drawHappyFace() {
  fillScreen(COLOR_BLACK);

  // Left eye
  fillRect(80, 80, 40, 40, COLOR_WHITE);
  fillRect(90, 90, 20, 20, COLOR_BLACK);

  // Right eye
  fillRect(200, 80, 40, 40, COLOR_WHITE);
  fillRect(210, 90, 20, 20, COLOR_BLACK);

  // Smile (red mouth)
  fillRect(120, 160, 80, 10, COLOR_RED);
}
```

### Blink Animation

```cpp
void blinkEyes() {
  // Close eyes
  fillRect(80, 80, 40, 40, COLOR_BLACK);
  fillRect(200, 80, 40, 40, COLOR_BLACK);
  delay(200);

  // Open eyes
  fillRect(80, 80, 40, 40, COLOR_WHITE);
  fillRect(90, 90, 20, 20, COLOR_BLACK);
  fillRect(200, 80, 40, 40, COLOR_WHITE);
  fillRect(210, 90, 20, 20, COLOR_BLACK);
}
```

### Eye Movement

```cpp
// Move pupil position for "looking around" effect
void lookLeft() {
  // Clear eyes
  fillRect(80, 80, 40, 40, COLOR_WHITE);
  fillRect(200, 80, 40, 40, COLOR_WHITE);

  // Draw pupils on left side of eyes
  fillRect(85, 90, 20, 20, COLOR_BLACK);
  fillRect(205, 90, 20, 20, COLOR_BLACK);
}

void lookRight() {
  // Clear eyes
  fillRect(80, 80, 40, 40, COLOR_WHITE);
  fillRect(200, 80, 40, 40, COLOR_WHITE);

  // Draw pupils on right side of eyes
  fillRect(95, 90, 20, 20, COLOR_BLACK);
  fillRect(215, 90, 20, 20, COLOR_BLACK);
}
```

### Expression States

```cpp
enum FaceExpression {
  FACE_NEUTRAL,
  FACE_HAPPY,
  FACE_SAD,
  FACE_SURPRISED,
  FACE_THINKING,
  FACE_SPEAKING
};

void drawExpression(FaceExpression expr) {
  fillScreen(COLOR_BLACK);

  // Draw eyes (same for all)
  fillRect(80, 80, 40, 40, COLOR_WHITE);
  fillRect(90, 90, 20, 20, COLOR_BLACK);
  fillRect(200, 80, 40, 40, COLOR_WHITE);
  fillRect(210, 90, 20, 20, COLOR_BLACK);

  // Draw mouth based on expression
  switch (expr) {
    case FACE_HAPPY:
      // Smile
      fillRect(120, 160, 80, 10, COLOR_RED);
      break;

    case FACE_SAD:
      // Frown
      fillRect(120, 170, 80, 10, COLOR_RED);
      break;

    case FACE_SURPRISED:
      // Open mouth (circle)
      fillRect(140, 150, 40, 40, COLOR_RED);
      break;

    case FACE_THINKING:
      // Closed line mouth
      fillRect(130, 165, 60, 5, COLOR_RED);
      break;

    case FACE_SPEAKING:
      // Animated mouth - call this repeatedly with different sizes
      fillRect(130, 155, 60, 20, COLOR_RED);
      break;

    default: // FACE_NEUTRAL
      fillRect(130, 165, 60, 5, COLOR_RED);
      break;
  }
}
```

## Performance Tips

1. **Minimize full-screen redraws**: Only redraw changed areas using `fillRect()`
2. **Batch pixel writes**: Use `setWindow()` once and write multiple pixels
3. **Reduce delay()**: Use millis() timing instead of blocking delays for smooth animation
4. **Buffer animations**: Pre-calculate positions before drawing

### Animation Frame Timing

```cpp
unsigned long lastFrame = 0;
const int frameDelay = 50;  // 20 FPS

void loop() {
  unsigned long now = millis();

  if (now - lastFrame >= frameDelay) {
    lastFrame = now;
    // Update and draw animation frame
    updateFaceAnimation();
  }
}
```

## Troubleshooting

### Display Shows Nothing

1. **Check backlight:** Ensure GPIO 8 is HIGH
2. **Verify wiring:** All 8 connections must be correct
3. **Check power:** VCC = 3.3V, GND connected
4. **Verify SPI init:** Must use `SPIClass(HSPI)` not default `SPI`

### Display Shows Wrong Colors

1. **Check inversion:** Try toggling `INVON` / `INVOFF` (0x21 / 0x20)
2. **Check color mode:** Try `writeData(0x08)` in MADCTL for BGR instead of RGB

### Display Rotated Wrong

Change MADCTL value:
- `0x00` = Portrait
- `0x60` = Landscape (90° clockwise)
- `0xC0` = Portrait flipped
- `0xA0` = Landscape flipped

### Slow Drawing

1. **Check SPI frequency:** Should be 40MHz (40000000)
2. **Use hardware SPI:** Never use software bit-bang for normal operation
3. **Optimize drawing:** Avoid full-screen fills, only update changed areas

## ST7789V Command Reference

Common commands used:

| Command | Hex  | Description |
|---------|------|-------------|
| SWRESET | 0x01 | Software reset |
| SLPOUT  | 0x11 | Sleep out (wake from sleep) |
| INVON   | 0x21 | Display inversion on |
| INVOFF  | 0x20 | Display inversion off |
| DISPON  | 0x29 | Display on |
| CASET   | 0x2A | Column address set |
| RASET   | 0x2B | Row address set |
| RAMWR   | 0x2C | Memory write |
| MADCTL  | 0x36 | Memory access control |
| COLMOD  | 0x3A | Interface pixel format |

## Additional Resources

- [ST7789V Datasheet](https://www.waveshare.com/w/upload/a/ae/ST7789_Datasheet.pdf)
- [Waveshare 2inch LCD Module Wiki](https://www.waveshare.com/wiki/2inch_LCD_Module)
- RGB565 Color Picker: http://www.barth-dev.de/online/rgb565-color-picker/
