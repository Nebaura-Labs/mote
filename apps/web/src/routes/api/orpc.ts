import { createFileRoute } from '@tanstack/react-router'
import orpcPkg from 'orpc'
import { appRouter } from '../../api/router'

const { createORPCHandler } = orpcPkg as any

const handler = createORPCHandler({
  router: appRouter,
})

export const Route = createFileRoute('/api/orpc')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return handler(request)
      },
      POST: async ({ request }) => {
        return handler(request)
      },
    },
  },
})
