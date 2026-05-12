// Dedicated Web Worker that boots the Go/WASM runtime with OPFS-backed SQLite.
// Only the leader tab (elected by the SharedWorker coordinator) spawns this worker.
//
// The worker receives its configuration (dbName) via an __init message from the
// host hook before booting the WASM binary.

const MAX_RETRIES = 5;
let booted = false;

async function openHandles(dbName) {
  const root = await navigator.storage.getDirectory();
  const handles = {};
  for (const suffix of ["", "-journal", "-wal"]) {
    const name = dbName + suffix;
    const fh = await root.getFileHandle(name, { create: true });
    handles[name] = await fh.createSyncAccessHandle();
  }
  return handles;
}

async function openHandlesWithRetry(dbName) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await openHandles(dbName);
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) throw err;
      await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
    }
  }
}

async function boot({ dbName }) {
  try {
    const handles = await openHandlesWithRetry(dbName);

    const resp = await fetch("/wasm_exec.js");
    const text = await resp.text();
    eval(text);

    const go = new Go();
    const result = await WebAssembly.instantiateStreaming(
      fetch("/main.wasm"),
      go.importObject
    );
    go.run(result.instance);

    // Hand file handles to the OPFS VFS shim (provided by go-sqlite3-opfs)
    _opfs_init(handles);

    const initResult = initDB();
    if (initResult && initResult.startsWith("error:")) {
      postMessage({ action: "init_error", error: initResult });
      return;
    }

    postMessage({ action: "ready" });
  } catch (err) {
    postMessage({ action: "init_error", error: err.message });
  }
}

self.onmessage = async (e) => {
  if (e.data.action === "__init") {
    if (!booted) {
      booted = true;
      await boot(e.data.config);
    }
    return;
  }

  const { id, action, payload } = e.data;

  try {
    const fn = self[action];
    if (typeof fn !== "function") {
      postMessage({ id, action: "error", error: `unknown action: ${action}` });
      return;
    }

    const result = fn(JSON.stringify(payload));

    if (typeof result === "string" && result.startsWith("error:")) {
      postMessage({ id, action: "error", error: result });
    } else {
      postMessage({ id, action: "result", data: result });
    }
  } catch (err) {
    postMessage({ id, action: "error", error: err.message });
  }
};
