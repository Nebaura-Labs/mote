import { pgTable, text, timestamp, integer, boolean, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

// Users table (Better Auth compatible)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  emailVerified: boolean('email_verified').default(false),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Sessions table (Better Auth)
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Accounts table (for OAuth providers)
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  expiresAt: timestamp('expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Mote devices table
export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  bluetoothId: text('bluetooth_id').notNull().unique(),
  lastSeen: timestamp('last_seen'),
  batteryLevel: integer('battery_level'), // 0-100
  firmwareVersion: text('firmware_version'),
  isPaired: boolean('is_paired').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Voice sessions table
export const voiceSessions = pgTable('voice_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  duration: integer('duration'), // in seconds
  audioUrl: text('audio_url'), // S3 or storage URL
  transcription: text('transcription'),
  response: text('response'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Clawd.bot connections table
export const clawdConnections = pgTable('clawd_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  apiKey: text('api_key').notNull(),
  endpoint: text('endpoint').notNull(),
  isActive: boolean('is_active').default(true),
  lastConnected: timestamp('last_connected'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users)
export const selectUserSchema = createSelectSchema(users)

export const insertDeviceSchema = createInsertSchema(devices)
export const selectDeviceSchema = createSelectSchema(devices)

export const insertVoiceSessionSchema = createInsertSchema(voiceSessions)
export const selectVoiceSessionSchema = createSelectSchema(voiceSessions)

export const insertClawdConnectionSchema = createInsertSchema(clawdConnections)
export const selectClawdConnectionSchema = createSelectSchema(clawdConnections)

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Device = typeof devices.$inferSelect
export type NewDevice = typeof devices.$inferInsert

export type VoiceSession = typeof voiceSessions.$inferSelect
export type NewVoiceSession = typeof voiceSessions.$inferInsert

export type ClawdConnection = typeof clawdConnections.$inferSelect
export type NewClawdConnection = typeof clawdConnections.$inferInsert
