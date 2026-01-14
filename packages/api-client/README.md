# @mote/api-client

Shared API client types for the Mote monorepo.

## Purpose

This package re-exports the `AppRouter` type from the web app, allowing the mobile app to have fully type-safe API calls through oRPC.

## Usage

```typescript
import { createClient } from 'orpc'
import type { AppRouter } from '@mote/api-client'

const api = createClient<AppRouter>({
  baseUrl: 'http://localhost:3000/api/orpc'
})

// Type-safe API calls
const user = await api.auth.me()
const devices = await api.devices.list()
```

## Type Safety

By importing the `AppRouter` type, the mobile app gets:
- Auto-completion for all API endpoints
- Type checking for request/response payloads
- Compile-time errors if the API changes

This ensures the mobile app stays in sync with the backend API.
