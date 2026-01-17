#include "voice_client.h"
#include "audio.h"
#include <WiFi.h>

// WebSocket client
static WebSocketsClient webSocket;

// Connection state
static VoiceState currentVoiceState = VOICE_DISCONNECTED;
static bool wsConnected = false;
static String deviceId;

// Callbacks
static VoiceStateCallback stateCallback = nullptr;
static VoiceTranscriptCallback transcriptCallback = nullptr;
static VoiceAudioCallback audioCallback = nullptr;

// Reconnection
static unsigned long lastReconnectAttempt = 0;
static const unsigned long RECONNECT_INTERVAL = 5000;

/**
 * Set voice state and notify callback
 */
static void setVoiceState(VoiceState newState) {
    if (currentVoiceState != newState) {
        Serial.printf("[Voice] State change: %d -> %d\n", currentVoiceState, newState);
        currentVoiceState = newState;
        if (stateCallback) {
            stateCallback(newState);
        }
    }
}

/**
 * Parse JSON message from server
 * Simple manual parsing to avoid ArduinoJson dependency
 */
static void handleServerMessage(const char* payload, size_t length) {
    String json = String(payload);
    Serial.printf("[Voice] Received: %s\n", payload);

    // Extract message type
    int typeStart = json.indexOf("\"type\":\"") + 8;
    int typeEnd = json.indexOf("\"", typeStart);
    if (typeStart < 8 || typeEnd < 0) {
        Serial.println("[Voice] Failed to parse message type");
        return;
    }
    String msgType = json.substring(typeStart, typeEnd);

    if (msgType == "voice.listening") {
        // Server detected wake word, now listening for command
        setVoiceState(VOICE_LISTENING);
    }
    else if (msgType == "voice.transcription") {
        // Extract transcription text
        int textStart = json.indexOf("\"text\":\"") + 8;
        int textEnd = json.indexOf("\"", textStart);
        if (textStart >= 8 && textEnd > textStart) {
            String text = json.substring(textStart, textEnd);
            Serial.printf("[Voice] Transcription: %s\n", text.c_str());
            if (transcriptCallback) {
                transcriptCallback(text.c_str());
            }
        }
    }
    else if (msgType == "voice.processing") {
        // AI is processing the command
        setVoiceState(VOICE_PROCESSING);
    }
    else if (msgType == "voice.response") {
        // AI response text (before audio)
        int textStart = json.indexOf("\"text\":\"") + 8;
        int textEnd = json.indexOf("\"", textStart);
        if (textStart >= 8 && textEnd > textStart) {
            String text = json.substring(textStart, textEnd);
            Serial.printf("[Voice] AI Response: %s\n", text.c_str());
        }
        setVoiceState(VOICE_SPEAKING);
    }
    else if (msgType == "voice.done") {
        // Interaction complete, ready for next
        finishAudioStream();  // Signal that audio stream is complete
        restartMicrophone();  // Restart microphone I2S for fresh wake word detection
        setVoiceState(VOICE_IDLE);
    }
    else if (msgType == "voice.error") {
        // Error occurred
        int errorStart = json.indexOf("\"error\":\"") + 9;
        int errorEnd = json.indexOf("\"", errorStart);
        if (errorStart >= 9 && errorEnd > errorStart) {
            String error = json.substring(errorStart, errorEnd);
            Serial.printf("[Voice] Error: %s\n", error.c_str());
        }
        setVoiceState(VOICE_IDLE);
    }
}

/**
 * WebSocket event handler
 */
static void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[Voice] WebSocket disconnected");
            wsConnected = false;
            setVoiceState(VOICE_DISCONNECTED);
            break;

        case WStype_CONNECTED:
            Serial.printf("[Voice] WebSocket connected to: %s\n", payload);
            wsConnected = true;

            // Send initial voice.start message
            {
                String startMsg = "{\"type\":\"voice.start\",\"deviceId\":\"" + deviceId + "\"}";
                webSocket.sendTXT(startMsg);
                Serial.println("[Voice] Sent voice.start");
            }
            setVoiceState(VOICE_IDLE);
            break;

        case WStype_TEXT:
            handleServerMessage((const char*)payload, length);
            break;

        case WStype_BIN:
            // Binary audio data from server (ElevenLabs TTS response)
            Serial.printf("[Voice] Received %d bytes of audio\n", length);
            if (audioCallback) {
                audioCallback(payload, length);
            }
            break;

        case WStype_ERROR:
            Serial.printf("[Voice] WebSocket error\n");
            break;

        case WStype_PING:
            Serial.println("[Voice] Ping received");
            break;

        case WStype_PONG:
            Serial.println("[Voice] Pong received");
            break;

        default:
            break;
    }
}

bool setupVoiceClient(const char* server, uint16_t port, const char* token) {
    Serial.println("[Voice] Setting up voice client...");

    // Store device ID for messages
    deviceId = WiFi.macAddress();
    deviceId.replace(":", "");

    // Build WebSocket path with token
    String path = "/ws/voice?token=" + String(token);

    // Check if server is a local/private IP (no SSL needed)
    String serverStr = String(server);
    bool isLocalNetwork = serverStr.startsWith("10.") ||
                          serverStr.startsWith("192.168.") ||
                          serverStr.startsWith("172.") ||
                          serverStr.startsWith("127.") ||
                          serverStr.equals("localhost");

    if (isLocalNetwork) {
        Serial.printf("[Voice] Connecting to ws://%s:%d%s (no SSL - local network)\n", server, port, path.c_str());
        webSocket.begin(server, port, path.c_str());
    } else {
        Serial.printf("[Voice] Connecting to wss://%s:%d%s (SSL)\n", server, port, path.c_str());
        webSocket.beginSSL(server, port, path.c_str());
    }

    webSocket.onEvent(webSocketEvent);

    // Set reconnect interval
    webSocket.setReconnectInterval(RECONNECT_INTERVAL);

    // Enable heartbeat for connection keep-alive
    webSocket.enableHeartbeat(15000, 3000, 2);

    Serial.println("[Voice] Voice client setup complete");
    return true;
}

void handleVoiceClient() {
    webSocket.loop();
}

bool isVoiceConnected() {
    return wsConnected;
}

VoiceState getVoiceState() {
    return currentVoiceState;
}

bool sendVoiceAudio(const int16_t* samples, size_t count) {
    if (!wsConnected) {
        // Debug: Log why audio isn't being sent
        static unsigned long lastWsLog = 0;
        if (millis() - lastWsLog > 5000) {
            Serial.println("[Voice] Cannot send audio: WebSocket not connected");
            lastWsLog = millis();
        }
        return false;
    }

    // Only stream audio when in IDLE or LISTENING state
    if (currentVoiceState != VOICE_IDLE && currentVoiceState != VOICE_LISTENING) {
        return false;
    }

    // Send binary PCM data
    size_t bytes = count * sizeof(int16_t);
    bool sent = webSocket.sendBIN((const uint8_t*)samples, bytes);

    if (!sent) {
        Serial.println("[Voice] Failed to send audio data");
    }

    return sent;
}

void sendVoiceSilence() {
    if (!wsConnected) {
        return;
    }

    String silenceMsg = "{\"type\":\"voice.silence\"}";
    webSocket.sendTXT(silenceMsg);
    // Don't log every silence message to avoid spam
}

void disconnectVoice() {
    Serial.println("[Voice] Disconnecting...");
    webSocket.disconnect();
    wsConnected = false;
    setVoiceState(VOICE_DISCONNECTED);
}

void setVoiceStateCallback(VoiceStateCallback callback) {
    stateCallback = callback;
}

void setVoiceTranscriptCallback(VoiceTranscriptCallback callback) {
    transcriptCallback = callback;
}

void setVoiceAudioCallback(VoiceAudioCallback callback) {
    audioCallback = callback;
}
