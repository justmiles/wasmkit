interface WasmConfig {
    dbName: string;
    wasmWorkerUrl?: URL;
    coordinatorUrl?: URL;
}
/**
 * React hook that manages the WASM worker lifecycle, multi-tab coordination
 * via SharedWorker, and provides a typed `call` function for invoking
 * Go/WASM handlers.
 */
declare function useWasm(config: WasmConfig): {
    ready: boolean;
    initError: string | null;
    call: <T = unknown>(action: string, payload: unknown) => Promise<T>;
};

export { type WasmConfig, useWasm };
