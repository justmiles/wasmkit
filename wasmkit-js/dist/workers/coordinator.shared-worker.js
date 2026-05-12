// SharedWorker that coordinates multi-tab access to a single OPFS-backed SQLite
// database. Elects one tab as the "leader" (which runs the dedicated WASM Worker)
// and routes queries from follower tabs through the leader.
//
// Tab close detection uses the Web Locks API: each tab holds a lock for its
// lifetime, and this worker watches for the lock to be released.

const tabs = new Map();
const confirmedTabs = new Set();
let leaderTabId = null;
let dbReady = false;
let nextTabId = 0;

self.onconnect = (e) => {
  const port = e.ports[0];
  const tabId = String(++nextTabId);
  tabs.set(tabId, port);

  port.onmessage = (event) => handleMessage(tabId, event.data);
  port.postMessage({ type: "assigned", tabId });

  if (dbReady) {
    port.postMessage({ type: "ready" });
  }
};

function handleMessage(tabId, msg) {
  switch (msg.type) {
    case "lock_held":
      confirmedTabs.add(tabId);
      watchTabLock(tabId, msg.lockName);
      maybeElectLeader();
      break;

    case "worker_ready":
      dbReady = true;
      broadcast({ type: "ready" });
      break;

    case "worker_init_error":
      broadcast({ type: "init_error", error: msg.error });
      break;

    case "query":
      routeQuery(tabId, msg);
      break;

    case "query_response":
      routeResponse(msg);
      break;
  }
}

function routeQuery(fromTabId, msg) {
  if (!leaderTabId || !dbReady) {
    tabs.get(fromTabId)?.postMessage({
      type: "query_response",
      id: msg.id,
      error: "Database not ready",
    });
    return;
  }

  tabs.get(leaderTabId)?.postMessage({
    type: "proxy_query",
    id: msg.id,
    fromTabId,
    action: msg.action,
    payload: msg.payload,
  });
}

function routeResponse(msg) {
  tabs.get(msg.toTabId)?.postMessage({
    type: "query_response",
    id: msg.id,
    data: msg.data,
    error: msg.error,
  });
}

function watchTabLock(tabId, lockName) {
  navigator.locks.request(lockName, () => {
    tabs.delete(tabId);
    confirmedTabs.delete(tabId);
    if (tabId === leaderTabId) {
      leaderTabId = null;
      dbReady = false;
      broadcast({ type: "not_ready" });
      maybeElectLeader();
    }
  });
}

function maybeElectLeader() {
  if (leaderTabId || confirmedTabs.size === 0) return;
  const [firstTabId] = confirmedTabs;
  leaderTabId = firstTabId;
  tabs.get(firstTabId)?.postMessage({ type: "elect_leader" });
}

function broadcast(msg) {
  for (const port of tabs.values()) {
    port.postMessage(msg);
  }
}
