# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mote** is an open-source ESP32-S3 voice companion device that connects to [clawd.bot](https://clawd.bot). This is a **monorepo** containing:

1. **Firmware** (`firmware/`) - ESP32-S3 C++ firmware (PlatformIO)
2. **Web App** (`apps/web/`) - TanStack Start backend serving API + WebSocket voice handler
3. **Native App** (`apps/native/`) - Expo React Native bridge app

**Voice Pipeline:**
```
ESP32 Mic → BLE/WiFi → Native App → Web Backend → Deepgram STT
                                                 ↓
ESP32 Speaker ← TTS Audio ← ElevenLabs ← Gateway AI ← Wake Word Detected
```

## Common Commands

### Monorepo (uses Bun)

```bash
bun install              # Install all dependencies
bun run dev              # Run all dev servers
bun run build            # Build all packages
bun run dev:native       # Native app only
bun run dev:web          # Web app only

# Database (Drizzle + Neon Postgres)
bun run db:push          # Push schema changes
bun run db:studio        # Open Drizzle Studio
bun run db:generate      # Generate migrations
```

### Firmware (PlatformIO)

```bash
cd firmware
pio run                           # Build
pio run -t upload                 # Upload
pio device monitor                # Serial monitor
pio run -t upload && pio device monitor  # All at once
```

### Native App (Expo)

```bash
cd apps/native
bun start                # Expo dev server
bun ios                  # iOS simulator
bun android              # Android emulator
```

## Architecture

### Monorepo Structure

```
mote/
├── firmware/           # ESP32-S3 C++ (PlatformIO)
├── apps/
│   ├── web/           # TanStack Start + WebSocket server
│   └── native/        # Expo + React Native
├── packages/
│   ├── api/           # oRPC routes + Gateway client
│   ├── auth/          # Better Auth config
│   ├── db/            # Drizzle schema + client
│   ├── env/           # Environment variables
│   └── shared/        # BLE protocol constants
```

### Voice WebSocket Flow

`apps/web/src/websocket/voice-handler.ts` is the core voice orchestrator:

1. ESP32 streams audio continuously via WebSocket (`/api/voice?token=...`)
2. Audio forwarded to Deepgram for real-time transcription
3. Wake word detection via text matching in transcripts
4. ESP32 VAD detects silence → triggers processing
5. Command sent to clawd.bot Gateway via Bridge Protocol
6. AI response synthesized via ElevenLabs (pcm_16000, 1.5x gain)
7. TTS audio sent to ESP32's 60-second PSRAM ring buffer

### Firmware Architecture

Key files in `firmware/src/`:
- `main.cpp` - Entry point, WiFi/BLE mode switching, voice loop
- `voice_client.cpp` - WebSocket client, audio streaming to server
- `audio.cpp` - I2S mic/speaker, ring buffer for TTS playback
- `ble_config.cpp` - BLE config service, volume/WiFi commands
- `mote_face.cpp` - Animated face display (ST7789V LCD)

**Device Modes:**
- `MODE_BLE` - No WiFi config, BLE advertising for setup
- `MODE_WIFI` - Connected to WiFi, voice streaming active

### BLE Protocol

UUIDs (defined in `apps/native/lib/mote-ble-client.ts` and `firmware/src/ble_config.cpp`):
```
Service: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
Status:  beb5483e-36e1-4688-b7f5-ea07361b26a8  (notify)
Config:  beb5483e-36e1-4688-b7f5-ea07361b26a9  (write)
```

Commands via Config characteristic (JSON):
- `{"wifi":"ssid","password":"pass","server":"ws://...","port":3000,"token":"..."}`
- `{"volume":50}` - Set speaker volume (0-100)

### Gateway Bridge Protocol

`packages/api/src/gateway-client.ts` implements clawd.bot communication:
```typescript
// Request/Response pattern with session keys
{ type: "req", id: "uuid", method: "chat.send", params: {...} }
{ type: "res", id: "uuid", ok: true, payload: {...} }
{ type: "event", event: "message.partial", payload: {...} }
```

## Pin Configuration (ESP32-S3)

**Display (SPI - HSPI bus):**
- MOSI: GPIO11, SCLK: GPIO13, CS: GPIO10, DC: GPIO9, RST: GPIO14, BL: GPIO8

**Microphone (I2S0):**
- WS: GPIO39, SCK: GPIO40, SD: GPIO41

**Amplifier (I2S1):**
- BCLK: GPIO16, LRC: GPIO17, DIN: GPIO18

**Battery:** GPIO2 via 100kΩ/100kΩ voltage divider

## Development Notes

### Type Safety

API types flow: `packages/api` → `apps/native` via workspace imports. Changing an oRPC route will cause TypeScript errors in native app if types don't match.

### Audio Streaming

The ESP32 has a 60-second ring buffer in PSRAM (~1MB) for TTS playback. Audio is sent in bulk from the server and buffered locally. Key configuration:

- **Buffer size:** 60 seconds at 16kHz (`AUDIO_RING_BUFFER_SIZE`)
- **ElevenLabs format:** `pcm_16000` (16kHz, 16-bit PCM)
- **Server gain:** 1.5x volume boost (prevents clipping)
- **Underrun timeout:** 5 seconds before stopping playback

The `bufferReady` flag prevents playback before buffer initialization (fixes startup noise).

### Wake Word Blocking

Only accept wake word when voice state is "idle" to prevent interrupted responses. This is enforced in `voice-handler.ts`.

## Git Workflow

- `main` - Production
- `development` - Staging
- Feature branches: `feat/<name>` or `fix/<name>`

Author: `Jonah <jonah@jonahships.com>`

## License

**CC BY-NC-SA 4.0** - Personal use allowed, commercial hardware sales require license from Nebaura Labs.
