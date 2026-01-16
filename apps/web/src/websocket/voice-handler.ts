import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import crypto from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { db, session, voiceConfig, clawdConnection, decrypt } from "@mote/db";
import { eq } from "drizzle-orm";
import { StreamingTranscription } from "@mote/api/services/deepgram";
import { synthesizeSpeech } from "@mote/api/services/elevenlabs";
import { GatewayClient, gatewayClientPool } from "@mote/api/gateway-client";

/**
 * Voice WebSocket Handler
 *
 * Handles real-time voice streaming from Mote devices:
 * 1. Receives PCM audio from device
 * 2. Streams to Deepgram for real-time STT
 * 3. Detects wake word via text matching
 * 4. Sends command to Gateway AI
 * 5. Returns ElevenLabs TTS audio
 */

interface VoiceSession {
  ws: WebSocket;
  userId: string;
  deviceId: string;
  sessionKey: string; // Persistent session key for Gateway (Discord format)
  voiceConfig: {
    deepgramApiKey: string;
    elevenlabsApiKey: string;
    elevenlabsVoiceId: string;
    wakeWord: string;
    conversationTimeout: number;
  };
  transcription: StreamingTranscription | null;
  gatewayClient: GatewayClient | null;
  state: "idle" | "listening" | "processing" | "speaking";
  transcriptBuffer: string;
  wakeWordDetected: boolean;
  commandBuffer: string;
}

/**
 * Active voice sessions by device ID
 */
const voiceSessions = new Map<string, VoiceSession>();

/**
 * WebSocket server for voice connections
 */
const voiceWss = new WebSocketServer({ noServer: true });

/**
 * Handle voice WebSocket upgrade
 */
export async function handleVoiceWebSocketUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer
) {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    console.log(`[voice-ws] Connection attempt - Token present: ${!!token}`);

    if (!token) {
      console.error("[voice-ws] No token provided");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    // Validate token against database
    const sessionRecord = await db.query.session.findFirst({
      where: eq(session.token, token),
      with: {
        user: true,
      },
    });

    if (!sessionRecord || !sessionRecord.user) {
      console.error("[voice-ws] Invalid or expired session token");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    if (sessionRecord.expiresAt < new Date()) {
      console.error("[voice-ws] Session expired");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const userId = sessionRecord.userId;
    console.log(`[voice-ws] Authenticated user ${userId} via token`);

    // Get user's voice config
    const userVoiceConfig = await db.query.voiceConfig.findFirst({
      where: eq(voiceConfig.userId, userId),
    });

    if (!userVoiceConfig) {
      console.error(`[voice-ws] No voice config for user ${userId}`);
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\nVoice configuration required\r\n");
      socket.destroy();
      return;
    }

    // Upgrade to WebSocket
    voiceWss.handleUpgrade(req, socket, head, (ws) => {
      handleVoiceConnection(ws, userId, userVoiceConfig);
    });

  } catch (error) {
    console.error("[voice-ws] Error during upgrade:", error);
    socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
    socket.destroy();
  }
}

/**
 * Handle established voice WebSocket connection
 */
async function handleVoiceConnection(
  ws: WebSocket,
  userId: string,
  config: typeof voiceConfig.$inferSelect
) {
  let deviceId = "";

  console.log(`[voice-ws] User ${userId} connected`);

  // Wait for voice.start message to get device ID
  ws.on("message", async (data: Buffer, isBinary: boolean) => {
    try {
      if (isBinary) {
        // Binary data = PCM audio
        await handleAudioData(deviceId, data);
      } else {
        // Text data = JSON message
        const message = JSON.parse(data.toString());
        await handleTextMessage(ws, userId, config, message, deviceId, (id) => {
          deviceId = id;
        });
      }
    } catch (error) {
      console.error(`[voice-ws] Error handling message:`, error);
      sendMessage(ws, {
        type: "voice.error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  ws.on("close", () => {
    console.log(`[voice-ws] User ${userId} disconnected`);
    if (deviceId) {
      cleanupSession(deviceId);
    }
  });

  ws.on("error", (error) => {
    console.error(`[voice-ws] Error for user ${userId}:`, error);
  });
}

/**
 * Handle text (JSON) messages from device
 */
async function handleTextMessage(
  ws: WebSocket,
  userId: string,
  config: typeof voiceConfig.$inferSelect,
  message: any,
  currentDeviceId: string,
  setDeviceId: (id: string) => void
) {
  console.log(`[voice-ws] Received message: ${message.type}`);

  switch (message.type) {
    case "voice.start": {
      const deviceId = message.deviceId || `device-${Date.now()}`;
      setDeviceId(deviceId);

      // Clean up existing session if any
      cleanupSession(deviceId);

      // Create persistent session key (Discord format to inherit bot personality)
      // Format: agent:{agentId}:discord:channel:mote-hardware-{userId}
      // This ensures voice conversations persist across sessions
      const sessionKey = `agent:main:discord:channel:mote-hardware-${userId.substring(0, 8)}`;

      // Create new voice session (decrypt API keys)
      const voiceSession: VoiceSession = {
        ws,
        userId,
        deviceId,
        sessionKey,
        voiceConfig: {
          deepgramApiKey: decrypt(config.deepgramApiKey),
          elevenlabsApiKey: decrypt(config.elevenlabsApiKey),
          elevenlabsVoiceId: config.elevenlabsVoiceId,
          wakeWord: (config.wakeWord || "hey mote").toLowerCase(),
          conversationTimeout: config.conversationTimeout || 5000,
        },
        transcription: null,
        gatewayClient: null,
        state: "idle",
        transcriptBuffer: "",
        wakeWordDetected: false,
        commandBuffer: "",
      };

      console.log(`[voice-ws] Using persistent session key: ${sessionKey}`);

      voiceSessions.set(deviceId, voiceSession);

      // Start Deepgram streaming transcription
      try {
        await startTranscription(voiceSession);
      } catch (error) {
        console.error(`[voice-ws] Failed to start Deepgram:`, error);
        sendMessage(ws, {
          type: "voice.error",
          error: `Deepgram error: ${error instanceof Error ? error.message : "Unknown"}`,
        });
        // Continue without transcription - will need to fix config
      }

      // Set up Gateway connection
      try {
        await setupGatewayConnection(voiceSession);
      } catch (error) {
        console.error(`[voice-ws] Failed to setup Gateway connection:`, error);
        // Continue without Gateway - will return error messages
      }

      console.log(`[voice-ws] Session started for device ${deviceId}`);
      break;
    }

    case "voice.silence": {
      // Use currentDeviceId (stored from voice.start) since silence message doesn't include it
      const session = voiceSessions.get(currentDeviceId);
      if (session) {
        // Only process if we have a wake word AND a command
        // Don't finalize transcription if we're still waiting for a command
        if (session.wakeWordDetected && session.commandBuffer.trim()) {
          console.log(`[voice-ws] Processing command for device ${currentDeviceId}: "${session.commandBuffer}"`);

          // Finalize transcription before processing
          if (session.transcription) {
            session.transcription.finalize();
          }

          await processCommand(session);
        } else if (session.wakeWordDetected && !session.commandBuffer.trim()) {
          // Wake word detected but no command yet - keep listening
          // Don't finalize transcription, wait for more speech
          console.log(`[voice-ws] Wake word detected but no command yet, continuing to listen...`);
        }
        // If no wake word detected, just ignore silence (normal background)
      }
      break;
    }

    default:
      console.log(`[voice-ws] Unknown message type: ${message.type}`);
  }
}

/**
 * Handle binary audio data from device
 */
async function handleAudioData(deviceId: string, audio: Buffer) {
  const session = voiceSessions.get(deviceId);
  if (!session) {
    return;
  }

  // Send audio to Deepgram for transcription
  if (session.transcription && session.transcription.isConnected()) {
    session.transcription.sendAudio(audio);
  }
}

/**
 * Start Deepgram streaming transcription
 */
async function startTranscription(session: VoiceSession) {
  const transcription = new StreamingTranscription({
    apiKey: session.voiceConfig.deepgramApiKey,
    sampleRate: 16000,
    encoding: "linear16",
    interimResults: true,
    smartFormat: true,
  });

  transcription.on("open", () => {
    console.log(`[voice-ws] Deepgram connected for device ${session.deviceId}`);
  });

  transcription.on("transcript", (data) => {
    handleTranscript(session, data);
  });

  transcription.on("error", (error) => {
    console.error(`[voice-ws] Deepgram error for ${session.deviceId}:`, error);
    sendMessage(session.ws, {
      type: "voice.error",
      error: `Transcription error: ${error.message}`,
    });
  });

  transcription.on("close", () => {
    console.log(`[voice-ws] Deepgram closed for device ${session.deviceId}`);
  });

  await transcription.start();
  session.transcription = transcription;
}

/**
 * Handle transcription results from Deepgram
 */
function handleTranscript(
  session: VoiceSession,
  data: { text: string; isFinal: boolean; confidence: number }
) {
  const text = data.text.toLowerCase();
  // Normalize text by removing punctuation for wake word matching
  const normalizedText = text.replace(/[.,!?;:'"]/g, "");
  console.log(`[voice-ws] Transcript: "${data.text}" (final: ${data.isFinal})`);

  // Send transcription to device
  sendMessage(session.ws, {
    type: "voice.transcription",
    text: data.text,
    isFinal: data.isFinal,
  });

  // Accumulate transcript
  if (data.isFinal) {
    session.transcriptBuffer += " " + data.text;
    session.transcriptBuffer = session.transcriptBuffer.trim();
  }

  // Check for wake word (using normalized text without punctuation)
  if (!session.wakeWordDetected && normalizedText.includes(session.voiceConfig.wakeWord)) {
    console.log(`[voice-ws] Wake word detected: "${session.voiceConfig.wakeWord}"`);
    session.wakeWordDetected = true;
    session.state = "listening";
    session.commandBuffer = "";

    // Extract command after wake word (use normalized text for index lookup)
    const wakeWordIndex = normalizedText.indexOf(session.voiceConfig.wakeWord);
    const afterWakeWord = normalizedText.substring(
      wakeWordIndex + session.voiceConfig.wakeWord.length
    ).trim();

    if (afterWakeWord) {
      session.commandBuffer = afterWakeWord;
      console.log(`[voice-ws] Initial command after wake word: "${afterWakeWord}"`);
    }

    // Notify device we're listening
    sendMessage(session.ws, { type: "voice.listening" });
  } else if (session.wakeWordDetected && data.isFinal) {
    // Capture command after wake word is detected
    const normalizedFinal = text.replace(/[.,!?;:'"]/g, "");
    const wakeWord = session.voiceConfig.wakeWord;

    if (normalizedFinal.includes(wakeWord)) {
      // This transcript contains the wake word - extract command after it
      const idx = normalizedFinal.indexOf(wakeWord);
      const commandPart = normalizedFinal.substring(idx + wakeWord.length).trim();
      if (commandPart) {
        session.commandBuffer = commandPart;
        console.log(`[voice-ws] Command (with wake word): "${commandPart}"`);
      }
    } else {
      // This transcript is AFTER the wake word (doesn't contain it)
      // This IS the command - capture it directly
      const commandPart = normalizedFinal.trim();
      if (commandPart) {
        session.commandBuffer = commandPart;
        console.log(`[voice-ws] Command (follow-up): "${commandPart}"`);
      }
    }
  }
}

/**
 * Process user command and send to Gateway AI
 */
async function processCommand(session: VoiceSession) {
  const command = session.commandBuffer.trim();
  if (!command) {
    session.wakeWordDetected = false;
    session.state = "idle";
    sendMessage(session.ws, { type: "voice.done" });
    return;
  }

  console.log(`[voice-ws] Processing command: "${command}"`);
  session.state = "processing";
  sendMessage(session.ws, { type: "voice.processing" });

  try {
    // Send to Gateway AI
    let responseText = "";

    if (session.gatewayClient && session.gatewayClient.isClientConnected()) {
      responseText = await sendToGateway(
        session.gatewayClient,
        session.sessionKey,
        command
      );
    } else {
      responseText = "Sorry, I'm not connected to the Gateway. Please check your settings.";
    }

    console.log(`[voice-ws] AI response: "${responseText}"`);

    // Send response text to device
    sendMessage(session.ws, {
      type: "voice.response",
      text: responseText,
    });

    // Synthesize speech with ElevenLabs
    session.state = "speaking";
    const ttsResult = await synthesizeSpeech({
      apiKey: session.voiceConfig.elevenlabsApiKey,
      text: responseText,
      voiceId: session.voiceConfig.elevenlabsVoiceId,
      outputFormat: "pcm_16000", // PCM for ESP32 playback
    });

    // Send audio to device in chunks (8KB chunks for ESP32)
    const CHUNK_SIZE = 8192;
    for (let i = 0; i < ttsResult.audio.length; i += CHUNK_SIZE) {
      const chunk = ttsResult.audio.subarray(i, i + CHUNK_SIZE);
      session.ws.send(chunk);
    }

    // Done
    session.wakeWordDetected = false;
    session.commandBuffer = "";
    session.transcriptBuffer = "";
    session.state = "idle";
    sendMessage(session.ws, { type: "voice.done" });

  } catch (error) {
    console.error(`[voice-ws] Error processing command:`, error);
    sendMessage(session.ws, {
      type: "voice.error",
      error: error instanceof Error ? error.message : "Failed to process command",
    });
    session.wakeWordDetected = false;
    session.state = "idle";
  }
}

/**
 * Set up Gateway connection for AI communication
 * Uses the existing GatewayClient which handles SSH tunnel and Bridge Protocol
 */
async function setupGatewayConnection(session: VoiceSession) {
  try {
    // Get user's clawd configuration for Gateway URL and token
    const config = await db.query.clawdConnection.findFirst({
      where: eq(clawdConnection.userId, session.userId),
    });

    if (!config) {
      console.error(`[voice-ws] No clawd configuration found for user ${session.userId}`);
      return;
    }

    // Decrypt the Gateway token
    const token = decrypt(config.tokenEncrypted);

    // Get or create Gateway client from pool
    // This handles SSH tunnel and Bridge Protocol authentication
    const client = await gatewayClientPool.getClient(session.userId, token, config.gatewayUrl);
    session.gatewayClient = client;

    console.log(`[voice-ws] Gateway connected for device ${session.deviceId}`);
  } catch (error) {
    console.error(`[voice-ws] Failed to connect Gateway:`, error);
    // Continue without Gateway - will return error messages
  }
}

/**
 * Send message to Gateway AI and wait for response
 * Uses the GatewayClient which handles Bridge Protocol
 */
async function sendToGateway(
  client: GatewayClient,
  sessionKey: string,
  message: string
): Promise<string> {
  const idempotencyKey = crypto.randomUUID();

  console.log(`[voice-ws] Sending to Gateway: "${message}" with sessionKey: ${sessionKey}`);

  // Use GatewayClient's sendChatMessageAndWait which handles:
  // - Bridge Protocol request format
  // - Waiting for response events
  // - Accumulating text from deltas
  const response = await client.sendChatMessageAndWait({
    sessionKey,
    message,
    idempotencyKey,
  });

  console.log(`[voice-ws] Gateway response received (runId: ${response.runId})`);
  return response.content;
}

/**
 * Send JSON message to device
 */
function sendMessage(ws: WebSocket, message: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Clean up voice session
 */
function cleanupSession(deviceId: string) {
  const session = voiceSessions.get(deviceId);
  if (session) {
    if (session.transcription) {
      session.transcription.close();
    }
    // Note: GatewayClient is pooled per user, don't disconnect it here
    // Other sessions might be using the same client
    session.gatewayClient = null;
    voiceSessions.delete(deviceId);
    console.log(`[voice-ws] Session cleaned up for device ${deviceId}`);
  }
}

/**
 * Get active voice session count (for monitoring)
 */
export function getActiveVoiceSessionCount(): number {
  return voiceSessions.size;
}
