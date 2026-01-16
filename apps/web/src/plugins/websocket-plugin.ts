import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, Server as HttpServer } from "http";
import type { Duplex } from "stream";

/**
 * Vite plugin to handle WebSocket connections for SSH tunnel proxying
 * Intercepts HTTP upgrade requests to /api/ws
 */
export function websocketPlugin(): Plugin {
  let server: ViteDevServer;

  return {
    name: "mote-websocket",
    configureServer(viteServer) {
      server = viteServer;

      // Get the HTTP server from Vite
      const httpServer = viteServer.httpServer;

      if (!httpServer) {
        console.warn("[websocket-plugin] No HTTP server available");
        return;
      }

      // Intercept HTTP upgrade events for WebSocket connections
      httpServer.on("upgrade", async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);

        // Handle /api/ws upgrade requests (chat tunnel)
        if (url.pathname === "/api/ws") {
          console.log("[websocket-plugin] Handling WebSocket upgrade for", url.pathname);

          // Lazy-load the handler to avoid loading database code during Vite config
          const { handleWebSocketUpgrade } = await import("../websocket/handler.js");
          handleWebSocketUpgrade(req, socket, head);
        }
        // Handle /ws/voice upgrade requests (Mote device voice streaming)
        else if (url.pathname === "/ws/voice") {
          console.log("[websocket-plugin] Handling voice WebSocket upgrade for", url.pathname);

          // Lazy-load the voice handler
          const { handleVoiceWebSocketUpgrade } = await import("../websocket/voice-handler.js");
          handleVoiceWebSocketUpgrade(req, socket, head);
        }
        // Let other upgrades pass through (e.g., Vite HMR)
      });

      console.log("[websocket-plugin] WebSocket server initialized at /api/ws and /ws/voice");
    },
  };
}
