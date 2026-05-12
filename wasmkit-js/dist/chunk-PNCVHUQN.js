// src/vite-plugin.ts
function wasmBridge() {
  const headers = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp"
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
    }
  };
}

export {
  wasmBridge
};
//# sourceMappingURL=chunk-PNCVHUQN.js.map