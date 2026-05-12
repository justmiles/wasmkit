import { Plugin } from 'vite';

/**
 * Vite plugin that sets the Cross-Origin-Opener-Policy and
 * Cross-Origin-Embedder-Policy headers required for SharedArrayBuffer
 * and OPFS sync access handles used by Go/WASM + SQLite.
 */
declare function wasmBridge(): Plugin;

export { wasmBridge };
