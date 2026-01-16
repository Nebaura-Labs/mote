import { db, voiceConfig, voiceSession, clawdConnection, encrypt, decrypt } from "@mote/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { randomUUID } from "node:crypto";
import { transcribeAudio } from "../services/deepgram";
import { synthesizeSpeech } from "../services/elevenlabs";

/**
 * Voice assistant router for managing voice configuration and processing
 */
export const voiceRouter = {
	/**
	 * Save or update voice configuration (API keys, voice settings)
	 */
	saveConfig: protectedProcedure
		.input(
			z.object({
				deepgramApiKey: z.string().optional(),
				elevenlabsApiKey: z.string().optional(),
				elevenlabsVoiceId: z.string().min(1, "ElevenLabs Voice ID is required"),
				wakeWord: z.string().optional().default("hey mote"),
				conversationTimeout: z.number().int().min(1000).max(30000).optional().default(5000),
			}),
		)
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;

			// Check if config already exists
			const existing = await db.query.voiceConfig.findFirst({
				where: eq(voiceConfig.userId, userId),
			});

			if (existing) {
				// Update existing configuration
				const updateData: any = {
					elevenlabsVoiceId: input.elevenlabsVoiceId,
					wakeWord: input.wakeWord,
					conversationTimeout: input.conversationTimeout,
					updatedAt: new Date(),
				};

				// Only update API keys if provided
				if (input.deepgramApiKey) {
					updateData.deepgramApiKey = encrypt(input.deepgramApiKey);
				}
				if (input.elevenlabsApiKey) {
					updateData.elevenlabsApiKey = encrypt(input.elevenlabsApiKey);
				}

				await db
					.update(voiceConfig)
					.set(updateData)
					.where(eq(voiceConfig.userId, userId));

				return {
					success: true,
					message: "Voice configuration updated successfully",
				};
			} else {
				// Insert new configuration - require API keys for new configs
				if (!input.deepgramApiKey || !input.elevenlabsApiKey) {
					throw new Error("Deepgram and ElevenLabs API keys are required for initial setup");
				}

				await db.insert(voiceConfig).values({
					userId,
					deepgramApiKey: encrypt(input.deepgramApiKey),
					elevenlabsApiKey: encrypt(input.elevenlabsApiKey),
					elevenlabsVoiceId: input.elevenlabsVoiceId,
					wakeWord: input.wakeWord,
					conversationTimeout: input.conversationTimeout,
				});

				return {
					success: true,
					message: "Voice configuration saved successfully",
				};
			}
		}),

	/**
	 * Get voice configuration (without exposing API keys)
	 */
	getConfig: protectedProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;

		const config = await db.query.voiceConfig.findFirst({
			where: eq(voiceConfig.userId, userId),
		});

		if (!config) {
			return {
				configured: false,
				elevenlabsVoiceId: null,
				wakeWord: "hey mote",
				conversationTimeout: 5000,
			};
		}

		return {
			configured: true,
			elevenlabsVoiceId: config.elevenlabsVoiceId,
			wakeWord: config.wakeWord || "hey mote",
			conversationTimeout: config.conversationTimeout || 5000,
			// API keys are intentionally NOT returned
		};
	}),

	/**
	 * Delete voice configuration
	 */
	deleteConfig: protectedProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;

		await db.delete(voiceConfig).where(eq(voiceConfig.userId, userId));

		return {
			success: true,
			message: "Voice configuration deleted successfully",
		};
	}),

	/**
	 * Speech-to-text transcription using Deepgram
	 */
	transcribe: protectedProcedure
		.input(
			z.object({
				audio: z.string(), // Base64 encoded audio data
				format: z.enum(["pcm", "wav", "opus", "mp3"]).default("wav"),
				sampleRate: z.number().int().default(16000),
			}),
		)
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;

			// Get user's Deepgram API key
			const config = await db.query.voiceConfig.findFirst({
				where: eq(voiceConfig.userId, userId),
			});

			if (!config) {
				throw new Error("Voice configuration not found. Please configure API keys in settings.");
			}

			const deepgramApiKey = decrypt(config.deepgramApiKey);

			// Decode base64 audio
			const audioBuffer = Buffer.from(input.audio, "base64");

			// Transcribe using Deepgram
			const result = await transcribeAudio({
				apiKey: deepgramApiKey,
				audio: audioBuffer,
				format: input.format,
				sampleRate: input.sampleRate,
			});

			return {
				transcription: result.transcription,
				confidence: result.confidence,
				duration: result.duration,
				words: result.words,
			};
		}),

	/**
	 * Text-to-speech synthesis using ElevenLabs
	 */
	synthesize: protectedProcedure
		.input(
			z.object({
				text: z.string().min(1, "Text is required"),
				voiceId: z.string().optional(), // Override default voice ID
			}),
		)
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;

			// Get user's ElevenLabs API key and voice ID
			const config = await db.query.voiceConfig.findFirst({
				where: eq(voiceConfig.userId, userId),
			});

			if (!config) {
				throw new Error("Voice configuration not found. Please configure API keys in settings.");
			}

			const elevenlabsApiKey = decrypt(config.elevenlabsApiKey);
			const voiceId = input.voiceId || config.elevenlabsVoiceId;

			// Synthesize using ElevenLabs
			const result = await synthesizeSpeech({
				apiKey: elevenlabsApiKey,
				text: input.text,
				voiceId,
			});

			return {
				audio: result.audio.toString("base64"),
				format: result.format,
				duration: result.duration,
			};
		}),

	/**
	 * Full voice chat pipeline: transcribe → AI chat → synthesize
	 */
	chat: protectedProcedure
		.input(
			z.object({
				audio: z.string(), // Base64 encoded audio data
				sessionId: z.string().optional(), // For conversation tracking
				deviceId: z.string().optional(), // Mote device identifier
			}),
		)
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;
			const sessionId = input.sessionId || randomUUID();

			const startTime = Date.now();

			// Get user's voice configuration
			const config = await db.query.voiceConfig.findFirst({
				where: eq(voiceConfig.userId, userId),
			});

			if (!config) {
				throw new Error("Voice configuration not found. Please configure API keys in settings.");
			}

			const deepgramApiKey = decrypt(config.deepgramApiKey);
			const elevenlabsApiKey = decrypt(config.elevenlabsApiKey);

			// Step 1: Transcribe audio to text (Deepgram)
			const audioBuffer = Buffer.from(input.audio, "base64");
			const transcriptionResult = await transcribeAudio({
				apiKey: deepgramApiKey,
				audio: audioBuffer,
				format: "wav",
				sampleRate: 16000,
			});
			const transcription = transcriptionResult.transcription;

			// Step 2: Send to clawd.bot Gateway
			// Get user's clawd.bot configuration
			const clawdConfig = await db.query.clawdConnection.findFirst({
				where: eq(clawdConnection.userId, userId),
			});

			if (!clawdConfig) {
				throw new Error("Clawd.bot Gateway not configured. Please configure in Connection settings.");
			}

			// Decrypt the Gateway token
			const gatewayToken = decrypt(clawdConfig.tokenEncrypted);

			// Use the Gateway client to send message
			const { gatewayClientPool } = await import("../gateway-client");
			const client = await gatewayClientPool.getClient(userId, gatewayToken, clawdConfig.gatewayUrl);
			const aiResponseMessage = await client.sendChatMessageAndWait({
				sessionKey: sessionId,
				message: transcription,
				idempotencyKey: randomUUID(),
			});
			const aiResponse = aiResponseMessage.content || "I'm sorry, I couldn't generate a response.";

			// Step 3: Synthesize AI response to speech (ElevenLabs)
			const synthesisResult = await synthesizeSpeech({
				apiKey: elevenlabsApiKey,
				text: aiResponse,
				voiceId: config.elevenlabsVoiceId,
			});
			const audioResponse = synthesisResult.audio.toString("base64");

			const endTime = Date.now();
			const duration = endTime - startTime;

			// Step 4: Log session to database
			// TODO: Create voice_session table in database
			// await db.insert(voiceSession).values({
			// 	id: sessionId,
			// 	userId,
			// 	deviceId: input.deviceId || null,
			// 	transcription,
			// 	response: aiResponse,
			// 	duration,
			// 	startedAt: new Date(startTime),
			// 	endedAt: new Date(endTime),
			// });

			return {
				sessionId,
				transcription,
				response: aiResponse,
				audio: audioResponse,
				duration,
			};
		}),

	/**
	 * Get voice session history
	 */
	getHistory: protectedProcedure
		.input(
			z.object({
				limit: z.number().int().min(1).max(100).default(20),
				offset: z.number().int().min(0).default(0),
			}),
		)
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;

			const sessions = await db.query.voiceSession.findMany({
				where: eq(voiceSession.userId, userId),
				limit: input.limit,
				offset: input.offset,
				orderBy: (voiceSession, { desc }) => [desc(voiceSession.startedAt)],
			});

			return {
				sessions,
				hasMore: sessions.length === input.limit,
			};
		}),

	/**
	 * Delete voice session history
	 */
	clearHistory: protectedProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;

		await db.delete(voiceSession).where(eq(voiceSession.userId, userId));

		return {
			success: true,
			message: "Voice history cleared successfully",
		};
	}),
};
