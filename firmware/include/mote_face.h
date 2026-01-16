#ifndef MOTE_FACE_H
#define MOTE_FACE_H

#include <Arduino.h>
#include <SPI.h>

/**
 * Mote Face Display System
 *
 * Animated mascot face for 2" IPS LCD (240x320 ST7789V)
 * Features expressive eyes, mouth animations, and battery indicator
 */

// Display dimensions (landscape mode: 320x240)
#define SCREEN_WIDTH  320
#define SCREEN_HEIGHT 240

// Face states
enum FaceState {
  FACE_IDLE,       // Default calm expression
  FACE_HAPPY,      // Happy/excited
  FACE_LISTENING,  // Listening (attentive)
  FACE_THINKING,   // Processing/thinking
  FACE_SPEAKING,   // Speaking/responding
  FACE_SLEEPING,   // Low power/sleep
  FACE_SURPRISED,  // Surprised/alert
  FACE_ERROR       // Error state
};

// Eye expressions
enum EyeExpression {
  EYES_NORMAL,
  EYES_HAPPY,
  EYES_SLEEPY,
  EYES_WIDE,
  EYES_SQUINT,
  EYES_CLOSED
};

// Battery indicator colors
#define BATTERY_HIGH   TFT_GREEN
#define BATTERY_MED    TFT_YELLOW
#define BATTERY_LOW    TFT_RED
#define BATTERY_CHARGE TFT_CYAN

// Initialize face display system
void setupFaceDisplay();

// Update face state (smooth transition)
void setFaceState(FaceState state);

// Animate the face (call in loop)
void updateFaceAnimation();

// Draw battery indicator in corner
void drawBatteryIndicator(int percent, bool charging);

// Draw WiFi status indicator (top left)
void drawWifiStatus(bool connected);

// Draw Gateway status indicator (top right, next to battery)
void drawGatewayStatus(bool connected);

// Quick expressions
void blinkEyes();
void lookLeft();
void lookRight();
void waveAnimation();

#endif // MOTE_FACE_H
