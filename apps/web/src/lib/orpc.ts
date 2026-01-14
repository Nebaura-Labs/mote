import orpcPkg from 'orpc'
const { createORPCHandler, createProcedure } = orpcPkg as any
import { z } from 'zod'
import { auth } from '../auth'

// Base procedure (no auth required)
export const publicProcedure = createProcedure()

// Protected procedure (requires authentication)
export const protectedProcedure = publicProcedure.use(async ({ context, next }) => {
  const session = await auth.api.getSession({
    headers: context.req.headers,
  })

  if (!session) {
    throw new Error('Unauthorized')
  }

  return next({
    context: {
      ...context,
      user: session.user,
      session,
    },
  })
})
