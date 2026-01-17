# Mote Mobile App

React Native mobile app for configuring and managing Mote devices via Bluetooth Low Energy (BLE).

## Overview

This is an **Expo** application that provides:
- BLE scanning and connection to Mote devices
- WiFi configuration for devices
- Gateway server configuration
- Device status monitoring
- Chat interface for testing clawd.bot integration

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Expo](https://expo.dev) | React Native framework |
| [Expo Router](https://docs.expo.dev/router/introduction/) | File-based routing |
| [React Native BLE PLX](https://github.com/dotintent/react-native-ble-plx) | Bluetooth Low Energy |
| [HeroUI Native](https://heroui.com) | UI component library |
| [TanStack Query](https://tanstack.com/query) | Data fetching |
| [oRPC](https://orpc.dev) | Type-safe API client |
| [Better Auth](https://better-auth.com) | Authentication |
| [Tailwind CSS](https://tailwindcss.com) + [Uniwind](https://uniwind.dev) | Styling |

## Project Structure

```
apps/native/
├── app/                    # Expo Router screens
│   ├── (drawer)/          # Drawer navigation screens
│   │   ├── index.tsx      # Home/device list
│   │   ├── chat.tsx       # Chat interface
│   │   └── settings.tsx   # App settings
│   └── _layout.tsx        # Root layout
├── components/            # React components
├── contexts/
│   └── MoteHardwareContext.tsx  # BLE state management
├── lib/
│   ├── mote-ble-client.ts # BLE communication client
│   └── mote-protocol.ts   # Device protocol types
└── package.json
```

## Key Files

### `lib/mote-ble-client.ts`

BLE client for communicating with Mote devices:

```typescript
// BLE UUIDs
const MOTE_SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const MOTE_STATUS_CHAR = "beb5483e-36e1-4688-b7f5-ea07361b26a8";  // Notify
const MOTE_CONFIG_CHAR = "beb5483e-36e1-4688-b7f5-ea07361b26a9";  // Write
```

### `contexts/MoteHardwareContext.tsx`

React context for managing device state:
- Device scanning and discovery
- Connection management
- Auto-reconnect on disconnect
- Configuration read/write

## BLE Protocol

### Configuration Commands (Write to Config Characteristic)

```json
// WiFi + Gateway configuration
{
  "wifi": "MyNetwork",
  "password": "secret123",
  "server": "your-gateway.com",
  "port": 443,
  "token": "auth-token"
}

// Volume control
{ "volume": 50 }
```

### Status Notifications (Subscribe to Status Characteristic)

```json
{
  "state": "idle",      // idle, listening, processing, speaking
  "battery": 85,        // Battery percentage
  "wifi": true,         // WiFi connected
  "volume": 50          // Current volume
}
```

## Development

### Prerequisites

- Node.js 18+
- Bun
- Xcode (for iOS)
- Android Studio (for Android)
- Physical device with BLE (simulators don't support BLE)

### Setup

```bash
# From monorepo root
bun install

# Run native app
bun run dev:native

# Or directly
cd apps/native
bun start
```

### Running on Device

```bash
# iOS
bun ios

# Android
bun android

# With Expo Go (limited - no BLE)
bun start
```

### Prebuild (Native Code)

```bash
# Generate native projects
bun prebuild

# Then build
bun ios
bun android
```

## Environment Variables

The app inherits environment variables from the monorepo. Key variables:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
```

## Dependencies

Key dependencies from `package.json`:

```json
{
  "expo": "^54.0.23",
  "expo-router": "~6.0.14",
  "react-native": "0.81.5",
  "react-native-ble-plx": "^3.3.3",
  "heroui-native": "^1.0.0-beta.9",
  "@tanstack/react-query": "^5.90.12",
  "@orpc/client": "catalog:",
  "better-auth": "catalog:",
  "tailwindcss": "^4.1.18"
}
```

## Troubleshooting

### BLE Issues

| Issue | Solution |
|-------|----------|
| Can't find device | Ensure Mote is in BLE mode (no saved WiFi config) |
| Connection fails | Check device is advertising, try restarting Mote |
| Permissions denied | Grant Bluetooth permissions in device settings |
| Simulator BLE | Use physical device - simulators don't support BLE |

### Build Issues

| Issue | Solution |
|-------|----------|
| Prebuild fails | Delete `ios/` and `android/` folders, run `bun prebuild` |
| Pod install fails | `cd ios && pod install --repo-update` |
| Metro bundler issues | `bun start --clear` |

## Related

- [Main README](../../README.md)
- [Gateway Server](../web/README.md)
- [Firmware](../../firmware/CLAUDE.md)
- [BLE Protocol](../../firmware/src/ble_config.cpp)
