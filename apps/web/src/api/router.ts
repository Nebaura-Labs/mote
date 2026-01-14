import orpcPkg from 'orpc'
const { createRouter } = orpcPkg as any
import { authRouter } from './auth'
import { devicesRouter } from './devices'
import { voiceRouter } from './voice'
import { clawdRouter } from './clawd'

export const appRouter = createRouter({
  auth: authRouter,
  devices: devicesRouter,
  voice: voiceRouter,
  clawd: clawdRouter,
})

// Export type for client
export type AppRouter = typeof appRouter
