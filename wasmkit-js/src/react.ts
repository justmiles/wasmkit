import { useCallback, useEffect, useRef, useState } from "react";

export interface WasmConfig {
  dbName: string;
  wasmWorkerUrl?: URL;
  coordinatorUrl?: URL;
}

type PendingCall = {
  resolve: (value: string | null) => void;
  reject: (reason: Error) => void;
};

const callPrefix = Math.random().toString(36).slice(2, 8);
let callId = 0;

/**
 * React hook that manages the WASM worker lifecycle, multi-tab coordination
 * via SharedWorker, and provides a typed `call` function for invoking
 * Go/WASM handlers.
 */
export function useWasm(config: WasmConfig) {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const sharedRef = useRef<SharedWorker | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const isLeaderRef = useRef(false);
  const pendingRef = useRef<Map<string, PendingCall>>(new Map());
  const proxiedRef = useRef<Map<string, string>>(new Map());
  const lockReleaseRef = useRef<(() => void) | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const coordinatorUrl =
      configRef.current.coordinatorUrl ??
      new URL("./workers/coordinator.shared-worker.js", import.meta.url);

    const shared = new SharedWorker(coordinatorUrl, {
      type: "classic",
      name: "db-coordinator",
    });
    sharedRef.current = shared;

    shared.onerror = (e) => {
      console.error("SharedWorker error:", e);
    };

    shared.port.onmessage = (e: MessageEvent) => {
      const msg = e.data;

      switch (msg.type) {
        case "assigned": {
          const lockName = `tab-${msg.tabId}`;
          navigator.locks.request(lockName, () => {
            shared.port.postMessage({ type: "lock_held", lockName });
            return new Promise<void>((resolve) => {
              lockReleaseRef.current = resolve;
            });
          });
          break;
        }

        case "elect_leader":
          isLeaderRef.current = true;
          spawnWorker();
          break;

        case "ready":
          setReady(true);
          break;

        case "not_ready":
          setReady(false);
          for (const [, pending] of pendingRef.current) {
            pending.reject(new Error("Database leader changed"));
          }
          pendingRef.current.clear();
          break;

        case "init_error":
          console.error("WASM init failed:", msg.error);
          setInitError(msg.error);
          break;

        case "proxy_query":
          proxiedRef.current.set(msg.id, msg.fromTabId);
          workerRef.current?.postMessage({
            id: msg.id,
            action: msg.action,
            payload: msg.payload,
          });
          break;

        case "query_response": {
          const pending = pendingRef.current.get(msg.id);
          if (pending) {
            pendingRef.current.delete(msg.id);
            if (msg.error) {
              pending.reject(new Error(msg.error));
            } else {
              pending.resolve(msg.data ?? null);
            }
          }
          break;
        }
      }
    };

    shared.port.start();

    function spawnWorker() {
      const wasmWorkerUrl =
        configRef.current.wasmWorkerUrl ??
        new URL("./workers/wasm-worker.js", import.meta.url);

      const worker = new Worker(wasmWorkerUrl, { type: "classic" });

      worker.onerror = (e) => {
        console.error("WASM Worker error:", e);
      };

      worker.onmessage = (e: MessageEvent) => {
        const { id, action, data, error } = e.data;

        if (action === "ready") {
          sharedRef.current?.port.postMessage({ type: "worker_ready" });
          return;
        }

        if (action === "init_error") {
          sharedRef.current?.port.postMessage({
            type: "worker_init_error",
            error,
          });
          return;
        }

        if (!id) return;

        const fromTabId = proxiedRef.current.get(id);
        if (fromTabId) {
          proxiedRef.current.delete(id);
          sharedRef.current?.port.postMessage({
            type: "query_response",
            id,
            toTabId: fromTabId,
            data,
            error: action === "error" ? (error ?? "unknown error") : undefined,
          });
        } else {
          const pending = pendingRef.current.get(id);
          if (pending) {
            pendingRef.current.delete(id);
            if (action === "error") {
              pending.reject(new Error(error ?? "unknown error"));
            } else {
              pending.resolve(data ?? null);
            }
          }
        }
      };

      workerRef.current = worker;

      worker.postMessage({
        action: "__init",
        config: { dbName: configRef.current.dbName },
      });
    }

    return () => {
      lockReleaseRef.current?.();
      workerRef.current?.terminate();
      shared.port.close();
    };
  }, []);

  const call = useCallback(
    <T = unknown>(action: string, payload: unknown): Promise<T> => {
      return new Promise((resolve, reject) => {
        const id = `${callPrefix}-${++callId}`;
        pendingRef.current.set(id, {
          resolve: (raw) => {
            if (raw == null) {
              resolve(null as T);
            } else {
              try {
                resolve(JSON.parse(raw) as T);
              } catch {
                resolve(raw as T);
              }
            }
          },
          reject,
        });

        if (isLeaderRef.current && workerRef.current) {
          workerRef.current.postMessage({ id, action, payload });
        } else if (sharedRef.current) {
          sharedRef.current.port.postMessage({
            type: "query",
            id,
            action,
            payload,
          });
        } else {
          pendingRef.current.delete(id);
          reject(new Error("No worker available"));
        }
      });
    },
    []
  );

  return { ready, initError, call };
}
