import { createFileRoute } from '@tanstack/react-router'
import { createORPCHandler } from 'orpc'
import { appRouter } from '../../api/router'

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
