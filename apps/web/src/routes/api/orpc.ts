import { createAPIFileRoute } from '@tanstack/react-router/server'
import { createORPCHandler } from 'orpc'
import { appRouter } from '../../api/router'

const handler = createORPCHandler({
  router: appRouter,
})

export const Route = createAPIFileRoute('/api/orpc')({
  GET: async ({ request }) => {
    return handler(request)
  },
  POST: async ({ request }) => {
    return handler(request)
  },
})
