# Battery Monitoring Documentation

## Overview

The Mote is powered by a **3.7V 2000mAh LiPo battery** with USB-C charging via a TP4056 charging module. Battery voltage is monitored through a voltage divider connected to the ESP32-S3 ADC.

## Hardware Components

- **Battery:** 3.7V nominal, 2000mAh capacity, JST connector
- **Charger:** TP4056 USB-C LiPo charging module
- **Voltage Divider:** Two 100kΩ resistors in series
- **ADC Pin:** GPIO 2 on ESP32-S3

## Pin Configuration

```cpp
#define BATTERY_ADC_PIN  2  // Purple wire from voltage divider midpoint
```

**Physical Connections (from wiring diagram):**
- **Battery +** → d59 (TP4056 B+ column) via JST red wire
- **Battery -** → c62 (TP4056 B- column) via JST black wire
- **B+ Junction** → c59 → c55 → 100kΩ R1 → c56 (midpoint) → 100kΩ R2 → c57 → GND
- **ADC Wire** → c56 (midpoint) → a17 GPIO 2 (Purple wire)

## Voltage Divider Circuit

The battery voltage (up to 4.2V) is divided in half to stay within the ESP32-S3 ADC safe range (0-3.3V).

```
Battery+ (4.2V max)
    |
    +--- Blue wire ---> c55
    |
   R1 (100kΩ)
    |
    +--- c56 ---> Purple wire ---> GPIO 2 (ADC)
    |
   R2 (100kΩ)
    |
   GND (Grey wire to GND rail)
```

**Formula:**
```
V_out = V_battery × (R2 / (R1 + R2))
V_out = V_battery × (100kΩ / 200kΩ)
V_out = V_battery × 0.5

Max voltage:
V_battery = 4.2V → V_out = 2.1V (safe for ADC)
```

## Reading Battery Voltage

### Basic Reading

```cpp
float readBatteryVoltage() {
  int rawValue = analogRead(BATTERY_ADC_PIN);

  // ESP32-S3 ADC: 0-4095 for 0-3.3V
  float adcVoltage = (rawValue / 4095.0) * 3.3;

  // Multiply by 2 to account for voltage divider
  float batteryVoltage = adcVoltage * 2.0;

  return batteryVoltage;
}
```

### Averaged Reading (More Accurate)

```cpp
float readBatteryVoltageAvg() {
  const int NUM_SAMPLES = 10;
  int sum = 0;

  // Take multiple samples
  for (int i = 0; i < NUM_SAMPLES; i++) {
    sum += analogRead(BATTERY_ADC_PIN);
    delay(10);
  }

  int avgRaw = sum / NUM_SAMPLES;
  float adcVoltage = (avgRaw / 4095.0) * 3.3;
  float batteryVoltage = adcVoltage * 2.0;

  return batteryVoltage;
}
```

## Battery Percentage Calculation

LiPo discharge curve (typical):
- **4.2V** = 100% (fully charged)
- **3.7V** = 50% (nominal voltage)
- **3.0V** = 0% (empty - do not discharge below this!)

```cpp
int getBatteryPercent() {
  float voltage = readBatteryVoltageAvg();

  // Clamp to valid range
  if (voltage >= 4.2) return 100;
  if (voltage <= 3.0) return 0;

  // Linear approximation
  // 100% at 4.2V, 0% at 3.0V
  int percent = (int)((voltage - 3.0) / 1.2 * 100);

  return percent;
}
```

### More Accurate (Non-Linear Curve)

```cpp
int getBatteryPercentAccurate() {
  float voltage = readBatteryVoltageAvg();

  // LiPo discharge curve lookup table
  const float voltages[] = {4.20, 4.15, 4.11, 4.08, 4.02, 3.98, 3.95, 3.91, 3.87, 3.85, 3.84, 3.82, 3.80, 3.79, 3.77, 3.75, 3.73, 3.71, 3.69, 3.61, 3.27, 3.00};
  const int percents[] =   {100,  95,   90,   85,   80,   75,   70,   65,   60,   55,   50,   45,   40,   35,   30,   25,   20,   15,   10,   5,    1,    0};

  // Find closest voltage in table
  for (int i = 0; i < 22; i++) {
    if (voltage >= voltages[i]) {
      if (i == 0) return percents[0];

      // Linear interpolation between two points
      float v1 = voltages[i];
      float v2 = voltages[i - 1];
      int p1 = percents[i];
      int p2 = percents[i - 1];

      int percent = p1 + (voltage - v1) * (p2 - p1) / (v2 - v1);
      return percent;
    }
  }

  return 0;
}
```

## Battery Status

```cpp
enum BatteryStatus {
  BATTERY_CHARGING,
  BATTERY_FULL,
  BATTERY_DISCHARGING,
  BATTERY_LOW,
  BATTERY_CRITICAL
};

BatteryStatus getBatteryStatus() {
  float voltage = readBatteryVoltageAvg();
  int percent = getBatteryPercent();

  // Check if charging (voltage rising above nominal)
  // Note: More sophisticated detection would check voltage over time
  if (voltage > 4.1) {
    return BATTERY_FULL;
  }

  // Critical battery
  if (percent < 5) {
    return BATTERY_CRITICAL;
  }

  // Low battery
  if (percent < 15) {
    return BATTERY_LOW;
  }

  return BATTERY_DISCHARGING;
}
```

## Face Animation Integration

Update face based on battery level:

```cpp
void updateBatteryIndicator() {
  int percent = getBatteryPercent();
  uint16_t eyeColor;

  if (percent > 75) {
    eyeColor = COLOR_GREEN;  // Green tint
  } else if (percent > 25) {
    eyeColor = COLOR_YELLOW;  // Yellow tint
  } else {
    eyeColor = COLOR_RED;  // Red tint - low battery!
  }

  // Blend eye color with white
  // (In actual implementation, you'd draw eyes with this tint)
}
```

### Charging Animation

```cpp
void showChargingAnimation() {
  static int brightness = 0;
  static int direction = 1;

  brightness += direction * 10;

  if (brightness >= 255) {
    brightness = 255;
    direction = -1;
  } else if (brightness <= 50) {
    brightness = 50;
    direction = 1;
  }

  // Pulse eye brightness using PWM
  // Or draw pulsing eyes on display
}
```

## Power Management

### Low Battery Warning

```cpp
void checkBatteryLow() {
  static unsigned long lastCheck = 0;
  const unsigned long CHECK_INTERVAL = 60000;  // Check every minute

  if (millis() - lastCheck >= CHECK_INTERVAL) {
    lastCheck = millis();

    int percent = getBatteryPercent();

    if (percent < 10) {
      // Show low battery warning on face
      showLowBatteryWarning();

      // Send notification to mobile app
      sendBatteryWarning(percent);
    }

    if (percent < 5) {
      // Critical - prepare for shutdown
      prepareForShutdown();
    }
  }
}
```

### Sleep Mode (Power Saving)

```cpp
void enterDeepSleep() {
  // Turn off display backlight
  digitalWrite(TFT_BL, LOW);

  // Configure wake-up sources
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_35, 1);  // Wake on microphone activity

  // Enter deep sleep
  esp_deep_sleep_start();
}
```

## Charging Detection

The TP4056 module has status LEDs but no GPIO output. Detection can be done by monitoring voltage changes:

```cpp
bool isCharging() {
  static float lastVoltage = 0;
  static unsigned long lastCheck = 0;

  if (millis() - lastCheck < 5000) {
    // Don't check too frequently
    return false;
  }

  float currentVoltage = readBatteryVoltageAvg();
  bool charging = false;

  // If voltage is increasing, likely charging
  if (currentVoltage > lastVoltage + 0.05) {
    charging = true;
  }

  lastVoltage = currentVoltage;
  lastCheck = millis();

  return charging;
}
```

## Calibration

ADC readings can vary between ESP32 units. Calibrate for accuracy:

```cpp
// Measure actual battery voltage with multimeter
// Then adjust this offset
const float ADC_CALIBRATION_OFFSET = 0.0;  // Adjust as needed

float readBatteryVoltageCalibrateD() {
  int rawValue = analogRead(BATTERY_ADC_PIN);
  float adcVoltage = (rawValue / 4095.0) * 3.3;
  float batteryVoltage = (adcVoltage * 2.0) + ADC_CALIBRATION_OFFSET;

  return batteryVoltage;
}
```

## Safety Considerations

**Critical Warnings:**

1. **Never discharge below 3.0V** - Damages LiPo permanently
2. **Never charge above 4.2V** - Fire/explosion risk
3. **Monitor temperature** - LiPo should stay cool
4. **Use proper charger** - TP4056 has built-in protection
5. **Never short circuit** - Can cause fire

### Over-Discharge Protection

```cpp
void protectBattery() {
  float voltage = readBatteryVoltageAvg();

  if (voltage < 3.1) {
    // Emergency shutdown to protect battery
    Serial.println("CRITICAL: Battery voltage too low!");
    Serial.println("Shutting down to protect battery...");

    // Show critical warning
    fillScreen(COLOR_RED);
    delay(2000);

    // Turn off everything and deep sleep
    digitalWrite(TFT_BL, LOW);
    esp_deep_sleep_start();
  }
}
```

## Logging and Monitoring

```cpp
void logBatteryStatus() {
  float voltage = readBatteryVoltageAvg();
  int percent = getBatteryPercent();
  BatteryStatus status = getBatteryStatus();

  Serial.print("Battery: ");
  Serial.print(voltage, 2);
  Serial.print("V (");
  Serial.print(percent);
  Serial.print("%) - ");

  switch (status) {
    case BATTERY_CHARGING:   Serial.println("CHARGING"); break;
    case BATTERY_FULL:       Serial.println("FULL"); break;
    case BATTERY_DISCHARGING: Serial.println("DISCHARGING"); break;
    case BATTERY_LOW:        Serial.println("LOW"); break;
    case BATTERY_CRITICAL:   Serial.println("CRITICAL"); break;
  }
}
```

## Troubleshooting

### Incorrect Voltage Reading

1. **Check resistors:** Verify both are 100kΩ
2. **Check connections:** Purple wire to GPIO 2, grey wire to GND
3. **Calibrate ADC:** Add offset to compensate for ADC inaccuracy
4. **Check battery:** Measure with multimeter to verify actual voltage

### Battery Percentage Jumps

1. **Average readings:** Use `readBatteryVoltageAvg()` instead of single read
2. **Filter noise:** Add capacitor (0.1µF) across ADC input
3. **Use discharge curve:** Implement non-linear percentage calculation

### Battery Not Charging

1. **Check USB-C cable:** Some cables are power-only
2. **Check TP4056 LEDs:** Red = charging, Blue = full
3. **Check battery connection:** JST connector properly inserted
4. **Verify polarity:** Red = +, Black = -

## Resources

- [LiPo Battery Discharge Curves](https://learn.adafruit.com/li-ion-and-lipoly-batteries/voltages)
- [TP4056 Datasheet](https://dlnmh9ip6v2uc.cloudfront.net/datasheets/Prototyping/TP4056.pdf)
- [ESP32-S3 ADC Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/adc.html)
