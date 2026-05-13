import { Plugin } from 'vite';

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
declare function wasmBridge(): Plugin;

export { wasmBridge };
