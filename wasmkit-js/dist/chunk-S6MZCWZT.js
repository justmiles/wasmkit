// src/react.ts
import { useCallback, useEffect, useRef, useState } from "react";
var callPrefix = Math.random().toString(36).slice(2, 8);
var callId = 0;
function useWasm(config) {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState(null);
  const sharedRef = useRef(null);
  const workerRef = useRef(null);
  const isLeaderRef = useRef(false);
  const pendingRef = useRef(/* @__PURE__ */ new Map());
  const proxiedRef = useRef(/* @__PURE__ */ new Map());
  const lockReleaseRef = useRef(null);
  const configRef = useRef(config);
  configRef.current = config;
  useEffect(() => {
    const coordinatorUrl = configRef.current.coordinatorUrl ?? new URL("wasmkit/workers/coordinator.shared-worker.js", import.meta.url);
    const shared = new SharedWorker(coordinatorUrl, {
      type: "classic",
      name: "db-coordinator"
    });
    sharedRef.current = shared;
    shared.onerror = (e) => {
      console.error("SharedWorker error:", e);
    };
    shared.port.onmessage = (e) => {
      const msg = e.data;
      switch (msg.type) {
        case "assigned": {
          const lockName = `tab-${msg.tabId}`;
          navigator.locks.request(lockName, () => {
            shared.port.postMessage({ type: "lock_held", lockName });
            return new Promise((resolve) => {
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
            payload: msg.payload
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
      const wasmWorkerUrl = configRef.current.wasmWorkerUrl ?? new URL("wasmkit/workers/wasm-worker.js", import.meta.url);
      const worker = new Worker(wasmWorkerUrl, { type: "classic" });
      worker.onerror = (e) => {
        console.error("WASM Worker error:", e);
      };
      worker.onmessage = (e) => {
        const { id, action, data, error } = e.data;
        if (action === "ready") {
          sharedRef.current?.port.postMessage({ type: "worker_ready" });
          return;
        }
        if (action === "init_error") {
          sharedRef.current?.port.postMessage({
            type: "worker_init_error",
            error
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
            error: action === "error" ? error ?? "unknown error" : void 0
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
        config: { dbName: configRef.current.dbName }
      });
    }
    return () => {
      lockReleaseRef.current?.();
      workerRef.current?.terminate();
      shared.port.close();
    };
  }, []);
  const call = useCallback(
    (action, payload) => {
      return new Promise((resolve, reject) => {
        const id = `${callPrefix}-${++callId}`;
        pendingRef.current.set(id, {
          resolve: (raw) => {
            if (raw == null) {
              resolve(null);
            } else {
              try {
                resolve(JSON.parse(raw));
              } catch {
                resolve(raw);
              }
            }
          },
          reject
        });
        if (isLeaderRef.current && workerRef.current) {
          workerRef.current.postMessage({ id, action, payload });
        } else if (sharedRef.current) {
          sharedRef.current.port.postMessage({
            type: "query",
            id,
            action,
            payload
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

export {
  useWasm
};
//# sourceMappingURL=chunk-S6MZCWZT.js.map