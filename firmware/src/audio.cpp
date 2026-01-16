#include "audio.h"
#include <math.h>

// Volume control (0-100)
static uint8_t currentVolume = 70;

// Audio playback state
static volatile bool audioPlaying = false;

/**
 * Initialize I2S for microphone (input)
 */
static bool setupMicrophone() {
    Serial.println("[Audio] Initializing microphone...");

    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = AUDIO_SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,  // INMP441 outputs 32-bit
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = AUDIO_DMA_BUF_COUNT,
        .dma_buf_len = AUDIO_DMA_BUF_LEN,
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

    esp_err_t err = i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
    if (err != ESP_OK) {
        Serial.printf("[Audio] Failed to install I2S driver for mic: %d\n", err);
        return false;
    }

    err = i2s_set_pin(I2S_NUM_0, &pin_config);
    if (err != ESP_OK) {
        Serial.printf("[Audio] Failed to set I2S pins for mic: %d\n", err);
        return false;
    }

    Serial.println("[Audio] Microphone initialized successfully");
    return true;
}

/**
 * Initialize I2S for amplifier (output)
 */
static bool setupAmplifier() {
    Serial.println("[Audio] Initializing amplifier...");

    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
        .sample_rate = AUDIO_SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = AUDIO_DMA_BUF_COUNT,
        .dma_buf_len = AUDIO_DMA_BUF_LEN,
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

    esp_err_t err = i2s_driver_install(I2S_NUM_1, &i2s_config, 0, NULL);
    if (err != ESP_OK) {
        Serial.printf("[Audio] Failed to install I2S driver for amp: %d\n", err);
        return false;
    }

    err = i2s_set_pin(I2S_NUM_1, &pin_config);
    if (err != ESP_OK) {
        Serial.printf("[Audio] Failed to set I2S pins for amp: %d\n", err);
        return false;
    }

    Serial.println("[Audio] Amplifier initialized successfully");
    return true;
}

bool setupAudio() {
    Serial.println("[Audio] Setting up audio subsystem...");

    bool micOk = setupMicrophone();
    bool ampOk = setupAmplifier();

    if (micOk && ampOk) {
        Serial.println("[Audio] Audio subsystem ready");
        return true;
    }

    Serial.println("[Audio] Audio subsystem initialization failed");
    return false;
}

size_t readMicrophoneData(int16_t* buffer, size_t maxSamples) {
    // INMP441 outputs 32-bit samples, we need to convert to 16-bit
    int32_t samples32[AUDIO_BUFFER_SIZE];
    size_t bytesToRead = min(maxSamples, (size_t)AUDIO_BUFFER_SIZE) * sizeof(int32_t);
    size_t bytesRead = 0;

    esp_err_t err = i2s_read(I2S_NUM_0, samples32, bytesToRead, &bytesRead, portMAX_DELAY);
    if (err != ESP_OK) {
        Serial.printf("[Audio] Failed to read from mic: %d\n", err);
        return 0;
    }

    size_t samplesRead = bytesRead / sizeof(int32_t);

    // Convert 32-bit to 16-bit (take upper 16 bits)
    for (size_t i = 0; i < samplesRead; i++) {
        buffer[i] = (int16_t)(samples32[i] >> 16);
    }

    return samplesRead;
}

/**
 * Apply volume control to audio samples
 */
static void applyVolume(int16_t* samples, size_t count) {
    for (size_t i = 0; i < count; i++) {
        int32_t scaled = ((int32_t)samples[i] * currentVolume) / 100;
        // Clamp to prevent overflow
        if (scaled > 32767) scaled = 32767;
        if (scaled < -32768) scaled = -32768;
        samples[i] = (int16_t)scaled;
    }
}

size_t playAudioData(const int16_t* samples, size_t count) {
    // Create a copy to apply volume (don't modify original)
    int16_t* volumeAdjusted = (int16_t*)malloc(count * sizeof(int16_t));
    if (!volumeAdjusted) {
        Serial.println("[Audio] Failed to allocate volume buffer");
        return 0;
    }

    memcpy(volumeAdjusted, samples, count * sizeof(int16_t));
    applyVolume(volumeAdjusted, count);

    size_t bytesWritten = 0;
    audioPlaying = true;

    esp_err_t err = i2s_write(I2S_NUM_1, volumeAdjusted, count * sizeof(int16_t), &bytesWritten, portMAX_DELAY);

    free(volumeAdjusted);

    if (err != ESP_OK) {
        Serial.printf("[Audio] Failed to write to amp: %d\n", err);
        audioPlaying = false;
        return 0;
    }

    return bytesWritten / sizeof(int16_t);
}

bool detectVoiceActivity(const int16_t* samples, size_t count) {
    if (count == 0) return false;

    // Calculate RMS energy
    int64_t sum = 0;
    for (size_t i = 0; i < count; i++) {
        int64_t sample = samples[i];
        sum += sample * sample;
    }

    float rms = sqrtf((float)sum / count);
    return rms > VAD_THRESHOLD;
}

void setVolume(uint8_t volume) {
    if (volume > 100) volume = 100;
    currentVolume = volume;
    Serial.printf("[Audio] Volume set to %d%%\n", currentVolume);
}

uint8_t getVolume() {
    return currentVolume;
}

void stopAudioPlayback() {
    i2s_zero_dma_buffer(I2S_NUM_1);
    audioPlaying = false;
}

bool isAudioPlaying() {
    return audioPlaying;
}
