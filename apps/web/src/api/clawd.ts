import orpcPkg from 'orpc'
const { createRouter } = orpcPkg as any
import { protectedProcedure } from '../lib/orpc'
import { z } from 'zod'
import { db } from '../db'
import { clawdConnections } from '../db/schema'
import { eq } from 'drizzle-orm'

export const clawdRouter = createRouter({
  connect: protectedProcedure
    .input(
      z.object({
        apiKey: z.string(),
        endpoint: z.string().url(),
      })
    )
    .mutation(async ({ input, context }) => {
      // Check if user already has a connection
      const existing = await db
        .select()
        .from(clawdConnections)
        .where(eq(clawdConnections.userId, context.user.id))
        .limit(1)

      if (existing[0]) {
        // Update existing connection
        const updated = await db
          .update(clawdConnections)
          .set({
            apiKey: input.apiKey,
            endpoint: input.endpoint,
            isActive: true,
            lastConnected: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(clawdConnections.userId, context.user.id))
          .returning()

        return updated[0]
      }

      // Create new connection
      const connection = await db
        .insert(clawdConnections)
        .values({
          userId: context.user.id,
          apiKey: input.apiKey,
          endpoint: input.endpoint,
          isActive: true,
          lastConnected: new Date(),
        })
        .returning()

      return connection[0]
    }),

  disconnect: protectedProcedure.mutation(async ({ context }) => {
    await db
      .update(clawdConnections)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(clawdConnections.userId, context.user.id))

    return { success: true }
  }),

  getStatus: protectedProcedure.query(async ({ context }) => {
    const connection = await db
      .select()
      .from(clawdConnections)
      .where(eq(clawdConnections.userId, context.user.id))
      .limit(1)

    return connection[0] || null
  }),
})
