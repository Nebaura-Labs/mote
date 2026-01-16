import { createClient, type PrerecordedSchema } from "@deepgram/sdk";

/**
 * Deepgram Speech-to-Text Service
 * Handles audio transcription using Deepgram API
 */

export interface TranscriptionOptions {
	apiKey: string;
	audio: Buffer;
	format?: "pcm" | "wav" | "opus" | "mp3";
	sampleRate?: number;
	language?: string;
	model?: string;
}

export interface TranscriptionResult {
	transcription: string;
	confidence: number;
	duration: number;
	words?: Array<{
		word: string;
		start: number;
		end: number;
		confidence: number;
	}>;
}

/**
 * Transcribe audio using Deepgram API
 */
export async function transcribeAudio(
	options: TranscriptionOptions,
): Promise<TranscriptionResult> {
	const {
		apiKey,
		audio,
		format = "wav",
		sampleRate = 16000,
		language = "en",
		model = "nova-2",
	} = options;

	try {
		// Create Deepgram client
		const deepgram = createClient(apiKey);

		// Transcription options
		const transcriptionOptions: PrerecordedSchema = {
			model,
			language,
			punctuate: true,
			smart_format: true,
			utterances: false,
			diarize: false,
		};

		// Add encoding if PCM
		if (format === "pcm") {
			transcriptionOptions.encoding = "linear16";
			transcriptionOptions.sample_rate = sampleRate;
		}

		// Send audio to Deepgram
		const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
			audio,
			transcriptionOptions,
		);

		if (error) {
			throw new Error(`Deepgram transcription error: ${error.message}`);
		}

		// Extract transcription from result
		const channel = result.results?.channels?.[0];
		const alternative = channel?.alternatives?.[0];

		if (!alternative || !alternative.transcript) {
			throw new Error("No transcription returned from Deepgram");
		}

		return {
			transcription: alternative.transcript,
			confidence: alternative.confidence || 0,
			duration: result.metadata?.duration || 0,
			words: alternative.words?.map((word) => ({
				word: word.word,
				start: word.start,
				end: word.end,
				confidence: word.confidence,
			})),
		};
	} catch (error) {
		console.error("Deepgram transcription error:", error);
		throw new Error(
			`Failed to transcribe audio: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Validate Deepgram API key by making a test request
 */
export async function validateDeepgramApiKey(apiKey: string): Promise<boolean> {
	try {
		const deepgram = createClient(apiKey);

		// Test with a minimal audio buffer (1 second of silence)
		const testAudio = Buffer.alloc(16000 * 2); // 16kHz, 16-bit, 1 channel, 1 second

		await deepgram.listen.prerecorded.transcribeFile(testAudio, {
			model: "nova-2",
			language: "en",
		});

		return true;
	} catch (error) {
		console.error("Deepgram API key validation failed:", error);
		return false;
	}
}
