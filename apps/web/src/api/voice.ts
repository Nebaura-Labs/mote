import orpcPkg from 'orpc'
const { createRouter } = orpcPkg as any
import { protectedProcedure } from '../lib/orpc'
import { z } from 'zod'
import { db } from '../db'
import { voiceSessions } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'

export const voiceRouter = createRouter({
  startSession: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, context }) => {
      const session = await db
        .insert(voiceSessions)
        .values({
          deviceId: input.deviceId,
          userId: context.user.id,
          startedAt: new Date(),
        })
        .returning()

      return session[0]
    }),

  endSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        transcription: z.string().optional(),
        response: z.string().optional(),
        audioUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, context }) => {
      const session = await db
        .select()
        .from(voiceSessions)
        .where(
          and(eq(voiceSessions.id, input.sessionId), eq(voiceSessions.userId, context.user.id))
        )
        .limit(1)

      if (!session[0]) {
        throw new Error('Session not found')
      }

      const duration = Math.floor((Date.now() - session[0].startedAt.getTime()) / 1000)

      const updated = await db
        .update(voiceSessions)
        .set({
          endedAt: new Date(),
          duration,
          transcription: input.transcription,
          response: input.response,
          audioUrl: input.audioUrl,
        })
        .where(eq(voiceSessions.id, input.sessionId))
        .returning()

      return updated[0]
    }),

  getHistory: protectedProcedure
    .input(
      z
        .object({
          deviceId: z.string().uuid().optional(),
          limit: z.number().min(1).max(100).default(20),
        })
        .optional()
    )
    .query(async ({ input, context }) => {
      const query = db
        .select()
        .from(voiceSessions)
        .where(eq(voiceSessions.userId, context.user.id))
        .orderBy(desc(voiceSessions.startedAt))
        .limit(input?.limit || 20)

      const sessions = await query

      return sessions
    }),
})
