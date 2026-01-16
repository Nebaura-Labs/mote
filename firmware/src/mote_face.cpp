#include "mote_face.h"

// Pin definitions (from docs/display.md)
#define TFT_MOSI  11
#define TFT_SCLK  13
#define TFT_CS    10
#define TFT_DC    9
#define TFT_RST   14
#define TFT_BL    8

// RGB565 Colors
#define COLOR_BLACK   0x0000
#define COLOR_WHITE   0xFFFF
#define COLOR_RED     0xF800
#define COLOR_GREEN   0x07E0
#define COLOR_BLUE    0x001F
#define COLOR_YELLOW  0xFFE0
#define COLOR_CYAN    0x07FF
#define COLOR_ORANGE  0xFD20

// SPI instance
SPIClass *spi = NULL;

// Current face state
FaceState currentState = FACE_IDLE;
unsigned long lastAnimUpdate = 0;
int animFrame = 0;

/**
 * Low-level SPI communication
 */
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

void writeData16(uint16_t data) {
  digitalWrite(TFT_DC, HIGH);
  digitalWrite(TFT_CS, LOW);
  spi->transfer(data >> 8);
  spi->transfer(data & 0xFF);
  digitalWrite(TFT_CS, HIGH);
}

/**
 * Set drawing window
 */
void setWindow(uint16_t x0, uint16_t y0, uint16_t x1, uint16_t y1) {
  writeCommand(0x2A); // CASET
  writeData16(x0);
  writeData16(x1);

  writeCommand(0x2B); // RASET
  writeData16(y0);
  writeData16(y1);

  writeCommand(0x2C); // RAMWR
}

/**
 * Fill entire screen with color
 */
void fillScreen(uint16_t color) {
  setWindow(0, 0, SCREEN_WIDTH - 1, SCREEN_HEIGHT - 1);

  digitalWrite(TFT_DC, HIGH);
  digitalWrite(TFT_CS, LOW);

  uint8_t hi = color >> 8;
  uint8_t lo = color & 0xFF;

  for (uint32_t i = 0; i < (SCREEN_WIDTH * SCREEN_HEIGHT); i++) {
    spi->transfer(hi);
    spi->transfer(lo);
  }

  digitalWrite(TFT_CS, HIGH);
}

/**
 * Fill rectangle with color
 */
void fillRect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t color) {
  if (x + w > SCREEN_WIDTH) w = SCREEN_WIDTH - x;
  if (y + h > SCREEN_HEIGHT) h = SCREEN_HEIGHT - y;

  setWindow(x, y, x + w - 1, y + h - 1);

  digitalWrite(TFT_DC, HIGH);
  digitalWrite(TFT_CS, LOW);

  uint8_t hi = color >> 8;
  uint8_t lo = color & 0xFF;

  for (uint32_t i = 0; i < (w * h); i++) {
    spi->transfer(hi);
    spi->transfer(lo);
  }

  digitalWrite(TFT_CS, HIGH);
}

/**
 * Draw a simple happy face (initial implementation)
 */
void drawSimpleFace() {
  // Left eye (white oval)
  fillRect(80, 80, 50, 60, COLOR_WHITE);
  // Left pupil
  fillRect(95, 95, 20, 30, COLOR_BLUE);

  // Right eye (white oval)
  fillRect(190, 80, 50, 60, COLOR_WHITE);
  // Right pupil
  fillRect(205, 95, 20, 30, COLOR_BLUE);

  // Happy mouth (orange smile)
  fillRect(120, 160, 80, 15, COLOR_ORANGE);
}

/**
 * Initialize display hardware
 */
void setupFaceDisplay() {
  Serial.println("[Face] Initializing display...");

  // Setup GPIO pins
  pinMode(TFT_BL, OUTPUT);
  pinMode(TFT_CS, OUTPUT);
  pinMode(TFT_DC, OUTPUT);
  pinMode(TFT_RST, OUTPUT);

  digitalWrite(TFT_CS, HIGH);
  digitalWrite(TFT_DC, HIGH);
  digitalWrite(TFT_BL, HIGH); // Backlight ON

  // Initialize SPI with HSPI bus (CRITICAL for ESP32-S3 custom pins!)
  spi = new SPIClass(HSPI);
  spi->begin(TFT_SCLK, -1, TFT_MOSI, -1);
  spi->setFrequency(40000000); // 40MHz
  spi->setDataMode(SPI_MODE0);
  spi->setBitOrder(MSBFIRST);

  Serial.println("[Face] SPI initialized at 40MHz");

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

  // Inversion on (required for ST7789)
  writeCommand(0x21); // INVON

  // Display on
  writeCommand(0x29); // DISPON
  delay(100);

  Serial.println("[Face] ST7789V initialized (320x240 landscape)");

  // Draw initial face
  fillScreen(COLOR_BLACK);
  drawSimpleFace();
}

/**
 * Update face animation
 */
void updateFaceAnimation() {
  unsigned long now = millis();

  // Update at 10 FPS (simple for now)
  if (now - lastAnimUpdate < 100) return;
  lastAnimUpdate = now;
  animFrame++;

  // Simple blink every 3 seconds
  if (animFrame % 30 == 0) {
    // Close eyes (fill with black)
    fillRect(80, 80, 50, 60, COLOR_BLACK);
    fillRect(190, 80, 50, 60, COLOR_BLACK);
    delay(100);

    // Reopen eyes
    fillRect(80, 80, 50, 60, COLOR_WHITE);
    fillRect(95, 95, 20, 30, COLOR_BLUE);
    fillRect(190, 80, 50, 60, COLOR_WHITE);
    fillRect(205, 95, 20, 30, COLOR_BLUE);
  }
}

/**
 * Set face state
 */
void setFaceState(FaceState state) {
  if (currentState == state) return;
  currentState = state;

  fillScreen(COLOR_BLACK);

  switch (state) {
    case FACE_HAPPY:
      // Big eyes, wide smile
      fillRect(70, 70, 60, 70, COLOR_WHITE);
      fillRect(90, 90, 20, 30, COLOR_BLUE);
      fillRect(190, 70, 60, 70, COLOR_WHITE);
      fillRect(210, 90, 20, 30, COLOR_BLUE);
      fillRect(110, 160, 100, 20, COLOR_ORANGE);
      break;

    case FACE_SLEEPING:
      // Closed eyes (horizontal lines)
      fillRect(80, 110, 50, 5, COLOR_WHITE);
      fillRect(190, 110, 50, 5, COLOR_WHITE);
      // Small mouth
      fillRect(140, 170, 40, 5, COLOR_ORANGE);
      break;

    case FACE_SURPRISED:
      // Wide eyes
      fillRect(70, 70, 60, 70, COLOR_WHITE);
      fillRect(85, 85, 30, 40, COLOR_BLUE);
      fillRect(180, 70, 60, 70, COLOR_WHITE);
      fillRect(195, 85, 30, 40, COLOR_BLUE);
      // Round mouth
      fillRect(140, 150, 40, 40, COLOR_ORANGE);
      break;

    default: // FACE_IDLE
      drawSimpleFace();
      break;
  }

  Serial.printf("[Face] State: %d\n", state);
}

/**
 * Draw battery indicator
 */
void drawBatteryIndicator(int percent, bool charging) {
  int x = SCREEN_WIDTH - 50;
  int y = 10;

  // Battery outline (white)
  fillRect(x, y, 40, 20, COLOR_BLACK); // Clear area first

  // Draw outline
  fillRect(x, y, 40, 2, COLOR_WHITE); // Top
  fillRect(x, y + 18, 40, 2, COLOR_WHITE); // Bottom
  fillRect(x, y, 2, 20, COLOR_WHITE); // Left
  fillRect(x + 38, y, 2, 20, COLOR_WHITE); // Right
  fillRect(x + 40, y + 6, 3, 8, COLOR_WHITE); // Tip

  // Fill based on percentage
  uint16_t fillColor = COLOR_GREEN;
  if (percent < 25) fillColor = COLOR_RED;
  else if (percent < 75) fillColor = COLOR_YELLOW;

  if (charging) fillColor = COLOR_CYAN;

  int fillWidth = (36 * percent) / 100;
  if (fillWidth > 0) {
    fillRect(x + 2, y + 2, fillWidth, 16, fillColor);
  }
}

/**
 * Simple animations
 */
void blinkEyes() {
  fillRect(80, 80, 50, 60, COLOR_BLACK);
  fillRect(190, 80, 50, 60, COLOR_BLACK);
  delay(150);
  fillRect(80, 80, 50, 60, COLOR_WHITE);
  fillRect(95, 95, 20, 30, COLOR_BLUE);
  fillRect(190, 80, 50, 60, COLOR_WHITE);
  fillRect(205, 95, 20, 30, COLOR_BLUE);
}

void lookLeft() {
  fillRect(80, 80, 50, 60, COLOR_WHITE);
  fillRect(85, 95, 20, 30, COLOR_BLUE);
  fillRect(190, 80, 50, 60, COLOR_WHITE);
  fillRect(195, 95, 20, 30, COLOR_BLUE);
}

void lookRight() {
  fillRect(80, 80, 50, 60, COLOR_WHITE);
  fillRect(105, 95, 20, 30, COLOR_BLUE);
  fillRect(190, 80, 50, 60, COLOR_WHITE);
  fillRect(215, 95, 20, 30, COLOR_BLUE);
}

void waveAnimation() {
  lookLeft();
  delay(300);
  drawSimpleFace();
  delay(200);
  lookRight();
  delay(300);
  drawSimpleFace();
}

/**
 * Draw WiFi status indicator (top left corner)
 */
void drawWifiStatus(bool connected) {
  int x = 8;
  int y = 8;
  uint16_t color = connected ? COLOR_GREEN : COLOR_RED;

  // Clear area first
  fillRect(x, y, 24, 20, COLOR_BLACK);

  // Draw WiFi text "Wi"
  fillRect(x, y, 2, 16, color);             // W left
  fillRect(x, y + 14, 4, 2, color);         // W bottom-left
  fillRect(x + 4, y + 8, 2, 8, color);      // W middle
  fillRect(x + 6, y + 14, 4, 2, color);     // W bottom-right
  fillRect(x + 10, y, 2, 16, color);        // W right

  fillRect(x + 14, y, 2, 16, color);        // i stem
  fillRect(x + 14, y - 2, 2, 2, color);     // i dot
}

/**
 * Draw Gateway status indicator (next to WiFi)
 */
void drawGatewayStatus(bool connected) {
  int x = 42;  // Right next to WiFi
  int y = 8;
  uint16_t color = connected ? COLOR_GREEN : COLOR_RED;

  // Clear area first
  fillRect(x, y, 30, 20, COLOR_BLACK);

  // Draw "GW" text
  fillRect(x, y, 2, 16, color);             // G left
  fillRect(x, y, 10, 2, color);             // G top
  fillRect(x, y + 14, 10, 2, color);        // G bottom
  fillRect(x + 8, y + 7, 2, 9, color);      // G right
  fillRect(x + 5, y + 7, 5, 2, color);      // G middle

  fillRect(x + 14, y, 2, 16, color);        // W left
  fillRect(x + 14, y + 14, 4, 2, color);    // W bottom-left
  fillRect(x + 18, y + 8, 2, 8, color);     // W middle
  fillRect(x + 20, y + 14, 4, 2, color);    // W bottom-right
  fillRect(x + 24, y, 2, 16, color);        // W right
}
