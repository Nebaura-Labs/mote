# Audio Module Documentation

## Overview

The Mote uses I2S (Inter-IC Sound) for both audio input and output:
- **Microphone:** INMP441 I2S MEMS Digital Microphone
- **Amplifier:** MAX98357A I2S DAC + 3W Class D Amplifier
- **Speaker:** 4Ω 3W speaker

## Pin Configuration

### Microphone (I2S Input)

```cpp
#define I2S_MIC_WS   35  // Word Select / LRCLK (Yellow wire)
#define I2S_MIC_SCK  36  // Bit Clock / BCLK (Green wire)
#define I2S_MIC_SD   37  // Serial Data (Blue wire)
```

**Physical Connections (from wiring diagram):**
- **L/R** → e35 → Top GND rail (Black wire) - Selects left channel
- **GND** → f35 → Top GND rail (Grey wire)
- **VDD** → f36 → Top + rail 3.3V (Red wire)
- **WS** → e36 → a10 GPIO 35 (Yellow wire)
- **SCK** → e37 → a11 GPIO 36 (Green wire)
- **SD** → f37 → a12 GPIO 37 (Blue wire)

**Important:** INMP441 requires 3.3V power. DO NOT connect to 5V - it will be permanently damaged!

### Amplifier (I2S Output)

```cpp
#define I2S_AMP_BCLK  16  // Bit Clock (Orange wire)
#define I2S_AMP_LRC   17  // Left/Right Clock (Purple wire)
#define I2S_AMP_DIN   18  // Data In (White wire)
```

**Physical Connections (from wiring diagram):**
- **VIN** → e51 → Bottom + rail 5V (Red wire)
- **GND** → e50 → Bottom GND rail (Grey wire)
- **BCLK** → e46 → j14 GPIO 16 (Orange wire)
- **LRC** → e45 → j13 GPIO 17 (Purple wire)
- **DIN** → e47 → j12 GPIO 18 (White wire)
- **GAIN** → e48 → Not connected (Default 9dB gain)
- **SD** → e49 → Not connected (Amp always on)

**Important:** MAX98357A requires 5V power for full 3W output.

### Speaker Connection

Speaker connects to MAX98357A screw terminal:
- **+ (positive)** → Right screw terminal
- **- (negative)** → Left screw terminal

## I2S Configuration

### Microphone Setup

```cpp
#include <driver/i2s.h>

#define I2S_NUM_MIC      I2S_NUM_0
#define SAMPLE_RATE      16000  // 16kHz for voice
#define BITS_PER_SAMPLE  I2S_BITS_PER_SAMPLE_32BIT
#define CHANNEL_FORMAT   I2S_CHANNEL_FMT_ONLY_LEFT

void setupMicrophone() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = BITS_PER_SAMPLE,
    .channel_format = CHANNEL_FORMAT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 1024,
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

  i2s_driver_install(I2S_NUM_MIC, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_MIC, &pin_config);
}
```

### Amplifier Setup

```cpp
#define I2S_NUM_AMP      I2S_NUM_1

void setupAmplifier() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 1024,
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

  i2s_driver_install(I2S_NUM_AMP, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_AMP, &pin_config);
}
```

## Reading Audio from Microphone

```cpp
#define BUFFER_SIZE 1024

void readMicrophone() {
  int32_t samples[BUFFER_SIZE];
  size_t bytes_read = 0;

  // Read from I2S
  i2s_read(I2S_NUM_MIC, samples, sizeof(samples), &bytes_read, portMAX_DELAY);

  // Convert 32-bit to 16-bit
  int16_t samples_16bit[BUFFER_SIZE];
  for (int i = 0; i < BUFFER_SIZE; i++) {
    samples_16bit[i] = samples[i] >> 16;  // Take upper 16 bits
  }

  // Process audio data
  processAudio(samples_16bit, BUFFER_SIZE);
}
```

## Playing Audio to Speaker

```cpp
void playAudio(int16_t* samples, size_t count) {
  size_t bytes_written = 0;

  // Apply volume control
  adjustVolume(samples, count);

  // Write to I2S
  i2s_write(I2S_NUM_AMP, samples, count * sizeof(int16_t), &bytes_written, portMAX_DELAY);
}
```

## Volume Control

Software volume control by scaling PCM samples:

```cpp
uint8_t volume = 50;  // 0-100

void adjustVolume(int16_t* samples, size_t count) {
  for (size_t i = 0; i < count; i++) {
    // Scale sample by volume percentage
    int32_t scaled = (samples[i] * volume) / 100;

    // Clamp to prevent overflow
    if (scaled > 32767) scaled = 32767;
    if (scaled < -32768) scaled = -32768;

    samples[i] = (int16_t)scaled;
  }
}

void setVolume(uint8_t vol) {
  if (vol > 100) vol = 100;
  volume = vol;
}
```

## Audio Processing

### Voice Activity Detection (VAD)

```cpp
bool detectVoiceActivity(int16_t* samples, size_t count) {
  // Calculate RMS energy
  int64_t sum = 0;
  for (size_t i = 0; i < count; i++) {
    sum += samples[i] * samples[i];
  }
  float rms = sqrt(sum / count);

  // Threshold for voice detection
  const float VOICE_THRESHOLD = 500.0;
  return rms > VOICE_THRESHOLD;
}
```

### Wake Word Detection

Integration with Picovoice Porcupine (to be implemented):

```cpp
#include <pv_porcupine.h>

pv_porcupine_t *porcupine = NULL;

void setupWakeWord() {
  const char *keyword = "hey mote";  // Custom wake word

  pv_status_t status = pv_porcupine_init(
    ACCESS_KEY,
    keyword,
    1.0,  // Sensitivity
    &porcupine
  );

  if (status != PV_STATUS_SUCCESS) {
    Serial.println("Porcupine init failed");
  }
}

bool detectWakeWord(int16_t* samples) {
  int32_t keyword_index = -1;

  pv_status_t status = pv_porcupine_process(
    porcupine,
    samples,
    &keyword_index
  );

  return keyword_index >= 0;
}
```

## Audio Formats

### PCM Format
- **Sample Rate:** 16000 Hz (16kHz) for voice
- **Bit Depth:** 16-bit signed integer (-32768 to 32767)
- **Channels:** Mono (single channel)
- **Byte Order:** Little-endian

### ElevenLabs TTS Format
The gateway server requests audio in `pcm_16000` format from ElevenLabs:
- 16kHz sample rate
- 16-bit signed PCM
- Mono channel
- No header (raw PCM)

This format is directly compatible with the ESP32 I2S amplifier.

## PSRAM Ring Buffer for TTS Playback

The firmware uses a large ring buffer in PSRAM for buffered TTS playback. This allows the ESP32 to receive audio data over WebSocket while simultaneously playing it back without gaps.

### Configuration

```cpp
// Buffer size: 60 seconds of audio at 16kHz (~1MB in PSRAM)
#define AUDIO_RING_BUFFER_SIZE  (16000 * 60)

// Ring buffer state
static int16_t* audioRingBuffer = NULL;        // Allocated in PSRAM
static volatile size_t bufferWriteIndex = 0;   // Next write position
static volatile size_t bufferReadIndex = 0;    // Next read position
static volatile size_t bufferAvailable = 0;    // Samples available to read
static volatile bool bufferPlaying = false;    // Currently playing flag
static volatile bool streamFinished = false;   // TTS stream complete flag
static volatile bool bufferReady = false;      // Set after initialization
```

### Buffer Initialization

```cpp
bool initRingBuffer() {
    // Allocate in PSRAM (external memory)
    audioRingBuffer = (int16_t*)ps_malloc(AUDIO_RING_BUFFER_SIZE * sizeof(int16_t));

    if (audioRingBuffer) {
        // CRITICAL: Zero out buffer to prevent playing garbage on startup
        memset(audioRingBuffer, 0, AUDIO_RING_BUFFER_SIZE * sizeof(int16_t));

        bufferWriteIndex = 0;
        bufferReadIndex = 0;
        bufferAvailable = 0;
        bufferPlaying = false;
        streamFinished = false;

        // Mark buffer as ready LAST, after everything is initialized
        bufferReady = true;
        return true;
    }
    return false;
}
```

### Queuing Audio Data

Audio data received over WebSocket is queued to the ring buffer:

```cpp
size_t queueAudioData(const int16_t* data, size_t sampleCount) {
    if (!bufferReady || !audioRingBuffer) return 0;

    size_t queued = 0;
    for (size_t i = 0; i < sampleCount; i++) {
        if (bufferAvailable >= AUDIO_RING_BUFFER_SIZE) {
            // Buffer full - drop samples
            break;
        }
        audioRingBuffer[bufferWriteIndex] = data[i];
        bufferWriteIndex = (bufferWriteIndex + 1) % AUDIO_RING_BUFFER_SIZE;
        bufferAvailable++;
        queued++;
    }
    return queued;
}
```

### Playback Task

A FreeRTOS task handles continuous playback:

```cpp
void audioPlaybackTask(void* parameter) {
    int16_t playBuffer[256];

    while (true) {
        if (!bufferReady) {
            vTaskDelay(pdMS_TO_TICKS(10));
            continue;
        }

        if (bufferPlaying && bufferAvailable > 0) {
            // Read from ring buffer
            size_t toRead = min(256, bufferAvailable);
            for (size_t i = 0; i < toRead; i++) {
                playBuffer[i] = audioRingBuffer[bufferReadIndex];
                bufferReadIndex = (bufferReadIndex + 1) % AUDIO_RING_BUFFER_SIZE;
            }
            bufferAvailable -= toRead;

            // Write to I2S
            size_t bytesWritten;
            i2s_write(I2S_NUM_1, playBuffer, toRead * sizeof(int16_t), &bytesWritten, portMAX_DELAY);
        } else if (bufferPlaying && bufferAvailable == 0) {
            // Buffer underrun handling with timeout
            static uint32_t underrunCount = 0;
            underrunCount++;

            if (underrunCount % 20 == 1) {
                Serial.printf("[Audio] Buffer underrun #%d, waiting...\n", underrunCount);
            }

            vTaskDelay(pdMS_TO_TICKS(50));  // Wait for more data

            // Timeout after 5 seconds of underruns
            if (underrunCount > 100) {
                Serial.println("[Audio] Underrun timeout - stopping playback");
                bufferPlaying = false;
                streamFinished = false;
                underrunCount = 0;
                i2s_zero_dma_buffer(I2S_NUM_1);
            }
        } else {
            vTaskDelay(pdMS_TO_TICKS(10));
        }
    }
}
```

### Converting Sample Rates

```cpp
// Simple decimation for 48kHz -> 16kHz
void decimateSamples(int16_t* input, int16_t* output, size_t inputCount) {
  size_t outputIndex = 0;

  for (size_t i = 0; i < inputCount; i += 3) {
    output[outputIndex++] = input[i];
  }
}
```

## Troubleshooting

### No Audio Input

1. **Check wiring:** Verify all 6 microphone connections
2. **Check power:** INMP441 must have 3.3V (not 5V!)
3. **Check L/R pin:** Must be connected to GND for left channel
4. **Test I2S:** Use oscilloscope to verify clock signals

### No Audio Output

1. **Check 5V power:** MAX98357A requires 5V for full output
2. **Check speaker:** Verify 4Ω speaker connected to screw terminals
3. **Check volume:** Ensure volume > 0
4. **Test I2S:** Verify data is being written with `i2s_write()`

### Loud Noise on Startup

**Symptom:** Speaker plays loud static/garbage audio ~10 seconds after boot.

**Cause:** Uninitialized PSRAM buffer contains random data that gets played.

**Solution:** The firmware now:
1. Uses `memset()` to zero the buffer after allocation
2. Calls `i2s_zero_dma_buffer()` during amplifier initialization
3. Uses a `bufferReady` flag to prevent playback before initialization completes

### Buffer Underruns (Choppy Audio)

**Symptom:** Audio stutters or has gaps, serial log shows "Buffer underrun" messages.

**Cause:** Network latency or WiFi issues causing data to arrive slower than playback.

**Solutions:**
1. Ensure strong WiFi signal
2. Increase buffer size (currently 60 seconds)
3. Check gateway server isn't overloaded

### Buffer Overflow (Audio Cuts Off)

**Symptom:** Long TTS responses get cut off, serial log shows dropped samples.

**Cause:** Buffer too small for the response length.

**Solution:** Increase `AUDIO_RING_BUFFER_SIZE`. Current setting is 60 seconds (~1MB in PSRAM).

### Distorted/Static Audio

**Symptom:** Audio has static, crackling, or sounds distorted.

**Cause:** Usually gain is set too high, causing clipping.

**Solutions:**
1. Reduce `gain` parameter in voice-handler.ts (default 1.5x)
2. Disable `useSpeakerBoost` if still clipping
3. Check sample rate matches (should be 16kHz)
4. Verify speaker impedance (should be 4Ω)

### Poor Microphone Quality

1. **Increase sample rate:** Try 44.1kHz or 48kHz
2. **Add noise filtering:** Implement high-pass filter for wind noise
3. **Adjust position:** Keep microphone away from speaker to prevent feedback
4. **Check VAD threshold:** If voice isn't detected, lower `VAD_THRESHOLD`

## Performance Considerations

- **DMA Buffers:** Use 8 buffers × 1024 samples for smooth audio
- **Processing Time:** Keep audio processing < 64ms to avoid gaps
- **CPU Usage:** I2S DMA offloads work from CPU, ~5% usage typical
- **Memory:** 16-bit mono at 16kHz uses ~32KB/second

## Future Enhancements

- [ ] Echo cancellation for full-duplex communication
- [ ] Noise suppression using WebRTC NS
- [ ] Automatic gain control (AGC)
- [ ] Beamforming with multiple microphones
- [ ] Audio compression (Opus codec)

## Resources

- [INMP441 Datasheet](https://invensense.tdk.com/wp-content/uploads/2015/02/INMP441.pdf)
- [MAX98357A Datasheet](https://datasheets.maximintegrated.com/en/ds/MAX98357A-MAX98357B.pdf)
- [ESP32 I2S Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/i2s.html)
