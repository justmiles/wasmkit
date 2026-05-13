import type { Plugin } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vite plugin that fully integrates wasmkit into a Vite project:
 *
 * 1. Sets the Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy
 *    headers required for SharedArrayBuffer and OPFS sync access handles.
 * 2. Excludes @justmiles/wasmkit from the dep optimizer so that
 *    import.meta.url resolves correctly for worker scripts.
 * 3. Emits worker files into the production build output so they are
 *    available at runtime without manual copy steps.
 */
export function wasmBridge(): Plugin {
  const workerDir = path.join(__dirname, "workers");

  const headers: Record<string, string> = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  };

  return {
    name: "wasmkit-bridge",

    // Exclude from dep optimizer so import.meta.url stays correct
    config() {
      return {
        optimizeDeps: {
          exclude: ["@justmiles/wasmkit"],
        },
      };
    },

    // Dev: set COOP/COEP headers
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value);
        }
        next();
      });
    },

    // Preview: set COOP/COEP headers
    configurePreviewServer(server) {
      server.middlewares.use((_req, res, next) => {
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value);
        }
        next();
      });
    },

    // Production: emit worker files into the build output
    generateBundle() {
      for (const file of fs.readdirSync(workerDir)) {
        this.emitFile({
          type: "asset",
          fileName: `workers/${file}`,
          source: fs.readFileSync(path.join(workerDir, file)),
        });
      }
    },
  };
}
