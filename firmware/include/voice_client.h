#ifndef VOICE_CLIENT_H
#define VOICE_CLIENT_H

#include <Arduino.h>
#include <WebSocketsClient.h>

// Voice state machine
enum VoiceState {
    VOICE_DISCONNECTED,  // Not connected to server
    VOICE_IDLE,          // Connected, streaming audio, waiting for wake word
    VOICE_LISTENING,     // Server detected wake word, capturing user command
    VOICE_PROCESSING,    // Waiting for AI response
    VOICE_SPEAKING       // Playing response audio
};

// Voice event callback types
typedef void (*VoiceStateCallback)(VoiceState newState);
typedef void (*VoiceTranscriptCallback)(const char* text);
typedef void (*VoiceAudioCallback)(const uint8_t* data, size_t length);

/**
 * Initialize the voice WebSocket client
 * @param server WebSocket server hostname (without protocol)
 * @param port Server port
 * @param token Gateway authentication token
 * @return true if initialization successful
 */
bool setupVoiceClient(const char* server, uint16_t port, const char* token);

/**
 * Handle voice client events in main loop
 * Must be called frequently
 */
void handleVoiceClient();

/**
 * Check if voice WebSocket is connected
 * @return true if connected
 */
bool isVoiceConnected();

/**
 * Get current voice state
 * @return Current VoiceState
 */
VoiceState getVoiceState();

/**
 * Send audio data to server
 * @param samples PCM 16-bit samples
 * @param count Number of samples
 * @return true if sent successfully
 */
bool sendVoiceAudio(const int16_t* samples, size_t count);

/**
 * Notify server that speech has stopped
 */
void sendVoiceSilence();

/**
 * Disconnect voice WebSocket
 */
void disconnectVoice();

/**
 * Set callback for voice state changes
 * @param callback Function to call on state change
 */
void setVoiceStateCallback(VoiceStateCallback callback);

/**
 * Set callback for transcription results
 * @param callback Function to call with transcribed text
 */
void setVoiceTranscriptCallback(VoiceTranscriptCallback callback);

/**
 * Set callback for incoming audio data
 * @param callback Function to call with audio data
 */
void setVoiceAudioCallback(VoiceAudioCallback callback);

/**
 * Called when audio playback completes
 * Restarts microphone and transitions to IDLE state
 */
void onVoicePlaybackComplete();

#endif // VOICE_CLIENT_H
