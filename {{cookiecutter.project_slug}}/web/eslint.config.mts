import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  {
    ignores: ["dist/", "node_modules/", "src/lib/types.gen.ts", "src/components/ui/", "public/wasm_exec.js"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser } },
  },
  tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "max-lines": [
        "error",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ["**/workers/*.js"],
    languageOptions: {
      globals: {
        Go: "readonly",
        _opfs_init: "readonly",
        initDB: "readonly",
      },
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
]);
