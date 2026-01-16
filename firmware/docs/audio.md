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

### Distorted Audio

1. **Lower volume:** Reduce software volume to prevent clipping
2. **Check sample rate:** Ensure input and output rates match
3. **Check speaker:** 3W speaker may distort at high volumes

### Poor Microphone Quality

1. **Increase sample rate:** Try 44.1kHz or 48kHz
2. **Add noise filtering:** Implement high-pass filter for wind noise
3. **Adjust position:** Keep microphone away from speaker to prevent feedback

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
