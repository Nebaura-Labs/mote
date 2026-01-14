# Nebaura Labs Mote - Firmware

```
 ███╗   ██╗███████╗██████╗  █████╗ ██╗   ██╗██████╗  █████╗
 ████╗  ██║██╔════╝██╔══██╗██╔══██╗██║   ██║██╔══██╗██╔══██╗
 ██╔██╗ ██║█████╗  ██████╔╝███████║██║   ██║██████╔╝███████║
 ██║╚██╗██║██╔══╝  ██╔══██╗██╔══██║██║   ██║██╔══██╗██╔══██║
 ██║ ╚████║███████╗██████╔╝██║  ██║╚██████╔╝██║  ██║██║  ██║
 ╚═╝  ╚═══╝╚══════╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
                         L A B S
```

**Open-source ESP32-S3 firmware for the Mote voice assistant companion device.**

Connect to your personal AI powered by [clawd.bot](https://clawd.bot) through a physical device with an animated face, voice interaction, and tactile controls.

---

## 🎯 What is Mote?

The **Mote** is a voice assistant companion device that brings your personal AI into the physical world. It features:

- 🎨 **Animated Face Display** - 2" IPS LCD with expressive character
- 🎤 **Voice Interaction** - I2S MEMS microphone with wake word detection
- 🔊 **Quality Audio** - I2S amplifier and speaker for natural conversations
- 🔘 **Physical Controls** - Volume and mute buttons
- 🔋 **Battery Powered** - Portable with LiPo battery and USB-C charging
- 📱 **Expo Bridge App** - Connects to your clawd.bot instance via mobile app

### Form Factors

- **Desk Companion** - Desktop device (this firmware)
- **Watch Companion** - Wearable version (coming soon)

---

## 🏗️ Architecture

```
┌──────────────────┐      ┌──────────────┐      ┌─────────────────┐
│                  │      │   Expo App   │      │   clawd.bot     │
│   Mote Device    │◄────►│   (Bridge)   │◄────►│  Your Personal  │
│  ESP32-S3 + LCD  │ WiFi │              │ API  │   AI Gateway    │
│                  │  BT  │  iOS/Android │      │  Cloud or Local │
└──────────────────┘      └──────────────┘      └─────────────────┘
   This Firmware         Mobile App Repo         Your AI Backend
```

**How it works:**
1. Wake word triggers Mote to listen
2. Audio sent to your phone via Bluetooth/WiFi
3. Phone bridges to your clawd.bot instance
4. AI response streamed back and spoken through Mote
5. Animated face reacts to conversation state

---

## 🚀 Quick Start

### Hardware Requirements

- ESP32-S3 N16R8 DevKit (or compatible)
- Waveshare 2" IPS LCD (ST7789, 240×320)
- INMP441 I2S Microphone
- MAX98357A I2S Amplifier
- 4Ω 3W Speaker
- 3.7V LiPo Battery + TP4056 Charger
- Buttons and basic components

**Full parts list and wiring guide:** Available with official Nebaura Labs hardware kits at [nebaura.studio](https://nebaura.studio)

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

```
mote-firmware/
├── src/
│   └── main.cpp              # Main firmware entry point
├── include/                  # Header files
├── lib/                      # Project-specific libraries
├── test/                     # Unit tests
├── platformio.ini            # PlatformIO configuration
└── CLAUDE.md                 # AI assistant context
```

---

## 🔧 Development

### Common Commands

```bash
# Build
pio run

# Upload
pio run -t upload

# Clean build
pio run -t clean

# Monitor serial
pio device monitor

# Run tests
pio test
```

### Pin Configuration

All GPIO pins are defined in the source code:

- **Display (SPI):** GPIO 2, 4, 5, 17, 18, 23
- **Microphone (I2S):** GPIO 14, 15, 32
- **Amplifier (I2S):** GPIO 22, 25, 26
- **Buttons:** GPIO 12, 27, 33
- **Battery ADC:** GPIO 34

See [CLAUDE.md](./CLAUDE.md) for detailed pin mappings and architecture.

---

## 🔗 Related Projects

- **[Mote Bridge App](https://github.com/nebaura-labs/mote-app)** - Expo/React Native mobile app
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

### Display Not Working
- Check backlight pin (GPIO17) is HIGH
- Verify SPI wiring matches pin configuration
- Test with simple TFT_eSPI example first

### No Audio
- Ensure amplifier has 5V power
- Verify I2S pins match configuration
- Check speaker polarity

**More help:** Check the [Issues](https://github.com/nebaura-labs/mote-firmware/issues) or contact support

---

## 🙏 Acknowledgments

Built with:
- **ESP-IDF** and **Arduino Framework** by Espressif
- **PlatformIO** for build system
- **TFT_eSPI** for display rendering
- **Picovoice Porcupine** for wake word detection

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
