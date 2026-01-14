# Mote Mobile App

The Mote mobile app is built with Expo and Expo Router, providing a companion interface for the Mote voice assistant hardware.

## Features

- **Device Management**: Pair and manage Mote devices via Bluetooth
- **Voice Sessions**: Record and send voice commands to Clawd through the Mote device
- **Real-time Status**: Monitor battery level and connection status
- **Authentication**: Sign in to sync devices across platforms

## Tech Stack

- **Framework**: Expo + React Native
- **Navigation**: Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **API**: oRPC for type-safe API calls to the web backend
- **State Management**: TanStack Query
- **Bluetooth**: react-native-ble-plx
- **Audio**: Expo AV

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- iOS Simulator (Mac) or Android Emulator
- Physical device for Bluetooth testing

### Development

```bash
# From the monorepo root
pnpm mobile:start

# Or directly in the mobile app
cd apps/mobile
pnpm start

# Run on specific platform
pnpm ios      # iOS simulator
pnpm android  # Android emulator
```

## Project Structure

```
apps/mobile/
├── app/                    # Expo Router file-based routes
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Home screen
│   │   ├── devices.tsx    # Device management
│   │   └── settings.tsx   # Settings
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── _layout.tsx        # Root layout
├── components/            # Reusable UI components
├── lib/                   # Core functionality
│   ├── api.ts            # oRPC API client
│   ├── bluetooth.ts      # Bluetooth service
│   └── audio.ts          # Audio recording
├── assets/               # Images, fonts, etc.
└── app.json              # Expo configuration
```

## Key Features

### Bluetooth Connection

The app uses `react-native-ble-plx` to connect to Mote devices via Bluetooth Low Energy (BLE). The connection flow:

1. Scan for nearby Mote devices
2. Connect to selected device
3. Subscribe to status updates (battery level, etc.)
4. Send audio data and commands

### Voice Recording

Voice recording is handled by Expo AV with the following flow:

1. Request microphone permissions
2. Start recording when wake word is detected
3. Stream audio data to Mote device via Bluetooth
4. Mote device forwards to Clawd through the backend API

### Type-Safe API

The mobile app uses the `@mote/api-client` package to get full type safety with the backend API:

```typescript
import { api } from './lib/api'

// All endpoints are type-safe
const devices = await api.devices.list()
const session = await api.voice.startSession({ deviceId })
```

## Environment Variables

The app automatically switches between dev and production API URLs:

- **Development**: `http://localhost:3000/api/orpc`
- **Production**: `https://mote.nebaura.studio/api/orpc`

## Building for Production

```bash
# iOS
pnpm build:ios

# Android
pnpm build:android
```

## Contributing

See the main repository README for contribution guidelines.

## License

CC BY-NC-SA 4.0 - See LICENSE file
