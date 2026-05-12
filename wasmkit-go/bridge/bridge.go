// Package bridge provides helpers for registering Go functions as JS-callable
// handlers in a WASM environment. It standardises the JSON-in / JSON-out
// contract and the "error: ..." envelope convention used by the wasmkit worker.
package bridge

import (
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"log"
	"syscall/js"

	_ "github.com/danmestas/go-sqlite3-opfs"
	_ "github.com/ncruces/go-sqlite3/driver"

	wasmigrate "github.com/justmiles/wasmkit/wasmkit-go/migrate"
)

// HandlerFunc is the signature for domain handlers. The payload is the raw
// JSON sent from the JS caller. Return any JSON-serialisable value on success,
// or an error. The bridge takes care of marshalling and the error envelope.
type HandlerFunc func(payload json.RawMessage) (any, error)

// Register exposes fn on the JS global scope under the given name. The wrapper
// handles JSON deserialisation of the first argument, calls fn, marshals the
// result, and returns either the JSON string or an "error: ..." string that
// the worker-side dispatcher interprets as a failure.
func Register(name string, fn HandlerFunc) {
	js.Global().Set(name, js.FuncOf(func(_ js.Value, args []js.Value) any {
		var raw json.RawMessage
		if len(args) > 0 {
			raw = json.RawMessage(args[0].String())
		}
		result, err := fn(raw)
		if err != nil {
			return fmt.Sprintf("error: %v", err)
		}
		if result == nil {
			return nil
		}
		out, err := json.Marshal(result)
		if err != nil {
			return fmt.Sprintf("error: %v", err)
		}
		return string(out)
	}))
}

// RegisterRaw exposes a raw js.Func on the global scope for cases where the
// standard HandlerFunc envelope is not suitable (e.g. functions that need
// direct access to js.Value arguments).
func RegisterRaw(name string, fn js.Func) {
	js.Global().Set(name, fn)
}

// InitDB opens an OPFS-backed SQLite database at the given DSN and runs all
// pending migrations from migrationsFS. The dir argument is the subdirectory
// inside the embed.FS containing the SQL files (typically "migrations").
//
// The returned *sql.DB is configured with MaxOpenConns(1), which is required
// for SQLite's single-writer model.
func InitDB(dsn string, migrationsFS embed.FS, dir string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	db.SetMaxOpenConns(1)

	if err := wasmigrate.Run(db, migrationsFS, dir); err != nil {
		return nil, fmt.Errorf("migrations: %w", err)
	}
	return db, nil
}

// Run blocks the WASM process forever. Call this at the end of main() after
// all handlers have been registered so the Go runtime stays alive for the
// lifetime of the Web Worker.
func Run() {
	log.Println("Go/WASM runtime ready")
	select {}
}
