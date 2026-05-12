import { defineConfig } from "tsup";
import { cpSync } from "fs";

export default defineConfig({
  entry: ["src/index.ts", "src/react.ts", "src/vite-plugin.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "vite"],
  onSuccess: async () => {
    cpSync("src/workers", "dist/workers", { recursive: true });
  },
});
