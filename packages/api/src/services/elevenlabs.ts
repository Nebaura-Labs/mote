import { ElevenLabsClient } from "elevenlabs";

/**
 * ElevenLabs Text-to-Speech Service
 * Handles voice synthesis using ElevenLabs API
 */

export interface SynthesisOptions {
	apiKey: string;
	text: string;
	voiceId: string;
	model?: string;
	stability?: number;
	similarityBoost?: number;
	outputFormat?: "mp3_44100_128" | "pcm_16000" | "pcm_22050" | "pcm_24000";
}

export interface SynthesisResult {
	audio: Buffer;
	format: string;
	duration: number;
}

/**
 * Synthesize speech from text using ElevenLabs API
 */
export async function synthesizeSpeech(
	options: SynthesisOptions,
): Promise<SynthesisResult> {
	const {
		apiKey,
		text,
		voiceId,
		model = "eleven_turbo_v2_5",
		stability = 0.5,
		similarityBoost = 0.75,
		outputFormat = "mp3_44100_128",
	} = options;

	try {
		// Create ElevenLabs client
		const client = new ElevenLabsClient({
			apiKey,
		});

		// Generate speech
		const audioStream = await client.generate({
			voice: voiceId,
			text,
			model_id: model,
			voice_settings: {
				stability,
				similarity_boost: similarityBoost,
			},
			output_format: outputFormat,
		});

		// Collect audio chunks
		const chunks: Buffer[] = [];
		for await (const chunk of audioStream) {
			chunks.push(Buffer.from(chunk));
		}

		const audioBuffer = Buffer.concat(chunks);

		// Estimate duration (rough approximation)
		// For MP3 at 44.1kHz, 128kbps: ~16KB per second
		const estimatedDuration = outputFormat.startsWith("mp3")
			? (audioBuffer.length / 16000) * 1000
			: (audioBuffer.length / (16000 * 2)) * 1000; // PCM 16-bit

		return {
			audio: audioBuffer,
			format: outputFormat.startsWith("mp3") ? "mp3" : "pcm",
			duration: Math.round(estimatedDuration),
		};
	} catch (error) {
		console.error("ElevenLabs synthesis error:", error);
		throw new Error(
			`Failed to synthesize speech: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Get available voices for a user's ElevenLabs account
 */
export async function getVoices(apiKey: string) {
	try {
		const client = new ElevenLabsClient({
			apiKey,
		});

		const voicesResponse = await client.voices.getAll();

		return voicesResponse.voices.map((voice) => ({
			id: voice.voice_id,
			name: voice.name,
			category: voice.category,
			description: voice.description,
		}));
	} catch (error) {
		console.error("ElevenLabs get voices error:", error);
		throw new Error(
			`Failed to get voices: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Validate ElevenLabs API key by fetching user info
 */
export async function validateElevenlabsApiKey(apiKey: string): Promise<boolean> {
	try {
		const client = new ElevenLabsClient({
			apiKey,
		});

		// Test API key by fetching user subscription info
		await client.user.get();

		return true;
	} catch (error) {
		console.error("ElevenLabs API key validation failed:", error);
		return false;
	}
}
