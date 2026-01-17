# Mote Gateway Server

The gateway server that bridges the Mote ESP32 device to clawd.bot and voice services.

## Overview

This is a **TanStack Start** application that provides:
- WebSocket server for real-time voice communication with Mote devices
- Integration with Deepgram for speech-to-text
- Integration with ElevenLabs for text-to-speech
- Bridge to clawd.bot for AI conversations
- Web dashboard for device management

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [TanStack Start](https://tanstack.com/start) | Full-stack React framework |
| [TanStack Router](https://tanstack.com/router) | Type-safe routing |
| [TanStack Query](https://tanstack.com/query) | Data fetching and caching |
| [oRPC](https://orpc.dev) | Type-safe API layer |
| [Drizzle ORM](https://orm.drizzle.team) | Database ORM |
| [Better Auth](https://better-auth.com) | Authentication |
| [Tailwind CSS v4](https://tailwindcss.com) | Styling |
| [Vite](https://vite.dev) | Build tool |

## Voice Services

| Service | Purpose |
|---------|---------|
| [Deepgram](https://deepgram.com) | Real-time speech-to-text (Nova-2 model) |
| [ElevenLabs](https://elevenlabs.io) | Text-to-speech synthesis |
| [clawd.bot](https://clawd.bot) | AI conversation backend |

## Project Structure

```
apps/web/
├── src/
│   ├── routes/              # TanStack Router pages
│   ├── websocket/
│   │   └── voice-handler.ts # Core voice WebSocket handler
│   ├── components/          # React components
│   └── lib/                 # Utilities
├── package.json
└── vite.config.ts
```

## Key Files

### `src/websocket/voice-handler.ts`

The core voice orchestrator that handles:
1. WebSocket connections from Mote devices
2. Audio streaming to Deepgram for transcription
3. Wake word detection in transcripts
4. Sending commands to clawd.bot
5. TTS synthesis via ElevenLabs
6. Streaming audio back to devices

```typescript
// Voice session configuration
const ttsResult = await synthesizeSpeech({
  outputFormat: "pcm_16000",  // 16kHz PCM for ESP32
  useSpeakerBoost: true,      // ElevenLabs speaker boost
  gain: 1.5,                  // Volume boost (prevents clipping)
});
```

## Environment Variables

Create a `.env` file:

```bash
# clawd.bot - Required
CLAWD_API_KEY=your_clawd_key
CLAWD_ENDPOINT=https://your-instance.clawd.bot

# Voice services
DEEPGRAM_API_KEY=your_deepgram_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id

# Database (Neon Postgres)
DATABASE_URL=postgres://...

# Auth
BETTER_AUTH_SECRET=your_secret
```

## Development

```bash
# From monorepo root
bun run dev:web

# Or directly
cd apps/web
bun dev
```

Server runs on `http://localhost:3000`

WebSocket endpoint: `ws://localhost:3000/api/voice?token=...`

## Build

```bash
bun run build
bun run serve  # Preview production build
```

## WebSocket Protocol

### Client → Server

| Message | Format | Description |
|---------|--------|-------------|
| Binary | PCM 16-bit | Audio data from microphone |
| `{"type":"voice.silence"}` | JSON | Speech ended (VAD triggered) |

### Server → Client

| Message | Format | Description |
|---------|--------|-------------|
| `{"type":"voice.listening"}` | JSON | Wake word detected |
| `{"type":"voice.processing"}` | JSON | AI generating response |
| `{"type":"voice.speaking"}` | JSON | TTS playback starting |
| `{"type":"voice.done"}` | JSON | Response complete |
| Binary | PCM 16-bit | TTS audio data |

## Dependencies

Key dependencies from `package.json`:

```json
{
  "@tanstack/react-start": "^1.141.1",
  "@tanstack/react-router": "^1.141.1",
  "@tanstack/react-query": "^5.80.6",
  "@orpc/server": "catalog:",
  "drizzle-orm": "^0.45.1",
  "better-auth": "catalog:",
  "ws": "^8.19.0",
  "tailwindcss": "^4.1.3",
  "vite": "^7.0.2"
}
```

## Related

- [Main README](../../README.md)
- [Native App](../native/README.md)
- [Firmware](../../firmware/CLAUDE.md)
