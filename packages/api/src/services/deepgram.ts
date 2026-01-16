import { createClient, type PrerecordedSchema } from "@deepgram/sdk";
import { EventEmitter } from "events";
import WebSocket from "ws";

/**
 * Deepgram Speech-to-Text Service
 * Handles audio transcription using Deepgram API
 * Supports both batch and real-time streaming transcription
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

/**
 * Streaming Transcription Options
 */
export interface StreamingTranscriptionOptions {
	apiKey: string;
	model?: string;
	language?: string;
	sampleRate?: number;
	encoding?: "linear16" | "opus" | "mp3";
	interimResults?: boolean;
	smartFormat?: boolean;
}

/**
 * Streaming Transcription Events
 */
export interface StreamingTranscriptionEvents {
	transcript: (data: { text: string; isFinal: boolean; confidence: number }) => void;
	error: (error: Error) => void;
	close: () => void;
	open: () => void;
}

/**
 * Real-time Streaming Transcription using Deepgram Live API
 * Uses raw WebSocket to avoid SDK compatibility issues with Node.js 22+
 */
export class StreamingTranscription extends EventEmitter {
	private ws: WebSocket | null = null;
	private apiKey: string;
	private options: StreamingTranscriptionOptions;
	private isOpen: boolean = false;

	constructor(options: StreamingTranscriptionOptions) {
		super();
		this.apiKey = options.apiKey;
		this.options = options;
	}

	/**
	 * Start the streaming connection
	 */
	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				// Build query parameters for Deepgram
				const params = new URLSearchParams({
					model: this.options.model || "nova-2",
					language: this.options.language || "en",
					encoding: this.options.encoding || "linear16",
					sample_rate: String(this.options.sampleRate || 16000),
					channels: "1",
					interim_results: String(this.options.interimResults !== false),
					smart_format: String(this.options.smartFormat !== false),
					punctuate: "true",
					endpointing: "300",
				});

				const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

				// Create WebSocket with proper auth header
				this.ws = new WebSocket(url, {
					headers: {
						Authorization: `Token ${this.apiKey}`,
					},
				});

				// Handle connection open
				this.ws.on("open", () => {
					console.log("[Deepgram] Streaming connection opened");
					this.isOpen = true;
					this.emit("open");
					resolve();
				});

				// Handle messages (transcription results)
				this.ws.on("message", (data: Buffer) => {
					try {
						const response = JSON.parse(data.toString());

						// Handle transcription results
						if (response.type === "Results") {
							const transcript = response.channel?.alternatives?.[0];
							if (transcript && transcript.transcript) {
								this.emit("transcript", {
									text: transcript.transcript,
									isFinal: response.is_final || false,
									confidence: transcript.confidence || 0,
								});
							}
						}
						// Handle metadata
						else if (response.type === "Metadata") {
							console.log("[Deepgram] Metadata:", response);
						}
						// Handle errors from Deepgram
						else if (response.type === "Error") {
							console.error("[Deepgram] Error response:", response);
							this.emit("error", new Error(response.message || "Deepgram error"));
						}
					} catch (e) {
						// Non-JSON message, ignore
					}
				});

				// Handle errors
				this.ws.on("error", (error: Error) => {
					console.error("[Deepgram] Streaming error:", error);
					this.emit("error", error);
					if (!this.isOpen) {
						reject(error);
					}
				});

				// Handle close
				this.ws.on("close", (code: number, reason: Buffer) => {
					console.log(`[Deepgram] Streaming connection closed: ${code} ${reason.toString()}`);
					this.isOpen = false;
					this.emit("close");
				});

			} catch (error) {
				console.error("[Deepgram] Failed to start streaming:", error);
				reject(new Error(
					`Failed to start Deepgram streaming: ${error instanceof Error ? error.message : "Unknown error"}`
				));
			}
		});
	}

	/**
	 * Send audio data to Deepgram
	 * @param audio PCM audio buffer (16-bit, mono)
	 */
	sendAudio(audio: Buffer): void {
		if (this.ws && this.isOpen && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(audio);
		}
	}

	/**
	 * Signal end of speech for faster finalization
	 */
	finalize(): void {
		if (this.ws && this.isOpen && this.ws.readyState === WebSocket.OPEN) {
			// Send a KeepAlive message to help finalize pending transcription
			this.ws.send(JSON.stringify({ type: "KeepAlive" }));
		}
	}

	/**
	 * Close the streaming connection
	 */
	close(): void {
		if (this.ws) {
			// Send CloseStream message for graceful shutdown
			if (this.ws.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({ type: "CloseStream" }));
			}
			this.ws.close();
			this.ws = null;
			this.isOpen = false;
		}
	}

	/**
	 * Check if connection is open
	 */
	isConnected(): boolean {
		return this.isOpen && this.ws?.readyState === WebSocket.OPEN;
	}
}
