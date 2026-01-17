# Nebaura Labs Mote

**Mote - An open-source ESP32-S3 voice companion for Clawd**

```
 ███╗   ██╗███████╗██████╗  █████╗ ██╗   ██╗██████╗  █████╗
 ████╗  ██║██╔════╝██╔══██╗██╔══██╗██║   ██║██╔══██╗██╔══██╗
 ██╔██╗ ██║█████╗  ██████╔╝███████║██║   ██║██████╔╝███████║
 ██║╚██╗██║██╔══╝  ██╔══██╗██╔══██║██║   ██║██╔══██╗██╔══██║
 ██║ ╚████║███████╗██████╔╝██║  ██║╚██████╔╝██║  ██║██║  ██║
 ╚═╝  ╚═══╝╚══════╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
                         L A B S
```

Connect to your personal AI powered by [clawd.bot](https://clawd.bot) through a physical device with an animated face, voice interaction, and tactile controls.

**Live Demo:** Mote connects to your clawd.bot instance with real-time voice chat using **Deepgram** for speech-to-text and **ElevenLabs** for text-to-speech.

---

## 🎯 What is Mote?

The **Mote** is a voice assistant companion device that brings your personal AI into the physical world. It features:

- 🎨 **Animated Face Display** - 2" IPS LCD with expressive character that reacts to conversation
- 🎤 **Real-time Voice Chat** - Stream audio to the cloud for instant transcription via Deepgram
- 🔊 **Natural TTS Responses** - High-quality voice synthesis via ElevenLabs with buffered playback
- 🧠 **AI-Powered Conversations** - Connect to your clawd.bot instance
- 📱 **Mobile App Configuration** - Easy BLE setup via React Native app
- 🔋 **Battery Powered** - Portable with LiPo battery and USB-C charging
- 🌐 **WiFi + WebSocket** - Direct connection to your gateway server

### Voice Chat Features

| Feature | Technology | Description |
|---------|------------|-------------|
| Speech-to-Text | Deepgram Nova-2 | Real-time audio streaming with low latency transcription |
| Text-to-Speech | ElevenLabs | Natural voice synthesis (pcm_16000 format) |
| Audio Buffering | PSRAM Ring Buffer | 60-second buffer for smooth playback of long responses |
| Voice Detection | RMS Energy VAD | Automatic silence detection to trigger processing |

### Form Factors

- **Desk Companion** - Desktop device (this firmware)
- **Watch Companion** - Wearable version (coming soon)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VOICE CHAT FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌─────────────────────────┐
│   Mote Device    │      │   Gateway Server │      │   clawd.bot + Services  │
│   (ESP32-S3)     │      │   (apps/web)     │      │                         │
├──────────────────┤      ├──────────────────┤      ├─────────────────────────┤
│ • INMP441 Mic    │─────►│ • WebSocket      │─────►│ • Deepgram (STT)        │
│ • MAX98357A Amp  │◄─────│ • Voice Handler  │◄─────│ • ElevenLabs (TTS)      │
│ • ST7789 Display │      │ • Session Mgmt   │◄────►│ • clawd.bot (AI)        │
│ • Face Animation │      │                  │      │                         │
└──────────────────┘      └──────────────────┘      └─────────────────────────┘
        │                         │
        │  BLE Config             │  API Keys
        ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│   Mobile App     │      │   Environment    │
│   (apps/native)  │      │   Variables      │
├──────────────────┤      ├──────────────────┤
│ • WiFi Setup     │      │ • DEEPGRAM_KEY   │
│ • Gateway Config │      │ • ELEVENLABS_KEY │
│ • Device Pairing │      │ • GATEWAY_URL    │
└──────────────────┘      └──────────────────┘
```

**Voice Chat Flow:**
1. Mote streams audio continuously over WebSocket to Gateway Server
2. Gateway pipes audio to Deepgram for real-time transcription
3. On wake word detection, server captures user's command
4. Voice Activity Detection (VAD) on ESP32 detects end of speech
5. Transcribed text sent to your clawd.bot instance for AI response
6. Response synthesized via ElevenLabs TTS (pcm_16000 format)
7. PCM audio streamed back to Mote over WebSocket
8. Mote plays audio from 60-second PSRAM ring buffer
9. Face animation updates based on conversation state (idle → listening → thinking → speaking)

---

## 🚀 Quick Start

### Hardware Requirements

| Component | Description | Link |
|-----------|-------------|------|
| **ESP32-S3 N16R8** | DevKit with 16MB Flash, 8MB PSRAM | [Amazon](https://amzn.to/49IV37N) |
| **2" IPS LCD** | ST7789 240×320 display | [Amazon](https://amzn.to/4sM214o) |
| **INMP441** | I2S MEMS microphone | [Amazon](https://amzn.to/3NPToFV) |
| **MAX98357A** | I2S 3W amplifier | [Amazon](https://amzn.to/4a4XkKL) |
| **3W Speakers** | 4Ω mini speakers | [Amazon](https://amzn.to/4b15Yfj) |
| **LiPo Battery** | 3.7V rechargeable | [Amazon](https://amzn.to/49xnmWo) |
| **TP4056 Charger** | USB-C LiPo charging module | [Amazon](https://amzn.to/4qrIwfS) |
| **Resistor Kit** | For voltage divider (100kΩ) | [Amazon](https://amzn.to/3YG6ubf) |
| **Breadboards** | For prototyping | [Amazon](https://amzn.to/3YKnZaq) |
| **PCB Boards** | For permanent assembly | [Amazon](https://amzn.to/49G8ncN) |
| **Dupont Wires** | Jumper wires for connections | [Amazon](https://amzn.to/4qZzqXQ) |

**Estimated cost:** ~$50-75 for all components

**Full wiring guide:** See [docs/DIAGRAM.md](./docs/DIAGRAM.md) for complete wiring specification

### Software Setup

1. **Install PlatformIO**
   ```bash
   # Via VS Code: Install PlatformIO IDE extension
   # Or via CLI:
   pip install platformio
   ```

2. **Clone this Repository**
   ```bash
   git clone https://github.com/nebaura-labs/mote-firmware.git
   cd mote-firmware
   ```

3. **Build and Upload**
   ```bash
   # Build the firmware
   pio run

   # Upload to your ESP32-S3
   pio run -t upload

   # Monitor serial output
   pio device monitor

   # Or do it all at once
   pio run -t upload && pio device monitor
   ```

4. **Configure WiFi/Bluetooth**
   - On first boot, Mote creates a WiFi AP for setup
   - Connect via the Expo mobile app
   - Link to your clawd.bot instance

---

## 📁 Project Structure

This is a **monorepo** containing all Mote components:

```
mote/
├── firmware/                 # ESP32-S3 Firmware (PlatformIO, C++)
│   ├── src/
│   │   ├── main.cpp          # Main firmware entry point
│   │   ├── audio.cpp         # I2S audio, ring buffer, playback task
│   │   ├── voice_client.cpp  # WebSocket client for voice chat
│   │   ├── mote_face.cpp     # Animated face display
│   │   └── ble_config.cpp    # BLE configuration service
│   ├── include/              # Header files
│   ├── docs/                 # Hardware documentation
│   ├── platformio.ini        # PlatformIO configuration
│   └── CLAUDE.md             # Firmware developer docs
│
├── apps/
│   ├── web/                  # Gateway Server (TanStack Start + WebSocket)
│   │   ├── src/
│   │   │   ├── websocket/    # Voice WebSocket handler
│   │   │   │   └── voice-handler.ts  # Deepgram + ElevenLabs integration
│   │   │   └── routes/       # API routes
│   │   └── package.json
│   │
│   └── native/               # React Native Mobile App (Expo)
│       ├── app/              # Expo Router screens
│       ├── lib/              # BLE client, Mote protocol
│       └── package.json
│
├── packages/
│   ├── api/                  # Shared API services
│   │   └── src/services/
│   │       └── elevenlabs.ts # ElevenLabs TTS with PCM gain
│   └── shared/               # Shared types and constants
│
├── package.json              # Root workspace config (pnpm)
├── turbo.json                # Turborepo pipeline
└── README.md                 # This file
```

---

## 🔑 API Keys Required

To run the full voice chat system, you need API keys from:

| Service | Purpose | Get Key |
|---------|---------|---------|
| **clawd.bot** | AI backend for conversations | [clawd.bot](https://clawd.bot) |
| **Deepgram** | Real-time speech-to-text | [deepgram.com](https://deepgram.com) |
| **ElevenLabs** | Text-to-speech synthesis | [elevenlabs.io](https://elevenlabs.io) |

Create a `.env` file in `apps/web/`:

```bash
# apps/web/.env

# clawd.bot - Required
CLAWD_API_KEY=your_clawd_key
CLAWD_ENDPOINT=https://your-instance.clawd.bot

# Voice services
DEEPGRAM_API_KEY=your_deepgram_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id  # e.g., "21m00Tcm4TlvDq8ikWAM"
```

---

## 🔧 Development

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment
cp apps/web/.env.example apps/web/.env
# Edit .env with your API keys
```

### Monorepo Commands

```bash
# Run all dev servers (web + native)
pnpm dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Format code
pnpm format
```

### Gateway Server Development (apps/web)

```bash
# Start gateway server with WebSocket
pnpm web:dev
# Server runs on http://localhost:3000
# WebSocket voice endpoint: ws://localhost:3000/voice

# Build for production
pnpm web:build
```

### Firmware Development (ESP32-S3)

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

# All at once
cd firmware && pio run -t upload && pio device monitor
```

### Mobile App Development (apps/native)

```bash
# Start Expo dev server
cd apps/native
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android
```

### Pin Configuration

All GPIO pins are defined in the firmware headers:

| Component | Pins | Notes |
|-----------|------|-------|
| **Display (SPI)** | MOSI:11, CLK:13, CS:10, DC:9, RST:14, BL:8 | ST7789 240x320 |
| **Microphone (I2S)** | WS:39, SCK:40, SD:41 | INMP441 3.3V only |
| **Amplifier (I2S)** | BCLK:16, LRC:17, DIN:18 | MAX98357A 5V |
| **Battery ADC** | GPIO 2 | 100kΩ voltage divider |
| **RGB LED** | GPIO 38 | NeoPixel status indicator |

See [firmware/CLAUDE.md](./firmware/CLAUDE.md) and [docs/DIAGRAM.md](./docs/DIAGRAM.md) for detailed wiring.

### Audio System Configuration

The firmware uses a PSRAM ring buffer for TTS playback:

```cpp
// Audio buffer configuration (firmware/src/audio.cpp)
#define AUDIO_SAMPLE_RATE       16000   // 16kHz for voice
#define AUDIO_RING_BUFFER_SIZE  (16000 * 60)  // 60 seconds (~1MB in PSRAM)
#define VAD_THRESHOLD           300     // RMS energy threshold
#define VAD_HOLDOFF_MS          800     // Silence detection delay
```

The gateway server applies gain to ElevenLabs TTS output:

```typescript
// TTS gain configuration (apps/web/src/websocket/voice-handler.ts)
const ttsResult = await synthesizeSpeech({
  outputFormat: "pcm_16000",  // 16kHz PCM for ESP32
  useSpeakerBoost: true,      // ElevenLabs speaker boost
  gain: 1.5,                  // 1.5x volume boost (prevents clipping)
});
```

---

## 🔗 Related Projects

- **[clawd.bot](https://clawd.bot)** - Personal AI gateway backend
- **[Nebaura Labs](https://nebaura.studio)** - Official website and hardware kits

---

## 🛠️ Contributing

We welcome contributions! However, please note the license restrictions below.

**Ways to contribute:**
- 🐛 Report bugs and issues
- 💡 Suggest features and improvements
- 📝 Improve documentation
- 🔧 Submit pull requests for bug fixes
- 🎨 Design new face animations

**Before contributing:**
1. Understand the hardware architecture (see CLAUDE.md)
2. Check existing issues and PRs
3. Test your changes on real hardware
4. Follow the existing code style

---

## 📜 License

**Important:** This project uses a **source-available, non-commercial license**.

### For Personal Use (Free)

You are free to:
- ✅ Build your own Mote device for personal use
- ✅ Modify the code for your own projects
- ✅ Share the code with others (under same terms)
- ✅ Use it for educational purposes

### Restrictions

You may NOT:
- ❌ Sell hardware devices with this firmware
- ❌ Use this commercially without permission
- ❌ Remove license or attribution

**License:** Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

See [LICENSE](./LICENSE) for full terms.

### Commercial Use

Interested in selling Mote-based hardware or using this commercially?

**Official Hardware:** Purchase pre-built Mote devices from [Nebaura Labs](https://nebaura.studio)

**Commercial Licensing:** Contact us at [your-email@nebaura.studio] for commercial licensing options.

---

## 🏪 Get Hardware

### DIY Builders

Build your own! All necessary components are listed in the Hardware Requirements section above.

**Estimated cost:** ~$165-175 for all components

**Need help?** Join our community or contact us for build support.

### Pre-Assembled Kits

Not an engineer? Purchase ready-to-use Mote devices from [Nebaura Labs](https://nebaura.studio):
- Fully assembled and tested
- Same open firmware (you own the code)
- Supports further development

---

## 🐛 Troubleshooting

### Upload Issues
- Hold BOOT button while resetting to enter download mode
- Check USB cable supports data (not just charging)
- Verify correct COM port selected
- Close serial monitor before uploading

### Display Not Working
- Check backlight pin (GPIO 8) is HIGH
- Verify SPI wiring matches pin configuration
- Test with simple TFT_eSPI example first

### No Audio Output
- Ensure amplifier has 5V power
- Verify I2S pins match configuration
- Check speaker polarity
- Check serial logs for `[Audio] Buffer underrun` messages

### Audio Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| Loud noise on startup | Uninitialized buffer | Fixed in latest firmware (memset + bufferReady flag) |
| Choppy/stuttering | Buffer underruns | Increase `AUDIO_RING_BUFFER_SIZE` or check WiFi |
| Audio cuts off early | Buffer overflow | Buffer size is 60 seconds, increase if needed |
| Static/distortion | Gain too high | Reduce `gain` in voice-handler.ts (default 1.5x) |
| Quiet audio | Gain too low | Increase `gain` or enable `useSpeakerBoost` |

### Voice Chat Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| No transcription | Deepgram API key invalid | Check `DEEPGRAM_API_KEY` in .env |
| No TTS response | ElevenLabs key/voice invalid | Check `ELEVENLABS_API_KEY` and voice ID |
| WebSocket disconnects | Network issues | Check WiFi signal, gateway server logs |
| VAD not triggering | Threshold too high | Reduce `VAD_THRESHOLD` in audio.cpp |
| VAD always active | Threshold too low | Increase `VAD_THRESHOLD` (default 300) |

### BLE Configuration
- Mote advertises as "Mote" when no WiFi config is saved
- Use the mobile app to configure WiFi and gateway settings
- Device restarts automatically after saving configuration

**More help:** Check the [Issues](https://github.com/nebaura-labs/mote-firmware/issues) or contact support

---

## 🙏 Acknowledgments

Built with:
- **ESP-IDF** and **Arduino Framework** by Espressif
- **PlatformIO** for firmware build system
- **TFT_eSPI** / **LovyanGFX** for display rendering
- **Deepgram** for real-time speech-to-text
- **ElevenLabs** for natural text-to-speech
- **TanStack Start** for the gateway server
- **Expo** and **React Native** for the mobile app

Inspired by the open hardware community and the vision of personal AI companions that respect privacy and user control.

---

## 📧 Contact

- **Website:** [nebaura.studio](https://nebaura.studio)
- **GitHub:** [github.com/nebaura-labs](https://github.com/nebaura-labs)
- **Issues:** [Report bugs here](https://github.com/nebaura-labs/mote-firmware/issues)

---

```
     ╔═══════════════════════════════════════╗
     ║                                       ║
     ║   Built with ♥ by Nebaura Labs        ║
     ║   Pittsburgh, PA                      ║
     ║                                       ║
     ╚═══════════════════════════════════════╝
```

**Made with love for the open hardware and personal AI community.**
