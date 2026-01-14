import { createRouter } from 'orpc'
import { protectedProcedure } from '../lib/orpc'
import { z } from 'zod'
import { db } from '../db'
import { devices, insertDeviceSchema } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export const devicesRouter = createRouter({
  list: protectedProcedure.query(async ({ context }) => {
    const userDevices = await db
      .select()
      .from(devices)
      .where(eq(devices.userId, context.user.id))

    return userDevices
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, context }) => {
      const device = await db
        .select()
        .from(devices)
        .where(and(eq(devices.id, input.id), eq(devices.userId, context.user.id)))
        .limit(1)

      if (!device[0]) {
        throw new Error('Device not found')
      }

      return device[0]
    }),

  pair: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        bluetoothId: z.string(),
        firmwareVersion: z.string().optional(),
      })
    )
    .mutation(async ({ input, context }) => {
      const newDevice = await db
        .insert(devices)
        .values({
          userId: context.user.id,
          name: input.name,
          bluetoothId: input.bluetoothId,
          firmwareVersion: input.firmwareVersion,
          isPaired: true,
          lastSeen: new Date(),
        })
        .returning()

      return newDevice[0]
    }),

  unpair: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, context }) => {
      await db
        .delete(devices)
        .where(and(eq(devices.id, input.id), eq(devices.userId, context.user.id)))

      return { success: true }
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        batteryLevel: z.number().min(0).max(100).optional(),
        firmwareVersion: z.string().optional(),
      })
    )
    .mutation(async ({ input, context }) => {
      const updated = await db
        .update(devices)
        .set({
          batteryLevel: input.batteryLevel,
          firmwareVersion: input.firmwareVersion,
          lastSeen: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(devices.id, input.id), eq(devices.userId, context.user.id)))
        .returning()

      return updated[0]
    }),
})
