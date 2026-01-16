# Button Control Documentation

## Overview

The Mote features **3 tactile buttons** for physical controls (planned feature - not yet wired in current prototype):
- **Volume Up**
- **Volume Down**
- **Mute/Unmute**

## Pin Configuration

```cpp
// Buttons are active LOW (pressed = LOW, released = HIGH)
#define BTN_VOL_UP    33  // Volume Up button (planned)
#define BTN_VOL_DOWN  27  // Volume Down button (planned)
#define BTN_MUTE      12  // Mute toggle button (planned)
```

**Note:** These pins are planned but not yet implemented in the current hardware prototype.

## Hardware Setup

Buttons should be wired as:
- One side → GPIO pin
- Other side → GND
- Use `INPUT_PULLUP` mode (internal pull-up resistor)

**Circuit Diagram:**
```
3.3V
  |
  R (20kΩ internal pull-up)
  |
  +---- GPIO Pin (reads HIGH when not pressed)
  |
[Button]
  |
 GND (reads LOW when pressed)
```

## Basic Button Reading

### Setup

```cpp
void setupButtons() {
  pinMode(BTN_VOL_UP, INPUT_PULLUP);
  pinMode(BTN_VOL_DOWN, INPUT_PULLUP);
  pinMode(BTN_MUTE, INPUT_PULLUP);
}
```

### Simple Reading

```cpp
bool isButtonPressed(uint8_t pin) {
  return digitalRead(pin) == LOW;  // Active LOW
}

void checkButtons() {
  if (isButtonPressed(BTN_VOL_UP)) {
    increaseVolume();
  }

  if (isButtonPressed(BTN_VOL_DOWN)) {
    decreaseVolume();
  }

  if (isButtonPressed(BTN_MUTE)) {
    toggleMute();
  }
}
```

## Debouncing

Mechanical buttons "bounce" - they rapidly switch between HIGH and LOW when pressed. Debouncing prevents multiple false triggers.

### Software Debounce

```cpp
#define DEBOUNCE_DELAY 50  // 50ms debounce time

struct Button {
  uint8_t pin;
  bool lastState;
  bool currentState;
  unsigned long lastDebounceTime;
};

Button btnVolUp = {BTN_VOL_UP, HIGH, HIGH, 0};
Button btnVolDown = {BTN_VOL_DOWN, HIGH, HIGH, 0};
Button btnMute = {BTN_MUTE, HIGH, HIGH, 0};

bool readButtonDebounced(Button* btn) {
  bool reading = digitalRead(btn->pin);

  // Reset debounce timer if state changed
  if (reading != btn->lastState) {
    btn->lastDebounceTime = millis();
  }

  // Check if enough time has passed
  if ((millis() - btn->lastDebounceTime) > DEBOUNCE_DELAY) {
    // Update current state if it changed
    if (reading != btn->currentState) {
      btn->currentState = reading;

      // Return true if button was just pressed (HIGH -> LOW transition)
      if (btn->currentState == LOW) {
        btn->lastState = reading;
        return true;
      }
    }
  }

  btn->lastState = reading;
  return false;
}
```

### Using Debounced Buttons

```cpp
void loop() {
  if (readButtonDebounced(&btnVolUp)) {
    Serial.println("Volume Up pressed!");
    increaseVolume();
  }

  if (readButtonDebounced(&btnVolDown)) {
    Serial.println("Volume Down pressed!");
    decreaseVolume();
  }

  if (readButtonDebounced(&btnMute)) {
    Serial.println("Mute toggled!");
    toggleMute();
  }
}
```

## Long Press Detection

Detect if a button is held down:

```cpp
#define LONG_PRESS_TIME 1000  // 1 second

struct ButtonLongPress {
  Button btn;
  unsigned long pressStartTime;
  bool longPressTriggered;
};

ButtonLongPress btnMuteLong = {{BTN_MUTE, HIGH, HIGH, 0}, 0, false};

void checkLongPress(ButtonLongPress* btnLP) {
  bool pressed = (digitalRead(btnLP->btn.pin) == LOW);

  if (pressed && btnLP->btn.currentState == HIGH) {
    // Button just pressed
    btnLP->pressStartTime = millis();
    btnLP->longPressTriggered = false;
  }

  if (pressed) {
    unsigned long pressDuration = millis() - btnLP->pressStartTime;

    if (pressDuration >= LONG_PRESS_TIME && !btnLP->longPressTriggered) {
      // Long press detected
      btnLP->longPressTriggered = true;
      onLongPress();
    }
  }

  btnLP->btn.currentState = pressed ? LOW : HIGH;
}

void onLongPress() {
  Serial.println("Long press detected!");
  // E.g., Enter settings mode
  enterSettingsMode();
}
```

## Button Events

More sophisticated event system with callbacks:

```cpp
enum ButtonEvent {
  BTN_EVENT_NONE,
  BTN_EVENT_PRESSED,
  BTN_EVENT_RELEASED,
  BTN_EVENT_CLICKED,
  BTN_EVENT_LONG_PRESS
};

typedef void (*ButtonCallback)(uint8_t pin, ButtonEvent event);

class ButtonHandler {
private:
  uint8_t pin;
  bool lastState;
  bool currentState;
  unsigned long pressTime;
  unsigned long releaseTime;
  bool longPressTriggered;
  ButtonCallback callback;

public:
  ButtonHandler(uint8_t p, ButtonCallback cb) {
    pin = p;
    callback = cb;
    lastState = HIGH;
    currentState = HIGH;
    pressTime = 0;
    releaseTime = 0;
    longPressTriggered = false;
    pinMode(pin, INPUT_PULLUP);
  }

  void update() {
    bool reading = digitalRead(pin);

    // Button pressed (HIGH -> LOW)
    if (reading == LOW && currentState == HIGH) {
      pressTime = millis();
      longPressTriggered = false;
      if (callback) callback(pin, BTN_EVENT_PRESSED);
    }

    // Button released (LOW -> HIGH)
    else if (reading == HIGH && currentState == LOW) {
      releaseTime = millis();
      unsigned long pressDuration = releaseTime - pressTime;

      if (callback) callback(pin, BTN_EVENT_RELEASED);

      // Click if released before long press
      if (pressDuration < LONG_PRESS_TIME && !longPressTriggered) {
        if (callback) callback(pin, BTN_EVENT_CLICKED);
      }
    }

    // Check for long press while held
    else if (reading == LOW && currentState == LOW) {
      unsigned long pressDuration = millis() - pressTime;

      if (pressDuration >= LONG_PRESS_TIME && !longPressTriggered) {
        longPressTriggered = true;
        if (callback) callback(pin, BTN_EVENT_LONG_PRESS);
      }
    }

    currentState = reading;
  }
};

// Button event handler
void onButtonEvent(uint8_t pin, ButtonEvent event) {
  switch (pin) {
    case BTN_VOL_UP:
      if (event == BTN_EVENT_CLICKED) increaseVolume();
      break;

    case BTN_VOL_DOWN:
      if (event == BTN_EVENT_CLICKED) decreaseVolume();
      break;

    case BTN_MUTE:
      if (event == BTN_EVENT_CLICKED) toggleMute();
      else if (event == BTN_EVENT_LONG_PRESS) enterSettingsMode();
      break;
  }
}

// Create button handlers
ButtonHandler volUpBtn(BTN_VOL_UP, onButtonEvent);
ButtonHandler volDownBtn(BTN_VOL_DOWN, onButtonEvent);
ButtonHandler muteBtn(BTN_MUTE, onButtonEvent);

void loop() {
  volUpBtn.update();
  volDownBtn.update();
  muteBtn.update();
}
```

## Volume Control

```cpp
uint8_t volume = 50;  // 0-100
bool muted = false;

void increaseVolume() {
  if (volume < 100) {
    volume += 5;
    if (volume > 100) volume = 100;

    Serial.print("Volume: ");
    Serial.println(volume);

    // Update audio system
    setAudioVolume(volume);

    // Show volume bar on display
    showVolumeIndicator(volume);
  }
}

void decreaseVolume() {
  if (volume > 0) {
    volume -= 5;
    if (volume < 0) volume = 0;

    Serial.print("Volume: ");
    Serial.println(volume);

    setAudioVolume(volume);
    showVolumeIndicator(volume);
  }
}

void toggleMute() {
  muted = !muted;

  if (muted) {
    Serial.println("Muted");
    setAudioVolume(0);
    showMuteIcon();
  } else {
    Serial.println("Unmuted");
    setAudioVolume(volume);
    hideMuteIcon();
  }
}
```

## Visual Feedback

Show button actions on the display:

```cpp
void showVolumeIndicator(uint8_t vol) {
  // Draw volume bar at bottom of screen
  fillRect(0, 220, 320, 20, COLOR_BLACK);  // Clear area

  int barWidth = (vol * 300) / 100;  // Scale to 300 pixels
  fillRect(10, 225, barWidth, 10, COLOR_GREEN);

  // Auto-hide after 2 seconds
  // (Use timer to clear display)
}

void showMuteIcon() {
  // Draw mute icon in corner
  fillRect(280, 10, 30, 30, COLOR_RED);
  // Draw "X" or speaker icon
}

void hideMuteIcon() {
  fillRect(280, 10, 30, 30, COLOR_BLACK);
}
```

## Interrupt-Based Reading

For better responsiveness, use interrupts:

```cpp
volatile bool volUpPressed = false;
volatile bool volDownPressed = false;
volatile bool mutePressed = false;

void IRAM_ATTR volUpISR() {
  volUpPressed = true;
}

void IRAM_ATTR volDownISR() {
  volDownPressed = true;
}

void IRAM_ATTR muteISR() {
  mutePressed = true;
}

void setupButtonInterrupts() {
  pinMode(BTN_VOL_UP, INPUT_PULLUP);
  pinMode(BTN_VOL_DOWN, INPUT_PULLUP);
  pinMode(BTN_MUTE, INPUT_PULLUP);

  attachInterrupt(BTN_VOL_UP, volUpISR, FALLING);
  attachInterrupt(BTN_VOL_DOWN, volDownISR, FALLING);
  attachInterrupt(BTN_MUTE, muteISR, FALLING);
}

void loop() {
  if (volUpPressed) {
    volUpPressed = false;
    delay(50);  // Simple debounce
    if (digitalRead(BTN_VOL_UP) == LOW) {
      increaseVolume();
    }
  }

  if (volDownPressed) {
    volDownPressed = false;
    delay(50);
    if (digitalRead(BTN_VOL_DOWN) == LOW) {
      decreaseVolume();
    }
  }

  if (mutePressed) {
    mutePressed = false;
    delay(50);
    if (digitalRead(BTN_MUTE) == LOW) {
      toggleMute();
    }
  }
}
```

## Multi-Click Detection

Detect double-click or triple-click:

```cpp
#define MULTI_CLICK_TIMEOUT 300  // 300ms between clicks

uint8_t clickCount = 0;
unsigned long lastClickTime = 0;

void onButtonClick(uint8_t pin) {
  unsigned long now = millis();

  if (now - lastClickTime < MULTI_CLICK_TIMEOUT) {
    clickCount++;
  } else {
    clickCount = 1;
  }

  lastClickTime = now;

  // Wait for timeout to determine final click count
  // (Use timer or check in loop)
}

void checkMultiClick() {
  if (clickCount > 0 && (millis() - lastClickTime) >= MULTI_CLICK_TIMEOUT) {
    switch (clickCount) {
      case 1:
        Serial.println("Single click");
        toggleMute();
        break;
      case 2:
        Serial.println("Double click");
        skipTrack();
        break;
      case 3:
        Serial.println("Triple click");
        activateVoiceCommand();
        break;
    }
    clickCount = 0;
  }
}
```

## Button Combinations

Detect multiple buttons pressed simultaneously:

```cpp
void checkButtonCombos() {
  bool volUpHeld = (digitalRead(BTN_VOL_UP) == LOW);
  bool volDownHeld = (digitalRead(BTN_VOL_DOWN) == LOW);
  bool muteHeld = (digitalRead(BTN_MUTE) == LOW);

  // Volume Up + Volume Down = Reset to 50%
  if (volUpHeld && volDownHeld) {
    volume = 50;
    setAudioVolume(volume);
    Serial.println("Volume reset to 50%");
    delay(500);  // Prevent multiple triggers
  }

  // All three buttons = Factory reset
  if (volUpHeld && volDownHeld && muteHeld) {
    Serial.println("Factory reset!");
    factoryReset();
    delay(1000);
  }
}
```

## Troubleshooting

### Button Not Responding

1. **Check wiring:** Verify button connected between GPIO and GND
2. **Check pinMode:** Must be `INPUT_PULLUP`
3. **Check for shorts:** Button shouldn't be permanently connected to GND
4. **Test with multimeter:** Verify continuity when pressed

### Button Triggers Multiple Times

1. **Add debouncing:** Use 50ms debounce delay
2. **Check for noise:** Add 0.1µF capacitor across button
3. **Use interrupts carefully:** Debounce in ISR or use polling

### Buttons Conflict with Other Pins

1. **Check pin assignments:** Some GPIO pins have special functions
2. **Avoid strapping pins:** GPIO 0, 46 used for boot mode
3. **Check pin conflicts:** Ensure not used by SPI/I2S

## Future Enhancements

- [ ] Capacitive touch buttons (quieter, more reliable)
- [ ] Rotary encoder for volume control
- [ ] Gesture recognition (swipe patterns)
- [ ] Haptic feedback (vibration motor)

## Resources

- [ESP32-S3 GPIO Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/gpio.html)
- [Button Debouncing Guide](https://www.arduino.cc/en/Tutorial/BuiltInExamples/Debounce)
