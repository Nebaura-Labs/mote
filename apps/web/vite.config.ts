import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { websocketPlugin } from "./src/plugins/websocket-plugin";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    websocketPlugin(),
  ],
  server: {
    port: 3001,
  },
  optimizeDeps: {
    exclude: ['ssh2', 'cpu-features'],
  },
});
