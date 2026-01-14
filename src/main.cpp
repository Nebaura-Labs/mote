#include <Arduino.h>

// ESP32-S3 built-in LED (GPIO48 on most DevKits, GPIO2 on some)
// We'll try GPIO48 first - if it doesn't work, we'll change it
#define LED_PIN 48

void setup() {
  // Start serial communication at 115200 baud
  Serial.begin(115200);

  // Wait a moment for serial to initialize
  delay(1000);

  // Configure LED pin as output
  pinMode(LED_PIN, OUTPUT);

  Serial.println("\n\n=================================");
  Serial.println("   NEBAURA LABS MOTE - TEST");
  Serial.println("=================================");
  Serial.println("Hello from your ESP32-S3!");
  Serial.println("If you see this, your board is working!");
  Serial.println("The LED should blink every second.");
  Serial.println("=================================\n");
}

void loop() {
  // Turn LED on
  digitalWrite(LED_PIN, HIGH);
  Serial.println("LED ON");
  delay(1000);  // Wait 1 second

  // Turn LED off
  digitalWrite(LED_PIN, LOW);
  Serial.println("LED OFF");
  delay(1000);  // Wait 1 second
}