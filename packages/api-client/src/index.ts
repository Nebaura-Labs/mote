// Re-export the AppRouter type from the web app
// This allows the mobile app to have type-safe API calls

export type { AppRouter } from '@mote/web/src/api/router'

// Re-export types from the web app API
export type { User, Device, VoiceSession, ClawdConnection } from '@mote/web/src/db/schema'
