import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";

/**
 * Voice configuration for each user
 * Stores API keys (encrypted) and voice settings
 */
export const voiceConfig = pgTable("voice_config", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),

	// API Keys (encrypted with AES-256)
	deepgramApiKey: text("deepgram_api_key").notNull(),
	elevenlabsApiKey: text("elevenlabs_api_key").notNull(),
	elevenlabsVoiceId: text("elevenlabs_voice_id").notNull(),

	// Voice settings
	wakeWord: text("wake_word").default("hey mote"),
	conversationTimeout: integer("conversation_timeout").default(5000), // milliseconds

	// Timestamps
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Voice session logs
 * Tracks each voice interaction with the device
 */
export const voiceSession = pgTable("voice_session", {
	id: text("id").primaryKey(), // UUID
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),

	// Device information
	deviceId: text("device_id"), // Mote MAC address or identifier

	// Session data
	transcription: text("transcription"), // What user said
	response: text("response"), // AI response text
	duration: integer("duration"), // Total session duration in ms

	// Audio storage (optional)
	audioUrl: text("audio_url"), // S3/storage URL if we save recordings

	// Timestamps
	startedAt: timestamp("started_at").defaultNow().notNull(),
	endedAt: timestamp("ended_at"),
});

// Export types for use in API
export type VoiceConfig = typeof voiceConfig.$inferSelect;
export type VoiceConfigInsert = typeof voiceConfig.$inferInsert;
export type VoiceSession = typeof voiceSession.$inferSelect;
export type VoiceSessionInsert = typeof voiceSession.$inferInsert;
