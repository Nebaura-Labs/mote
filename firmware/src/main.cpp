#include <Arduino.h>
#include <TFT_eSPI.h>
#include <driver/i2s.h>
#include "wifi_config.h"

// Display pins
#define TFT_CS    10
#define TFT_DC    9
#define TFT_RST   14
#define TFT_BL    8
#define TFT_MOSI  11
#define TFT_SCLK  13

// Microphone I2S pins (from wiring diagram)
#define I2S_MIC_WS   35  // Yellow wire - Word Select
#define I2S_MIC_SCK  36  // Green wire - Bit Clock
#define I2S_MIC_SD   37  // Blue wire - Serial Data

// Amplifier I2S pins (from wiring diagram)
#define I2S_AMP_BCLK  16  // Orange wire - Bit Clock
#define I2S_AMP_LRC   17  // Purple wire - Left/Right Clock
#define I2S_AMP_DIN   18  // White wire - Data In
#define I2S_AMP_SD    4   // Shutdown pin (LOW = shutdown, HIGH = enabled)
                          // Connect wire from amp SD pin (e49) to GPIO 4

// Display dimensions defined in platformio.ini (Landscape mode: 320x240)

// ST7789 commands
#define ST7789_SWRESET 0x01
#define ST7789_SLPOUT  0x11
#define ST7789_COLMOD  0x3A
#define ST7789_MADCTL  0x36
#define ST7789_CASET   0x2A
#define ST7789_RASET   0x2B
#define ST7789_RAMWR   0x2C
#define ST7789_DISPON  0x29
#define ST7789_INVON   0x21

// RGB565 colors (TFT_eSPI compatible)
#define COLOR_BLACK   TFT_BLACK
#define COLOR_WHITE   TFT_WHITE
#define COLOR_RED     TFT_RED
#define COLOR_GREEN   TFT_GREEN
#define COLOR_BLUE    TFT_BLUE
#define COLOR_YELLOW  TFT_YELLOW
#define COLOR_CYAN    TFT_CYAN

// I2S config
#define I2S_MIC_NUM     I2S_NUM_0  // Microphone on I2S0
#define I2S_SPK_NUM     I2S_NUM_1  // Speaker on I2S1
#define SAMPLE_RATE     16000
#define BUFFER_SIZE     1024

// Voice activity detection
#define VOICE_THRESHOLD 300.0     // RMS level to detect voice
#define SILENCE_DURATION 1500     // ms of silence before stopping recording (increased from 1000)
#define MIN_RECORDING_SAMPLES 8000 // Minimum 0.5 seconds at 16kHz before allowing stop
#define MAX_RECORDING_TIME 10000  // Max 10 seconds of recording

// Recording buffer (10 seconds at 16kHz) - allocated in PSRAM
#define MAX_SAMPLES (SAMPLE_RATE * 10)
int16_t* recordingBuffer = NULL;
int recordingLength = 0;

enum RecorderState {
  STATE_IDLE,
  STATE_RECORDING,
  STATE_PLAYING
};

RecorderState state = STATE_IDLE;
RecorderState lastState = STATE_IDLE;
unsigned long lastVoiceTime = 0;

TFT_eSPI tft = TFT_eSPI();

// Display functions now use TFT_eSPI library
void fillScreen(uint16_t color) {
  tft.fillScreen(color);
}

void fillRect(uint16_t x, uint16_t y, uint16_t w, uint16_t h, uint16_t color) {
  tft.fillRect(x, y, w, h, color);
}

void initDisplay() {
  tft.init();
  tft.setRotation(1); // Landscape mode
}

void setupI2S() {
  Serial.println("Configuring I2S for microphone...");

  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = BUFFER_SIZE,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_MIC_SCK,
    .ws_io_num = I2S_MIC_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_MIC_SD
  };

  esp_err_t err = i2s_driver_install(I2S_MIC_NUM, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("I2S driver install failed: %d\n", err);
    return;
  }

  err = i2s_set_pin(I2S_MIC_NUM, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("I2S set pin failed: %d\n", err);
    return;
  }

  Serial.println("I2S configured successfully!");
}

void setupAmplifier() {
  Serial.println("Configuring I2S for amplifier...");

  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = BUFFER_SIZE,
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_AMP_BCLK,
    .ws_io_num = I2S_AMP_LRC,
    .data_out_num = I2S_AMP_DIN,
    .data_in_num = I2S_PIN_NO_CHANGE
  };

  esp_err_t err = i2s_driver_install(I2S_SPK_NUM, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("Amplifier I2S driver install failed: %d\n", err);
    return;
  }

  err = i2s_set_pin(I2S_SPK_NUM, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("Amplifier I2S set pin failed: %d\n", err);
    return;
  }

  Serial.println("Amplifier I2S configured successfully!");
}

float readAudioLevel(int16_t* outputSamples, int* sampleCount) {
  int32_t samples[BUFFER_SIZE];
  size_t bytes_read = 0;

  i2s_read(I2S_MIC_NUM, samples, sizeof(samples), &bytes_read, portMAX_DELAY);

  // Calculate RMS (Root Mean Square) level
  int64_t sum = 0;
  int count = bytes_read / sizeof(int32_t);

  for (int i = 0; i < count; i++) {
    int16_t sample = samples[i] >> 16; // Take upper 16 bits
    outputSamples[i] = sample;
    sum += (int64_t)sample * sample;
  }

  *sampleCount = count;
  float rms = sqrt((float)sum / count);

  // Apply 3x gain boost for better sensitivity
  return rms * 3.0;
}

void playRecording() {
  if (recordingLength == 0) {
    Serial.println("ERROR: No recording to play!");
    state = STATE_IDLE;
    lastState = STATE_PLAYING; // Force redraw
    return;
  }

  Serial.println("===== STARTING PLAYBACK =====");
  Serial.printf("Recording length: %d samples\n", recordingLength);

  // Draw playing status FIRST and wait so user can see it
  Serial.println("Drawing BLUE screen...");
  fillScreen(COLOR_BLACK);
  fillRect(60, 80, 200, 80, COLOR_BLUE);
  delay(500); // Give user time to see blue screen
  Serial.println("Blue screen drawn!");

  // CRITICAL: Shut down microphone I2S before starting speaker
  Serial.println("Shutting down microphone I2S...");
  esp_err_t err = i2s_driver_uninstall(I2S_MIC_NUM);
  Serial.printf("Mic I2S uninstall result: %d\n", err);
  delay(100);

  // Initialize speaker I2S
  Serial.println("Initializing speaker I2S for playback...");
  setupAmplifier();
  delay(100);

  // Enable amplifier
  Serial.println("Enabling amplifier...");
  digitalWrite(I2S_AMP_SD, HIGH);
  delay(100); // Let amp stabilize

  // Play the recording at max volume
  Serial.println("Writing audio data to speaker...");
  size_t bytes_written = 0;
  i2s_write(I2S_SPK_NUM, recordingBuffer, recordingLength * sizeof(int16_t), &bytes_written, portMAX_DELAY);
  Serial.printf("Wrote %d bytes to speaker\n", bytes_written);

  // Wait for playback to finish
  delay(500);

  // Disable amplifier
  Serial.println("Disabling amplifier...");
  digitalWrite(I2S_AMP_SD, LOW);

  // Shutdown speaker I2S
  Serial.println("Shutting down speaker I2S...");
  err = i2s_driver_uninstall(I2S_SPK_NUM);
  Serial.printf("Speaker I2S uninstall result: %d\n", err);

  // Restart microphone I2S for next recording
  Serial.println("Restarting microphone I2S...");
  setupI2S();

  Serial.println("===== PLAYBACK COMPLETE =====");

  // Reset
  recordingLength = 0;
  state = STATE_IDLE;
  lastState = STATE_PLAYING; // Force redraw of READY screen
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=============================");
  Serial.println("  MOTE VOICE RECORDER");
  Serial.println("=============================");
  Serial.println();
  Serial.println("Hardware:");
  Serial.println("  INMP441 I2S Microphone");
  Serial.println("  MAX98357A I2S Amplifier");
  Serial.println();
  Serial.println("How it works:");
  Serial.println("  1. Start talking");
  Serial.println("  2. Stop when done (1 sec silence)");
  Serial.println("  3. Plays back at max volume!");
  Serial.println("=============================\n");

  // Allocate recording buffer in PSRAM
  Serial.printf("Attempting to allocate %d bytes in PSRAM...\n", MAX_SAMPLES * sizeof(int16_t));
  recordingBuffer = (int16_t*)ps_malloc(MAX_SAMPLES * sizeof(int16_t));
  if (recordingBuffer == NULL) {
    Serial.println("ERROR: Failed to allocate recording buffer in PSRAM!");
    Serial.println("Halting...");
    fillScreen(COLOR_RED);
    while(1) delay(1000); // Halt with red screen
  }
  Serial.printf("Success! Allocated %d bytes in PSRAM\n", MAX_SAMPLES * sizeof(int16_t));

  // Setup amplifier shutdown pin (disabled until playback)
  pinMode(I2S_AMP_SD, OUTPUT);
  digitalWrite(I2S_AMP_SD, LOW);  // Amp off initially

  Serial.println("Amplifier ready for playback");

  // Setup display using TFT_eSPI library
  Serial.println("Initializing display with TFT_eSPI...");
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH); // Turn on backlight
  initDisplay();
  Serial.println("Display initialized!");

  // Draw initial screen - simple green for READY
  Serial.println("Drawing ready screen...");
  fillScreen(COLOR_BLACK);
  fillRect(60, 80, 200, 80, COLOR_GREEN);
  Serial.println("Ready screen drawn!");

  delay(500);

  // TEST: Play a beep to verify speaker works
  Serial.println("\n=== TESTING SPEAKER ===");
  fillScreen(COLOR_BLACK);
  fillRect(60, 80, 200, 80, COLOR_BLUE);
  Serial.println("Blue screen shown");

  // Generate a 440Hz tone (A note) for 1 second at MAXIMUM volume
  Serial.println("Generating test tone at MAX volume...");
  for (int i = 0; i < 16000; i++) {
    recordingBuffer[i] = (int16_t)(sin(2.0 * PI * 440.0 * i / 16000.0) * 32000); // Max amplitude
  }
  Serial.println("Test tone generated (16000 samples, 1 second)");

  Serial.println("Setting up speaker I2S...");
  setupAmplifier();

  Serial.println("Checking amplifier SD pin state...");
  Serial.printf("GPIO 4 (AMP_SD) before enable: %d\n", digitalRead(I2S_AMP_SD));

  Serial.println("Enabling amplifier (GPIO 4 HIGH)...");
  digitalWrite(I2S_AMP_SD, HIGH);
  delay(100);

  Serial.printf("GPIO 4 (AMP_SD) after enable: %d\n", digitalRead(I2S_AMP_SD));

  Serial.println("Writing audio data to I2S...");
  size_t bytes_written = 0;
  esp_err_t err = i2s_write(I2S_SPK_NUM, recordingBuffer, 16000 * sizeof(int16_t), &bytes_written, portMAX_DELAY);
  Serial.printf("i2s_write result: %d\n", err);
  Serial.printf("Bytes requested: %d\n", 16000 * sizeof(int16_t));
  Serial.printf("Bytes written: %d\n", bytes_written);

  Serial.println("Waiting for playback to complete...");
  delay(1000);

  Serial.println("Disabling amplifier (GPIO 4 LOW)...");
  digitalWrite(I2S_AMP_SD, LOW);
  Serial.printf("GPIO 4 (AMP_SD) after disable: %d\n", digitalRead(I2S_AMP_SD));

  Serial.println("Shutting down speaker I2S...");
  i2s_driver_uninstall(I2S_SPK_NUM);
  Serial.println("=== SPEAKER TEST COMPLETE ===\n");

  delay(500);

  // Clear buffer for recording
  memset(recordingBuffer, 0, MAX_SAMPLES * sizeof(int16_t));

  // Start WiFi Access Point with name "Mote"
  Serial.println("\n=== STARTING WIFI ACCESS POINT ===");
  if (setupMoteAP("Mote")) {
    Serial.println("WiFi AP 'Mote' is now active!");
    Serial.println("Mobile app can connect to configure the device");
  } else {
    Serial.println("WARNING: Failed to start WiFi AP");
  }
  Serial.println("=== WIFI AP SETUP COMPLETE ===\n");

  // Return to green ready screen
  fillScreen(COLOR_BLACK);
  fillRect(60, 80, 200, 80, COLOR_GREEN);

  // Only setup microphone I2S - speaker will be setup on-demand during playback
  Serial.println("Setting up microphone I2S...");
  setupI2S();
  Serial.println("Microphone I2S setup complete!");

  Serial.println("\n=================================");
  Serial.println("Voice recorder ready!");
  Serial.println("Start talking to begin recording...");
  Serial.println("=================================\n");

  delay(1000);
}

void loop() {
  // State machine
  switch (state) {
    case STATE_IDLE:
    case STATE_RECORDING:
      {
        // Read audio from microphone (only when mic is active)
        int16_t samples[BUFFER_SIZE];
        int sampleCount = 0;
        float level = readAudioLevel(samples, &sampleCount);

        if (state == STATE_IDLE) {
          // Only update display on state change
          if (state != lastState) {
            fillScreen(COLOR_BLACK);
            fillRect(60, 80, 200, 80, COLOR_GREEN);
            Serial.println("READY - waiting for voice...");
            lastState = state;
          }

          // Check if voice detected
          if (level > VOICE_THRESHOLD) {
            Serial.printf("Voice detected! Level: %.0f (threshold: %.0f)\n", level, VOICE_THRESHOLD);
            Serial.println("Starting recording...");
            fillScreen(COLOR_BLACK);
            fillRect(60, 80, 200, 80, COLOR_RED);
            state = STATE_RECORDING;
            recordingLength = 0;
            lastVoiceTime = millis();
            Serial.println("RED screen drawn, recording active");
          }
        } else if (state == STATE_RECORDING) {
          // Only update display on state change
          if (state != lastState) {
            Serial.println("RECORDING STATE ACTIVE");
            lastState = state;
          }

          // Add samples to buffer
          if (recordingLength + sampleCount < MAX_SAMPLES) {
            memcpy(&recordingBuffer[recordingLength], samples, sampleCount * sizeof(int16_t));
            recordingLength += sampleCount;

            // Debug: Print every 1000 samples
            if (recordingLength % 1000 == 0) {
              Serial.printf("Recording... %d samples so far\n", recordingLength);
            }
          }

          // Check if voice is still present
          if (level > VOICE_THRESHOLD) {
            lastVoiceTime = millis();
          }

          // Debug: Show level periodically
          static unsigned long lastLevelPrint = 0;
          if (millis() - lastLevelPrint > 200) {
            Serial.printf("Level: %.0f | Samples: %d | Silence time: %lu ms\n",
                         level, recordingLength, millis() - lastVoiceTime);
            lastLevelPrint = millis();
          }

          // Check for silence (only stop if we have minimum recording length)
          if (millis() - lastVoiceTime > SILENCE_DURATION && recordingLength >= MIN_RECORDING_SAMPLES) {
            Serial.println("===================================");
            Serial.printf("Silence detected! Recorded %d samples (%d bytes)\n", recordingLength, recordingLength * sizeof(int16_t));
            Serial.println("===================================");

            if (recordingLength > 0) {
              state = STATE_PLAYING;
              playRecording();
            } else {
              Serial.println("ERROR: No samples recorded!");
              state = STATE_IDLE;
              lastState = STATE_RECORDING; // Force redraw
            }
          }

          // Check max recording time
          if (recordingLength >= MAX_SAMPLES) {
            Serial.println("Max recording time reached!");
            state = STATE_PLAYING;
            playRecording();
          }
        }
      }
      break;

    case STATE_PLAYING:
      // Playback is handled when we transition to this state
      // Just wait for playback to complete and return to IDLE
      delay(100);
      break;
  }

  // Small delay
  delay(10);
}
