import { useCallback, useEffect, useState } from "react";
import { useWasm } from "@justmiles/wasmkit/react";

function App() {
  const { ready, initError, call } = useWasm({
    dbName: "{{ cookiecutter.db_name }}.db",
  });
  const [entries, setEntries] = useState<
    { id: number; name: string; created_at: number }[]
  >([]);
  const [name, setName] = useState("");

  const loadEntries = useCallback(async () => {
    const result = await call<{ id: number; name: string; created_at: number }[]>(
      "getEntries",
      {}
    );
    if (result) {
      setEntries(result);
    }
  }, [call]);

  useEffect(() => {
    if (ready) {
      loadEntries();
    }
  }, [ready, loadEntries]);

  async function handleAdd() {
    if (!name.trim()) return;
    const now = Date.now();
    await call("addEntry", {
      name: name.trim(),
      started_at: now,
      ended_at: now,
    });
    setName("");
    await loadEntries();
  }

  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-2">
        <p className="text-lg text-gray-500">
          {initError ? "Failed to initialize" : "Loading WASM runtime..."}
        </p>
        {initError && (
          <p className="text-sm text-red-500 max-w-md text-center">
            {initError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">{{ cookiecutter.project_name }}</h1>

      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Entry name..."
          className="flex-1 px-4 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={handleAdd}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between p-4 bg-muted rounded-md"
          >
            <span>{entry.name}</span>
            <span className="text-sm text-muted-foreground">
              {new Date(entry.created_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>

      {entries.length === 0 && (
        <p className="text-center text-muted-foreground mt-4">
          No entries yet. Add one above.
        </p>
      )}
    </div>
  );
}

export default App;
