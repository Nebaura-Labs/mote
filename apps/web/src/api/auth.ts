import { createRouter } from 'orpc'
import { publicProcedure } from '../lib/orpc'
import { z } from 'zod'
import { auth } from '../auth'

export const authRouter = createRouter({
  signUp: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().optional(),
      })
    )
    .mutation(async ({ input, context }) => {
      const result = await auth.api.signUpEmail({
        body: {
          email: input.email,
          password: input.password,
          name: input.name,
        },
      })
      return result
    }),

  signIn: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await auth.api.signInEmail({
        body: {
          email: input.email,
          password: input.password,
        },
      })
      return result
    }),

  signOut: publicProcedure.mutation(async ({ context }) => {
    await auth.api.signOut({
      headers: context.req.headers,
    })
    return { success: true }
  }),

  getSession: publicProcedure.query(async ({ context }) => {
    const session = await auth.api.getSession({
      headers: context.req.headers,
    })
    return session
  }),
})
