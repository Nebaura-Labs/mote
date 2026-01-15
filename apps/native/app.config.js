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
    },
    android: {
      package: "studio.nebaura.mote",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
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
