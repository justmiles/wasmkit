import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { wasmBridge } from "@justmiles/wasmkit/vite-plugin";
import path from "path";

export default defineConfig({
  plugins: [react(), wasmBridge()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
