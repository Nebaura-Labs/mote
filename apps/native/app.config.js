module.exports = {
  expo: {
    name: "Mote",
    slug: "mote",
    version: "1.0.0",
    scheme: "mote",
    userInterfaceStyle: "automatic",
    orientation: "default",
    ios: {
      bundleIdentifier: "studio.nebaura.mote",
      supportsTablet: false,
      infoPlist: {
        NSMicrophoneUsageDescription: "Mote needs access to your microphone for voice conversations with your AI assistant.",
        NSBluetoothAlwaysUsageDescription: "Mote needs Bluetooth to connect to and configure your Mote device.",
        NSBluetoothPeripheralUsageDescription: "Mote needs Bluetooth to connect to and configure your Mote device.",
      },
    },
    android: {
      package: "studio.nebaura.mote",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      permissions: [
        "RECORD_AUDIO",
        "BLUETOOTH_SCAN",
        "BLUETOOTH_CONNECT",
        "ACCESS_FINE_LOCATION",
      ],
    },
    web: {
      bundler: "metro",
    },
    plugins: [
      "expo-font",
      "./plugins/withShellExecutor",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
