# @justmiles/wasmkit

Browser-side runtime for Go/WASM apps with OPFS-backed SQLite. Provides a React hook, Vite plugin, and Web Worker coordination layer.

## Install

```bash
npm install @justmiles/wasmkit
```

**Peer dependencies:** `react >= 18.0.0`, `vite >= 5.0.0` (optional, only needed for the Vite plugin)

## Quick start

### 1. Add the Vite plugin

The `wasmBridge()` plugin sets the `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers required for `SharedArrayBuffer` and OPFS sync access handles.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { wasmBridge } from "@justmiles/wasmkit/vite-plugin";

export default defineConfig({
  plugins: [react(), wasmBridge()],
});
```

### 2. Use the React hook

```tsx
import { useWasm } from "@justmiles/wasmkit/react";

function App() {
  const { ready, initError, call } = useWasm({ dbName: "myapp" });

  if (initError) return <p>Error: {initError}</p>;
  if (!ready) return <p>Loading WASM…</p>;

  const handleClick = async () => {
    const result = await call<{ count: number }>("get_count", {});
    console.log(result.count);
  };

  return <button onClick={handleClick}>Get Count</button>;
}
```

## API

### `useWasm(config: WasmConfig)`

React hook that manages the full WASM worker lifecycle.

```ts
interface WasmConfig {
  dbName: string;          // SQLite database name (used for OPFS path)
  wasmWorkerUrl?: URL;     // Custom WASM worker URL (optional)
  coordinatorUrl?: URL;    // Custom SharedWorker coordinator URL (optional)
}
```

**Returns:**

| Property    | Type                                                   | Description                                        |
| ----------- | ------------------------------------------------------ | -------------------------------------------------- |
| `ready`     | `boolean`                                              | `true` once the WASM worker has finished init       |
| `initError` | `string \| null`                                       | Error message if WASM initialization failed         |
| `call`      | `<T>(action: string, payload: unknown) => Promise<T>`  | Invoke a Go handler registered via `bridge.Handle`  |

### `wasmBridge()`

Vite plugin that configures the required cross-origin isolation headers:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These headers are applied in both `dev` and `preview` modes. For production, configure equivalent headers in your hosting provider or reverse proxy.

## Architecture

The package ships two pre-built worker scripts:

```
@justmiles/wasmkit
├── dist/workers/
│   ├── coordinator.shared-worker.js   # SharedWorker — leader election & multi-tab coordination
│   └── wasm-worker.js                 # Dedicated Worker — loads Go/WASM binary, runs SQLite via OPFS
```

**Multi-tab coordination flow:**

1. Each tab connects to the `coordinator` SharedWorker
2. The coordinator elects one tab as the **leader** via Web Locks
3. The leader spawns the `wasm-worker` that owns the SQLite database
4. Non-leader tabs proxy queries through the coordinator → leader → WASM worker
5. If the leader tab closes, a new leader is elected and the worker respawns

This ensures only one tab holds the OPFS lock at a time, preventing database corruption.

## Exports

| Subpath              | Description                              |
| -------------------- | ---------------------------------------- |
| `@justmiles/wasmkit` | Barrel — re-exports `useWasm`, `wasmBridge`, `WasmConfig` |
| `@justmiles/wasmkit/react` | `useWasm` hook                      |
| `@justmiles/wasmkit/vite-plugin` | `wasmBridge` Vite plugin      |
| `@justmiles/wasmkit/workers/*` | Static worker scripts              |

## License

MIT
