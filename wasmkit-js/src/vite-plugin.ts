import type { Plugin } from "vite";

/**
 * Vite plugin that sets the Cross-Origin-Opener-Policy and
 * Cross-Origin-Embedder-Policy headers required for SharedArrayBuffer
 * and OPFS sync access handles used by Go/WASM + SQLite.
 */
export function wasmBridge(): Plugin {
  const headers: Record<string, string> = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  };

  return {
    name: "wasmkit-bridge",

    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value);
        }
        next();
      });
    },

    configurePreviewServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value);
        }
        next();
      });
    },
  };
}
