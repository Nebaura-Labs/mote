# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mote** is an open-source ESP32-S3 voice companion device that connects to [clawd.bot](https://clawd.bot). This is a **monorepo** containing three main components:

1. **Firmware** (`firmware/`) - ESP32-S3 C++ firmware (PlatformIO)
2. **Web App** (`apps/web/`) - TanStack Start backend serving landing page + oRPC API
3. **Mobile App** (`apps/mobile/`) - Expo React Native bridge app

**Architecture Flow:**
```
Mote Hardware → Mobile App (Bluetooth/WiFi) → Web API → clawd.bot AI Gateway
```

The mobile app bridges between the hardware device and the web backend, which interfaces with the user's clawd.bot instance.

## Monorepo Structure

This is a **Turborepo + pnpm workspace** monorepo with the following structure:

```
mote/
├── firmware/              # ESP32-S3 firmware (PlatformIO, C++)
├── apps/
│   ├── web/              # TanStack Start (TypeScript, API + Landing)
│   └── mobile/           # Expo + Expo Router (TypeScript, React Native)
├── packages/
│   ├── shared/           # Device constants, BLE protocol (TypeScript)
│   └── api-client/       # Shared oRPC types (TypeScript)
├── package.json          # Root workspace config
├── turbo.json           # Turborepo pipeline
└── pnpm-workspace.yaml  # pnpm workspace config
```

## Common Commands

### Monorepo-wide Commands

```bash
# Install all dependencies
pnpm install

# Run all dev servers concurrently
pnpm dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Format code with Prettier
pnpm format
```

### Web App Development

```bash
# Start web dev server (port 3000)
pnpm web:dev

# Build for production
pnpm web:build

# Database commands (Drizzle + Neon Postgres)
pnpm db:generate    # Generate migrations
pnpm db:migrate     # Run migrations
pnpm db:push        # Push schema changes directly
pnpm db:studio      # Open Drizzle Studio
```

### Mobile App Development

```bash
# Start Expo dev server
pnpm mobile:start

# Run on iOS simulator
pnpm mobile:ios

# Run on Android emulator
pnpm mobile:android
```

### Firmware Development

```bash
# Build firmware
pnpm firmware:build
# Or: cd firmware && pio run

# Upload to device
pnpm firmware:upload
# Or: cd firmware && pio run -t upload

# Monitor serial output
pnpm firmware:monitor
# Or: cd firmware && pio device monitor

# Build, upload, and monitor in one command
cd firmware && pio run -t upload && pio device monitor
```

**Note:** Firmware development requires PlatformIO installed. See `firmware/CLAUDE.md` for detailed firmware architecture.

## Git Workflow

This project uses a **branch-based workflow**:

1. **`main`** - Production-ready code
2. **`development`** - Staging branch for integration
3. **Feature branches** - `feat/<feature-name>` or `fix/<bug-name>`

**Workflow:**
```bash
# Create feature branch from development
git checkout development
git pull origin development
git checkout -b feat/my-feature

# Make changes and commit
git add .
git commit -m "feat: Add my feature"

# Push and create PR to development
git push origin feat/my-feature
# Create PR: feat/my-feature → development

# After approval, merge to development
# Later, development → main for releases
```

**Git config:**
- Author: `Jonah <jonah@jonahships.com>`

## Web App Architecture (apps/web/)

### Stack

- **Framework:** TanStack Start (React + file-based routing + SSR)
- **Database:** Neon Postgres
- **ORM:** Drizzle ORM
- **Authentication:** Better Auth
- **API:** oRPC (type-safe RPC)
- **UI:** Hero UI + Tailwind CSS
- **Testing:** Vitest

### Key Files

- `src/routes/__root.tsx` - Root layout with HeroUIProvider
- `src/routes/api/orpc.ts` - oRPC API handler (GET/POST)
- `src/api/router.ts` - Main oRPC router combining all routes
- `src/api/auth.ts` - Authentication routes (login, signup, logout, me)
- `src/api/devices.ts` - Device management (pair, unpair, list, updateStatus)
- `src/api/voice.ts` - Voice session management (startSession, sendAudio, endSession)
- `src/api/clawd.ts` - Clawd.bot connection (connect, disconnect, status)
- `src/db/schema.ts` - Database schema (users, devices, voiceSessions, clawdConnections)
- `src/db/index.ts` - Drizzle client
- `src/auth/index.ts` - Better Auth instance
- `drizzle.config.ts` - Drizzle Kit configuration

### Database Schema

**Core Tables:**
- `users` - User accounts (Better Auth compatible)
- `sessions` - Auth sessions
- `accounts` - OAuth providers (Better Auth)
- `devices` - Paired Mote devices (bluetoothId, batteryLevel, firmwareVersion)
- `voiceSessions` - Voice interaction logs (deviceId, duration, transcription, response)
- `clawdConnections` - User's clawd.bot API connections (apiKey, endpoint)

**Relationships:**
- Users have many devices
- Devices have many voice sessions
- Users have one clawd connection

### oRPC API Structure

The API is organized into routers:

```typescript
appRouter = {
  auth: { login, signup, logout, me },
  devices: { list, pair, unpair, updateStatus },
  voice: { startSession, sendAudio, endSession },
  clawd: { connect, disconnect, status }
}
```

All routes are served at `/api/orpc` via GET/POST.

### Environment Variables

Required in `apps/web/.env`:

```bash
DATABASE_URL=postgresql://...  # Neon Postgres connection string
```

## Mobile App Architecture (apps/mobile/)

### Stack

- **Framework:** Expo + React Native
- **Navigation:** Expo Router (file-based)
- **Styling:** NativeWind (Tailwind for React Native)
- **API:** oRPC client (type-safe via `@mote/api-client`)
- **State:** TanStack Query
- **Bluetooth:** react-native-ble-plx
- **Audio:** Expo AV
- **Icons:** lucide-react-native

### Key Files

- `app/_layout.tsx` - Root layout with QueryClientProvider
- `app/(tabs)/_layout.tsx` - Tab navigation (Home, Devices, Settings)
- `app/(tabs)/index.tsx` - Home screen
- `app/(tabs)/devices.tsx` - Device management
- `app/(tabs)/settings.tsx` - Settings
- `app/(auth)/login.tsx` - Login screen
- `app/(auth)/signup.tsx` - Signup screen
- `lib/api.ts` - oRPC client with type-safe API calls
- `lib/bluetooth.ts` - Bluetooth service (scan, connect, send audio)
- `lib/audio.ts` - Audio recording service (Expo AV)

### API Client

The mobile app imports the `AppRouter` type from `@mote/api-client` to get full type safety:

```typescript
import type { AppRouter } from '@mote/api-client'
const api = createClient<AppRouter>({ baseUrl: '...' })

// All API calls are type-checked
const devices = await api.devices.list()
```

The API automatically switches between dev and production:
- Dev: `http://localhost:3000/api/orpc`
- Prod: `https://mote.nebaura.studio/api/orpc`

### Bluetooth Service

BLE UUIDs (TODO: Update with actual firmware UUIDs):
- Service: `00000000-0000-1000-8000-00805f9b34fb`
- Audio: `00000001-0000-1000-8000-00805f9b34fb`
- Command: `00000002-0000-1000-8000-00805f9b34fb`
- Status: `00000003-0000-1000-8000-00805f9b34fb`

Flow:
1. Request Bluetooth permissions (Android 12+ needs multiple permissions)
2. Scan for devices with "Mote" in the name
3. Connect to selected device
4. Subscribe to status updates (battery level)
5. Send audio data and commands

## Shared Packages

### @mote/shared (packages/shared/)

Contains hardware pin definitions and BLE protocol constants shared between firmware and apps:

- `MOTE_PINS` - GPIO pin mappings (display, mic, amp, buttons, battery)
- `BLECommand` enum - Command codes for BLE communication
- Device types: `DeviceStatus`, `AudioPacket`

### @mote/api-client (packages/api-client/)

Re-exports the `AppRouter` type from the web app, enabling type-safe API calls in the mobile app:

```typescript
export type { AppRouter } from '@mote/web/src/api/router'
export type { User, Device, VoiceSession, ClawdConnection } from '@mote/web/src/db/schema'
```

This ensures compile-time checking when the mobile app calls the web API.

## Firmware Architecture

See `firmware/CLAUDE.md` for comprehensive firmware documentation.

**Key Points:**
- ESP32-S3 N16R8 (16MB flash, 8MB PSRAM)
- 2" IPS LCD display with animated face
- I2S microphone and amplifier
- Bluetooth Low Energy communication
- Battery monitoring via ADC
- Physical volume and mute controls

## Development Workflow

### Starting from Fresh Clone

```bash
# 1. Install dependencies
pnpm install

# 2. Set up web app environment
cd apps/web
cp .env.example .env
# Add DATABASE_URL

# 3. Push database schema
pnpm db:push

# 4. Start all dev servers
pnpm dev

# Or start individually:
pnpm web:dev       # Web on :3000
pnpm mobile:start  # Expo on :8081
```

### Making Changes

1. **Web API changes:**
   - Modify `apps/web/src/api/*.ts`
   - Update schema in `apps/web/src/db/schema.ts` if needed
   - Run `pnpm db:push` to update database
   - Type safety automatically propagates to mobile via `@mote/api-client`

2. **Mobile UI changes:**
   - Modify `apps/mobile/app/**/*.tsx`
   - NativeWind Tailwind classes work out of the box
   - API calls are type-checked against web backend

3. **Firmware changes:**
   - Modify `firmware/src/main.cpp`
   - Update pin definitions in `packages/shared/src/index.ts` if needed
   - Build and upload: `cd firmware && pio run -t upload`

### Type Safety Between Apps

The monorepo ensures end-to-end type safety:

```
Web API (TypeScript) → @mote/api-client → Mobile App (TypeScript)
```

When you change an API route, the mobile app will show TypeScript errors if the types don't match. This prevents runtime errors.

## Testing

### Web App Tests

```bash
cd apps/web
pnpm test        # Run all tests
pnpm test:watch  # Watch mode
```

### Firmware Tests

```bash
cd firmware
pio test         # Run PlatformIO tests
```

## Deployment

### Web App

TanStack Start can be deployed to:
- Vercel (recommended)
- Netlify
- Cloudflare Pages
- Node.js server

Build command: `pnpm web:build`

### Mobile App

```bash
# Build for iOS
pnpm mobile:ios --no-dev

# Build for Android
pnpm mobile:android --no-dev

# EAS Build (Expo Application Services)
cd apps/mobile
eas build --platform ios
eas build --platform android
```

### Database Migrations

```bash
# Generate migration files
pnpm db:generate

# Apply migrations to production
pnpm db:migrate
```

## License

**CC BY-NC-SA 4.0** (Creative Commons Attribution-NonCommercial-ShareAlike 4.0)

- ✅ Personal use and modification allowed
- ✅ Share under same license
- ❌ Commercial hardware sales prohibited without license
- ❌ Cannot remove attribution

Contact Nebaura Labs for commercial licensing.

## Important Notes

1. **Database URL**: Never commit `DATABASE_URL` or any secrets. Use `.env` files (already in `.gitignore`)

2. **BLE UUIDs**: The Bluetooth service UUIDs in `apps/mobile/lib/bluetooth.ts` are placeholders. Update them to match the firmware once implemented.

3. **Clawd.bot Integration**: Users need their own clawd.bot API key and endpoint configured in the `clawdConnections` table.

4. **Hardware Testing**: Bluetooth and audio features require testing on physical devices, not just simulators.

5. **Pin Definitions**: Always reference `packages/shared/src/index.ts` for GPIO pin mappings. Do not hardcode pins elsewhere.

6. **API Changes**: When modifying the web API, verify that mobile app types are still valid by running `pnpm mobile:start` and checking for TypeScript errors.
