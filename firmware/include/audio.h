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
#define I2S_AMP_GAIN  15  // Gain control (optional - set to -1 if not connected)
                          // Gain: LOW=15dB, HIGH=9dB, GND=12dB (default), VDD=6dB, NC=3dB

// Audio configuration
#define AUDIO_SAMPLE_RATE     16000
#define AUDIO_BITS_PER_SAMPLE 16
#define AUDIO_BUFFER_SIZE     1024
#define AUDIO_DMA_BUF_COUNT   8
#define AUDIO_DMA_BUF_LEN     1024

// Voice Activity Detection threshold
#define VAD_THRESHOLD         50.0f   // Lowered from 500 - mic RMS max ~200 during speech
#define VAD_HOLDOFF_MS        2000  // Keep streaming for this long after speech stops (2s for natural pauses)

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
 * Play audio samples through speaker (immediate, no buffering)
 * @param samples 16-bit PCM samples
 * @param count Number of samples to play
 * @return Number of samples actually written
 */
size_t playAudioData(const int16_t* samples, size_t count);

/**
 * Queue audio samples for buffered playback (for streaming TTS)
 * Audio will be buffered and played smoothly to avoid network jitter
 * @param samples 16-bit PCM samples
 * @param count Number of samples to queue
 * @return Number of samples actually queued
 */
size_t queueAudioData(const int16_t* samples, size_t count);

/**
 * Start buffered audio playback task
 * Call this once after setting up audio
 */
void startAudioPlaybackTask();

/**
 * Signal that all audio has been queued (TTS complete)
 * Playback will continue until buffer is empty
 */
void finishAudioStream();

/**
 * Clear audio buffer and stop buffered playback
 */
void clearAudioBuffer();

/**
 * Check if buffered audio is currently playing
 * @return true if playing from buffer
 */
bool isBufferedAudioPlaying();

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
 * Set software gain boost (100 = 1.0x, 200 = 2.0x, etc.)
 * Use this to amplify quiet audio beyond 100% volume
 * @param gain Gain multiplier (100-400 recommended)
 */
void setGain(uint16_t gain);

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

/**
 * Restart microphone I2S driver (call after playback to ensure fresh audio)
 */
void restartMicrophone();

#endif // AUDIO_H
