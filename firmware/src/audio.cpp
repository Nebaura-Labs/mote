#include "audio.h"
#include <math.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

// Volume control (0-100)
static uint8_t currentVolume = 70;

// Software gain boost (100 = 1.0x, 200 = 2.0x, etc.)
static uint16_t softwareGain = 300;  // 3x boost - ElevenLabs output is quiet

// Audio playback state
static volatile bool audioPlaying = false;

// ============================================================================
// Ring Buffer for Buffered Audio Playback
// ============================================================================

// Buffer size: ~60 seconds of audio at 16kHz (use PSRAM for long responses)
#define AUDIO_RING_BUFFER_SIZE  (16000 * 60) // 60 seconds worth of samples (~1MB in PSRAM)
#define AUDIO_PLAYBACK_CHUNK    2048         // 2048 samples = 128ms
#define AUDIO_START_THRESHOLD   (16000)      // Start playing after 1 second buffered
#define AUDIO_TARGET_LEAD_MS    200          // Target lead time: 200ms ahead of playback

static int16_t* audioRingBuffer = nullptr;
static volatile size_t ringBufferHead = 0;    // Write position
static volatile size_t ringBufferTail = 0;    // Read position
static volatile bool bufferPlaying = false;
static volatile bool streamFinished = false;
static volatile bool bufferReady = false;     // Set true ONLY after buffer is fully initialized
static volatile uint64_t samplesPlayed = 0;   // Total samples played (for timing)
static SemaphoreHandle_t bufferMutex = nullptr;
static TaskHandle_t playbackTaskHandle = nullptr;

/**
 * Get number of samples available in ring buffer
 */
static size_t getBufferedSamples() {
    size_t head = ringBufferHead;
    size_t tail = ringBufferTail;
    if (head >= tail) {
        return head - tail;
    } else {
        return AUDIO_RING_BUFFER_SIZE - tail + head;
    }
}

/**
 * Get free space in ring buffer
 */
static size_t getBufferFreeSpace() {
    return AUDIO_RING_BUFFER_SIZE - getBufferedSamples() - 1;
}

/**
 * Apply volume control and gain boost to audio samples
 */
static void applyVolume(int16_t* samples, size_t count) {
    for (size_t i = 0; i < count; i++) {
        // Apply volume (0-100) and software gain
        int32_t scaled = ((int32_t)samples[i] * currentVolume * softwareGain) / 10000;
        // Clamp to prevent overflow/clipping
        if (scaled > 32767) scaled = 32767;
        if (scaled < -32768) scaled = -32768;
        samples[i] = (int16_t)scaled;
    }
}

/**
 * Audio playback task - continuous streaming with I2S-paced playback
 * I2S hardware naturally paces at 16kHz, no artificial throttling needed
 */
static void audioPlaybackTask(void* parameter) {
    int16_t playbackChunk[AUDIO_PLAYBACK_CHUNK];

    while (true) {
        // SAFETY: Wait until buffer is fully initialized
        if (!bufferReady) {
            vTaskDelay(pdMS_TO_TICKS(50));
            continue;
        }

        // Wait until we should be playing
        if (!bufferPlaying) {
            // Check if we have enough buffered to start (200ms lead time)
            size_t buffered = getBufferedSamples();
            if (buffered >= AUDIO_START_THRESHOLD && !streamFinished) {
                Serial.printf("[Audio] Starting playback, buffered: %d samples\n", buffered);
                bufferPlaying = true;
            } else if (streamFinished && buffered > 0) {
                // Stream is done but we still have data to play
                bufferPlaying = true;
            } else {
                vTaskDelay(pdMS_TO_TICKS(10));
                continue;
            }
        }

        // Read samples from ring buffer
        static uint32_t underrunCount = 0;  // Track consecutive underruns
        size_t available = getBufferedSamples();
        if (available == 0) {
            if (streamFinished) {
                // Done playing - clear speaker buffer
                Serial.println("[Audio] Buffered playback complete");
                bufferPlaying = false;
                streamFinished = false;
                underrunCount = 0;
                i2s_zero_dma_buffer(I2S_NUM_1);  // Clear speaker buffer
                Serial.println("[Audio] Playback finished, microphone will be restarted");
            } else {
                // Buffer underrun - wait longer for more data (50ms instead of 5ms)
                underrunCount++;
                // Only log occasionally to avoid spam
                if (underrunCount % 20 == 1) {
                    Serial.printf("[Audio] Buffer underrun #%d, waiting...\n", underrunCount);
                }
                vTaskDelay(pdMS_TO_TICKS(50));

                // Timeout: if we've been in underrun for 5+ seconds, give up
                if (underrunCount > 100) {
                    Serial.println("[Audio] Underrun timeout - stopping playback");
                    bufferPlaying = false;
                    streamFinished = false;
                    underrunCount = 0;
                    i2s_zero_dma_buffer(I2S_NUM_1);
                }
            }
            continue;
        } else {
            // Reset underrun counter when we have data
            underrunCount = 0;
        }

        // Read up to AUDIO_PLAYBACK_CHUNK samples
        size_t toRead = min(available, (size_t)AUDIO_PLAYBACK_CHUNK);

        if (xSemaphoreTake(bufferMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            for (size_t i = 0; i < toRead; i++) {
                playbackChunk[i] = audioRingBuffer[ringBufferTail];
                ringBufferTail = (ringBufferTail + 1) % AUDIO_RING_BUFFER_SIZE;
            }
            xSemaphoreGive(bufferMutex);
        } else {
            vTaskDelay(pdMS_TO_TICKS(1));
            continue;
        }

        // Apply volume and play
        // i2s_write blocks until I2S hardware is ready, naturally pacing at 16kHz
        applyVolume(playbackChunk, toRead);

        size_t bytesWritten = 0;
        i2s_write(I2S_NUM_1, playbackChunk, toRead * sizeof(int16_t), &bytesWritten, portMAX_DELAY);
    }
}

/**
 * Initialize ring buffer (called from setupAudio)
 */
static void initRingBuffer() {
    if (audioRingBuffer == nullptr) {
        audioRingBuffer = (int16_t*)ps_malloc(AUDIO_RING_BUFFER_SIZE * sizeof(int16_t));
        if (audioRingBuffer) {
            // CRITICAL: Zero out buffer to prevent playing garbage on startup
            memset(audioRingBuffer, 0, AUDIO_RING_BUFFER_SIZE * sizeof(int16_t));
            Serial.printf("[Audio] Ring buffer allocated and zeroed: %d samples (%d bytes)\n",
                         AUDIO_RING_BUFFER_SIZE, AUDIO_RING_BUFFER_SIZE * sizeof(int16_t));
        } else {
            Serial.println("[Audio] Failed to allocate ring buffer!");
        }
    }

    if (bufferMutex == nullptr) {
        bufferMutex = xSemaphoreCreateMutex();
    }

    ringBufferHead = 0;
    ringBufferTail = 0;
    bufferPlaying = false;
    streamFinished = false;
    samplesPlayed = 0;

    // Mark buffer as ready LAST, after everything is initialized
    bufferReady = true;
}

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

    // Set hardware gain pin if connected (optional)
    #if I2S_AMP_GAIN >= 0
    pinMode(I2S_AMP_GAIN, OUTPUT);
    digitalWrite(I2S_AMP_GAIN, LOW);  // LOW = 15dB hardware gain (maximum)
    Serial.println("[Audio] Hardware gain set to 15dB");
    #endif

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

    // Clear DMA buffer to prevent playing garbage on startup
    i2s_zero_dma_buffer(I2S_NUM_1);

    Serial.println("[Audio] Amplifier initialized successfully");
    return true;
}

bool setupAudio() {
    Serial.println("[Audio] Setting up audio subsystem...");

    bool micOk = setupMicrophone();
    bool ampOk = setupAmplifier();

    if (micOk && ampOk) {
        // Initialize ring buffer for buffered playback
        initRingBuffer();
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

// ============================================================================
// Buffered Audio Playback Functions
// ============================================================================

size_t queueAudioData(const int16_t* samples, size_t count) {
    if (audioRingBuffer == nullptr || bufferMutex == nullptr) {
        Serial.println("[Audio] Ring buffer not initialized!");
        return 0;
    }

    if (xSemaphoreTake(bufferMutex, pdMS_TO_TICKS(50)) != pdTRUE) {
        Serial.println("[Audio] Failed to acquire buffer mutex");
        return 0;
    }

    size_t freeSpace = getBufferFreeSpace();
    size_t toWrite = min(count, freeSpace);

    if (toWrite < count) {
        Serial.printf("[Audio] Buffer full, dropping %d samples\n", count - toWrite);
    }

    for (size_t i = 0; i < toWrite; i++) {
        audioRingBuffer[ringBufferHead] = samples[i];
        ringBufferHead = (ringBufferHead + 1) % AUDIO_RING_BUFFER_SIZE;
    }

    xSemaphoreGive(bufferMutex);

    return toWrite;
}

void startAudioPlaybackTask() {
    if (playbackTaskHandle != nullptr) {
        Serial.println("[Audio] Playback task already running");
        return;
    }

    xTaskCreatePinnedToCore(
        audioPlaybackTask,
        "AudioPlayback",
        8192,  // 8KB stack for 2048-sample chunks
        nullptr,
        10,  // Very high priority for smooth playback
        &playbackTaskHandle,
        1   // Run on core 1 (app core)
    );

    Serial.println("[Audio] Playback task started");
}

void finishAudioStream() {
    Serial.println("[Audio] Audio stream finished, draining buffer...");
    streamFinished = true;
}

void clearAudioBuffer() {
    if (xSemaphoreTake(bufferMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        ringBufferHead = 0;
        ringBufferTail = 0;
        bufferPlaying = false;
        streamFinished = false;
        xSemaphoreGive(bufferMutex);
    }
    i2s_zero_dma_buffer(I2S_NUM_1);
    // Also clear microphone buffer to ensure fresh start
    i2s_zero_dma_buffer(I2S_NUM_0);
    Serial.println("[Audio] Audio buffer cleared");
}

bool isBufferedAudioPlaying() {
    return bufferPlaying || getBufferedSamples() > 0;
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

    // Debug: Log RMS periodically to calibrate threshold
    static unsigned long lastRmsLog = 0;
    static float maxRms = 0;
    if (rms > maxRms) maxRms = rms;
    if (millis() - lastRmsLog > 2000) {
        Serial.printf("[VAD] RMS: %.1f, max: %.1f, threshold: %.1f\n", rms, maxRms, VAD_THRESHOLD);
        maxRms = 0;
        lastRmsLog = millis();
    }

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

void setGain(uint16_t gain) {
    if (gain < 100) gain = 100;  // Minimum 1.0x
    if (gain > 400) gain = 400;  // Maximum 4.0x to prevent extreme clipping
    softwareGain = gain;
    Serial.printf("[Audio] Software gain set to %.1fx\n", gain / 100.0);
}

void stopAudioPlayback() {
    i2s_zero_dma_buffer(I2S_NUM_1);
    audioPlaying = false;
}

bool isAudioPlaying() {
    return audioPlaying;
}

void restartMicrophone() {
    Serial.println("[Audio] Restarting microphone I2S...");
    
    // Stop and restart the I2S driver to clear any stale state
    i2s_stop(I2S_NUM_0);
    i2s_zero_dma_buffer(I2S_NUM_0);
    delay(10);  // Brief pause to let hardware settle
    i2s_start(I2S_NUM_0);
    
    Serial.println("[Audio] Microphone I2S restarted");
}
