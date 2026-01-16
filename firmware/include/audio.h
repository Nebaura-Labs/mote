#ifndef AUDIO_H
#define AUDIO_H

#include <Arduino.h>
#include <driver/i2s.h>

// Microphone pins (INMP441)
// NOTE: GPIO 33-37 are reserved for PSRAM on ESP32-S3!
#define I2S_MIC_WS    39  // Word Select / LRCLK
#define I2S_MIC_SCK   40  // Bit Clock / BCLK
#define I2S_MIC_SD    41  // Serial Data

// Amplifier pins (MAX98357A)
#define I2S_AMP_BCLK  16  // Bit Clock
#define I2S_AMP_LRC   17  // Left/Right Clock
#define I2S_AMP_DIN   18  // Data In

// Audio configuration
#define AUDIO_SAMPLE_RATE     16000
#define AUDIO_BITS_PER_SAMPLE 16
#define AUDIO_BUFFER_SIZE     1024
#define AUDIO_DMA_BUF_COUNT   8
#define AUDIO_DMA_BUF_LEN     1024

// Voice Activity Detection threshold
#define VAD_THRESHOLD         500.0f
#define VAD_HOLDOFF_MS        300  // Keep streaming for this long after speech stops

/**
 * Initialize the audio subsystem (microphone and speaker)
 * @return true if initialization successful
 */
bool setupAudio();

/**
 * Read audio samples from microphone
 * @param buffer Buffer to store 16-bit samples
 * @param maxSamples Maximum number of samples to read
 * @return Number of samples actually read
 */
size_t readMicrophoneData(int16_t* buffer, size_t maxSamples);

/**
 * Play audio samples through speaker
 * @param samples 16-bit PCM samples
 * @param count Number of samples to play
 * @return Number of samples actually written
 */
size_t playAudioData(const int16_t* samples, size_t count);

/**
 * Check if voice activity is detected in audio buffer
 * @param samples Audio samples to analyze
 * @param count Number of samples
 * @return true if voice activity detected
 */
bool detectVoiceActivity(const int16_t* samples, size_t count);

/**
 * Set speaker volume (0-100)
 * @param volume Volume level
 */
void setVolume(uint8_t volume);

/**
 * Get current volume level
 * @return Current volume (0-100)
 */
uint8_t getVolume();

/**
 * Stop audio playback immediately
 */
void stopAudioPlayback();

/**
 * Check if audio is currently playing
 * @return true if playing
 */
bool isAudioPlaying();

#endif // AUDIO_H
