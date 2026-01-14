# GREPTILE.md

This file provides context for Greptile AI when reviewing pull requests for the Mote project.

## Project Overview

**Mote** is an open-source ESP32-S3 voice companion device that connects to clawd.bot personal AI gateway. This is a monorepo containing three interconnected components:

1. **ESP32-S3 Firmware** - C++ embedded code using Arduino framework
2. **TanStack Start Web App** - TypeScript backend serving REST-like API via oRPC
3. **Expo Mobile App** - React Native bridge between hardware and web API

**Critical Architecture Flow:**
```
Mote Hardware (ESP32) ←BLE/WiFi→ Mobile App ←HTTP→ Web API ←→ clawd.bot
```

## Technology Stack

### Firmware (firmware/)
- **Language:** C++ (Arduino framework)
- **Platform:** ESP32-S3 N16R8 (16MB flash, 8MB PSRAM)
- **Build System:** PlatformIO
- **Key Libraries:**
  - TFT_eSPI or LovyanGFX (2" IPS LCD display)
  - ESP32 I2S (INMP441 mic + MAX98357A amp)
  - ESP32 BLE (Bluetooth Low Energy)
  - Picovoice Porcupine (wake word detection)

### Web App (apps/web/)
- **Framework:** TanStack Start (React + file-based routing + SSR)
- **Language:** TypeScript
- **Database:** Neon Postgres
- **ORM:** Drizzle ORM
- **Authentication:** Better Auth (email/password)
- **API:** oRPC (type-safe RPC framework)
- **UI:** Hero UI + Tailwind CSS v4
- **Testing:** Vitest
- **Build:** Vite v7

### Mobile App (apps/mobile/)
- **Framework:** Expo v54 + React Native 0.81
- **Language:** TypeScript
- **Navigation:** Expo Router v5 (file-based)
- **Styling:** NativeWind v4 (Tailwind CSS for React Native)
- **API Client:** oRPC client with full type safety
- **State Management:** TanStack Query v5
- **Bluetooth:** react-native-ble-plx v3
- **Audio:** Expo AV v15
- **Icons:** lucide-react-native

### Shared Packages
- **@mote/shared:** Device constants, GPIO pins, BLE protocol enums (TypeScript)
- **@mote/api-client:** Re-exports AppRouter type from web for mobile type safety

### Monorepo Tools
- **Package Manager:** pnpm v8.15.1 with workspaces
- **Build System:** Turborepo v1.11
- **Formatting:** Prettier v3.2
- **License:** CC BY-NC-SA 4.0 (non-commercial)

## Database Schema (Neon Postgres)

### Tables

**users** (Better Auth)
- id (uuid, PK)
- email (text, unique, not null)
- name (text)
- emailVerified (boolean)
- image (text)
- createdAt, updatedAt (timestamp)

**sessions** (Better Auth)
- id (uuid, PK)
- userId (uuid, FK → users)
- expiresAt (timestamp, not null)
- token (text, unique, not null)
- ipAddress, userAgent (text)
- createdAt (timestamp)

**accounts** (OAuth providers, Better Auth)
- id (uuid, PK)
- userId (uuid, FK → users)
- accountId, providerId (text, not null)
- accessToken, refreshToken, idToken (text)
- expiresAt (timestamp)
- scope, password (text)
- createdAt, updatedAt (timestamp)

**devices** (Mote hardware devices)
- id (uuid, PK)
- userId (uuid, FK → users, cascade delete)
- name (text, not null)
- bluetoothId (text, unique, not null)
- lastSeen (timestamp)
- batteryLevel (integer, 0-100)
- firmwareVersion (text)
- isPaired (boolean, default true)
- createdAt, updatedAt (timestamp)

**voiceSessions** (Voice interaction logs)
- id (uuid, PK)
- deviceId (uuid, FK → devices, cascade delete)
- userId (uuid, FK → users, cascade delete)
- startedAt, endedAt (timestamp)
- duration (integer, seconds)
- audioUrl (text, S3 or storage URL)
- transcription, response (text)
- createdAt (timestamp)

**clawdConnections** (User's clawd.bot API config)
- id (uuid, PK)
- userId (uuid, FK → users, cascade delete, unique)
- apiKey (text, not null)
- endpoint (text, not null)
- isActive (boolean, default true)
- lastConnected (timestamp)
- createdAt, updatedAt (timestamp)

### Relationships
- User has many Devices (1:N)
- User has many VoiceSessions (1:N)
- Device has many VoiceSessions (1:N)
- User has one ClawdConnection (1:1)

## API Structure (oRPC)

### Endpoint: /api/orpc (GET/POST)

### Routes

**auth** (apps/web/src/api/auth.ts)
- `login({ email, password })` → { user, token }
- `signup({ email, password, name })` → { user, token }
- `logout()` → { success }
- `me()` → { user }

**devices** (apps/web/src/api/devices.ts)
- `list()` → Device[]
- `pair({ name, bluetoothId })` → Device
- `unpair({ deviceId })` → { success }
- `updateStatus({ deviceId, batteryLevel, lastSeen })` → Device

**voice** (apps/web/src/api/voice.ts)
- `startSession({ deviceId })` → { sessionId }
- `sendAudio({ sessionId, audioData })` → { success }
- `endSession({ sessionId, duration })` → VoiceSession

**clawd** (apps/web/src/api/clawd.ts)
- `connect({ apiKey, endpoint })` → ClawdConnection
- `disconnect({ connectionId })` → { success }
- `status()` → { isConnected, endpoint }

### Type Safety
- All routes use Zod schemas for validation
- AppRouter type is exported from `apps/web/src/api/router.ts`
- Mobile app imports AppRouter from `@mote/api-client` for type-safe calls
- Changes to web API automatically create TypeScript errors in mobile if incompatible

## Code Patterns and Conventions

### File Structure

**Web App Routes (TanStack Start)**
```
apps/web/src/routes/
├── __root.tsx           # Root layout with HeroUIProvider
├── index.tsx            # Landing page
└── api/
    └── orpc.ts          # oRPC handler (GET/POST)
```

**Mobile App Routes (Expo Router)**
```
apps/mobile/app/
├── _layout.tsx          # Root with QueryClientProvider
├── (tabs)/              # Tab group (layout.tsx + screens)
│   ├── index.tsx        # Home
│   ├── devices.tsx      # Devices
│   └── settings.tsx     # Settings
└── (auth)/              # Auth group
    ├── login.tsx
    └── signup.tsx
```

### Naming Conventions

**Files:**
- React components: PascalCase (e.g., `Header.tsx`)
- Routes: lowercase with hyphens (e.g., `api/orpc.ts`)
- Utilities: camelCase (e.g., `bluetooth.ts`)
- Types: PascalCase (e.g., `DeviceStatus`)

**Database:**
- Tables: camelCase (e.g., `voiceSessions`)
- Columns: camelCase (e.g., `batteryLevel`)
- Foreign keys: `<table>Id` (e.g., `userId`)

**API:**
- Routes: camelCase (e.g., `startSession`)
- Input objects: camelCase keys
- Return objects: camelCase keys

**Components:**
- React components: PascalCase
- Props interfaces: `<Component>Props`
- Hooks: `use<Name>`

### Styling

**Web App:**
- Tailwind CSS v4 (no config needed for basic usage)
- Hero UI components with `@heroui/react`
- Global styles in `src/styles/globals.css`
- CSS modules allowed but prefer Tailwind

**Mobile App:**
- NativeWind (Tailwind classes in React Native)
- Standard RN components with `className` prop
- Color scheme: primary-500 (#0ea5e9), gray scale
- Use `lucide-react-native` for icons

### Type Safety Requirements

**Web to Mobile Communication:**
1. All API routes must have Zod input/output schemas
2. Changes to `apps/web/src/api/router.ts` must maintain type compatibility
3. Mobile app must import `AppRouter` from `@mote/api-client`
4. Never use `any` type in API routes or mobile API client

**Database:**
1. Use Drizzle ORM, never raw SQL
2. All tables must have Zod schemas via `createInsertSchema` / `createSelectSchema`
3. Export TypeScript types from schema using `$inferSelect` / `$inferInsert`

## PR Review Checklist

### All PRs

- [ ] No secrets, API keys, or DATABASE_URL committed
- [ ] No `console.log` left in production code (dev only)
- [ ] No `any` types in TypeScript
- [ ] Prettier formatting applied (`pnpm format`)
- [ ] Commit messages follow convention: `feat:`, `fix:`, `chore:`, `docs:`
- [ ] Branch naming: `feat/<name>`, `fix/<name>`
- [ ] PR target: feature → `development`, not `main`

### Web App PRs

- [ ] Database schema changes include migration via `pnpm db:generate`
- [ ] All API routes have Zod validation schemas
- [ ] Protected routes use auth middleware
- [ ] oRPC router type exported for mobile compatibility
- [ ] Better Auth tables not manually modified
- [ ] Environment variables documented if added
- [ ] Vitest tests pass (`pnpm test`)
- [ ] No direct database queries, use Drizzle ORM

### Mobile App PRs

- [ ] API calls use `@mote/api-client` AppRouter type
- [ ] Permissions declared in `app.json` (Bluetooth, microphone, location)
- [ ] NativeWind classes used, not inline styles
- [ ] Bluetooth operations handle Android 12+ permission model
- [ ] Audio recording requests permissions before use
- [ ] Error handling for BLE disconnections
- [ ] Loading states for async operations
- [ ] iOS and Android bundle identifiers: `com.nebaurastudio.mote`

### Firmware PRs

- [ ] Pin definitions match `packages/shared/src/index.ts`
- [ ] No hardcoded GPIO pin numbers in code
- [ ] I2S sample rates match (typically 16kHz for voice)
- [ ] Battery voltage calculation uses 2:1 divider formula
- [ ] Display backlight pin (GPIO17) controlled
- [ ] Volume control scales PCM samples correctly
- [ ] Serial output baud rate matches PlatformIO config
- [ ] Flash/RAM usage within ESP32-S3 limits

### Shared Packages PRs

- [ ] Breaking changes in `@mote/shared` update firmware and apps
- [ ] BLE command enums match firmware implementation
- [ ] Pin definitions match actual hardware wiring
- [ ] Types exported for use in other packages

## Common Issues to Check

### Type Safety Issues
❌ **Bad:** Using `any` type in API client
```typescript
const api = createClient<any>({ baseUrl: '...' })
```

✅ **Good:** Using AppRouter type
```typescript
import type { AppRouter } from '@mote/api-client'
const api = createClient<AppRouter>({ baseUrl: '...' })
```

### Database Issues
❌ **Bad:** Raw SQL queries
```typescript
await db.execute(sql`SELECT * FROM users WHERE id = ${id}`)
```

✅ **Good:** Drizzle ORM
```typescript
await db.select().from(users).where(eq(users.id, id))
```

### Bluetooth Permission Issues
❌ **Bad:** Not handling Android 12+ permissions
```typescript
await PermissionsAndroid.request(BLUETOOTH)
```

✅ **Good:** Requesting all required permissions
```typescript
if (Platform.Version >= 31) {
  await PermissionsAndroid.requestMultiple([
    BLUETOOTH_SCAN,
    BLUETOOTH_CONNECT,
    ACCESS_FINE_LOCATION
  ])
}
```

### API Route Issues
❌ **Bad:** No input validation
```typescript
export const route = procedure.mutation(({ input }) => {
  return db.insert(devices).values(input)
})
```

✅ **Good:** Zod schema validation
```typescript
export const route = procedure
  .input(z.object({
    name: z.string().min(1),
    bluetoothId: z.string().length(17)
  }))
  .mutation(async ({ input }) => {
    return db.insert(devices).values(input)
  })
```

### Environment Variable Issues
❌ **Bad:** Hardcoded URLs or keys
```typescript
const API_URL = 'https://mote.nebaura.studio/api'
```

✅ **Good:** Environment-aware
```typescript
const API_URL = __DEV__
  ? 'http://localhost:3000/api/orpc'
  : 'https://mote.nebaura.studio/api/orpc'
```

## Testing Requirements

### Web App
- Unit tests for utility functions (Vitest)
- Integration tests for API routes (optional but recommended)
- Test database operations with mock data
- Run: `pnpm --filter @mote/web test`

### Mobile App
- Test Bluetooth service with mock BLE manager
- Test API client with mock server
- Test audio recording permissions
- Run: `pnpm --filter @mote/mobile test`

### Firmware
- Unit tests for calculation functions (PlatformIO)
- Hardware-in-the-loop tests for I2S (optional)
- Run: `cd firmware && pio test`

## Performance Considerations

### Web App
- Use Drizzle's `with()` for eager loading related data
- Avoid N+1 queries (use joins)
- Index foreign keys in schema
- Use connection pooling (Neon handles this)

### Mobile App
- Lazy load screens with Expo Router
- Use TanStack Query caching for API calls
- Debounce BLE status updates
- Compress audio data before sending

### Firmware
- Use DMA for I2S transfers
- Minimize SPI transactions for display updates
- Use PSRAM for large buffers (audio, display)
- Sleep ESP32 when idle to save battery

## Security Considerations

### Secrets
- DATABASE_URL never committed (in .gitignore)
- Clawd API keys stored encrypted in database
- Better Auth handles password hashing
- Session tokens in httpOnly cookies (Better Auth)

### API
- All protected routes require authentication
- Input validation with Zod schemas
- Rate limiting recommended (not yet implemented)
- CORS configured in TanStack Start

### Mobile
- API keys in SecureStore (Expo)
- No sensitive data in AsyncStorage
- HTTPS only in production
- Certificate pinning recommended (not yet implemented)

## Breaking Changes Policy

When making breaking changes:

1. **Web API:** Update version in response headers, maintain backward compatibility for 1 version
2. **Mobile App:** Bump version in `app.json`, notify users to update
3. **Firmware:** Update `firmwareVersion` in device registration, add to changelog
4. **Shared Packages:** Major version bump if types change, update all consumers

## Git Commit Conventions

```
feat: Add new feature
fix: Bug fix
chore: Maintenance (deps, config)
docs: Documentation only
refactor: Code change without behavior change
test: Add or update tests
perf: Performance improvement
```

Examples:
- `feat: Add device pairing flow`
- `fix: Bluetooth reconnection on Android`
- `chore: Update Expo to v54`
- `docs: Update CLAUDE.md with new API routes`

## License Compliance

**CC BY-NC-SA 4.0 - Key Points:**
- All new files must retain license header if added
- Attribution to Nebaura Labs required
- Non-commercial use only
- Derivative works must use same license

**What to Reject in PRs:**
- Code that enables commercial hardware sales without permission
- Removal of license headers or attribution
- Addition of incompatible licenses (MIT, Apache, etc.)

## Contact and Resources

- **Repository:** https://github.com/Nebaura-Labs/mote
- **Web:** https://nebaura.studio
- **Clawd.bot:** https://clawd.bot
- **Author:** Jonah <jonah@jonahships.com>

## Additional Context

### Hardware Constraints
- ESP32-S3: 16MB flash, 8MB PSRAM
- Display: 240×320 pixels, 16-bit color
- Battery: 3.7V LiPo, monitor with voltage divider on GPIO34
- Audio: 16kHz sample rate for voice

### Known Limitations
- BLE UUIDs in mobile app are placeholders (firmware not yet implemented)
- No file upload for audio (currently base64 encoded)
- No OAuth providers configured (only email/password)
- No rate limiting on API
- No firmware OTA updates yet

### Future Roadmap
- OAuth providers (Google, Apple)
- Firmware OTA updates
- Audio file streaming (not base64)
- Wake word customization
- Multiple device support per user
- Voice session analytics dashboard
