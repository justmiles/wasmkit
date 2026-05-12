# wasmkit

[![Go Reference](https://pkg.go.dev/badge/github.com/justmiles/wasmkit.svg)](https://pkg.go.dev/github.com/justmiles/wasmkit)

Go framework for building local-first browser applications with WASM and OPFS-backed SQLite. Provides a JSON bridge between JavaScript and Go handlers, schema migrations, and a CGO-free `golang-migrate` database driver — all designed to run inside a Web Worker.

## Install

```bash
go get github.com/justmiles/wasmkit@latest
```

> **Note:** This module targets `GOOS=js GOARCH=wasm` and requires Go 1.26+.

## Packages

### `bridge`

Register Go functions as globally callable JavaScript handlers with automatic JSON marshalling and an error envelope convention.

```go
import (
	"embed"
	"encoding/json"

	"github.com/justmiles/wasmkit/bridge"
)

//go:embed migrations/*.sql
var migrations embed.FS

func main() {
	// Open OPFS-backed SQLite and run migrations
	db, err := bridge.InitDB("file:app.db?vfs=opfs", migrations, "migrations")
	if err != nil {
		panic(err)
	}

	// Register a handler callable from JS as getItems('{}')
	bridge.Register("getItems", func(payload json.RawMessage) (any, error) {
		rows, err := db.Query("SELECT id, name FROM items")
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		var items []Item
		for rows.Next() {
			var item Item
			if err := rows.Scan(&item.ID, &item.Name); err != nil {
				return nil, err
			}
			items = append(items, item)
		}
		return items, rows.Err()
	})

	// Keep the WASM process alive
	bridge.Run()
}
```

#### API

| Function | Description |
|----------|-------------|
| `Register(name, fn)` | Expose a `HandlerFunc` on the JS global scope. Handles JSON parsing, result marshalling, and `"error: ..."` envelopes. |
| `RegisterRaw(name, fn)` | Expose a raw `js.Func` for cases requiring direct access to `js.Value` arguments. |
| `InitDB(dsn, fs, dir)` | Open an OPFS-backed SQLite database and run all pending migrations. Returns a configured `*sql.DB` (MaxOpenConns=1). |
| `Run()` | Block forever to keep the Go/WASM runtime alive for the lifetime of the Web Worker. |

### `migrate`

Single-call migration runner wrapping [`golang-migrate`](https://github.com/golang-migrate/migrate) with the wasmkit SQLite driver. Accepts a standard `*sql.DB` and an `embed.FS` of SQL migration files.

```go
import (
	"database/sql"
	"embed"

	"github.com/justmiles/wasmkit/migrate"
)

//go:embed migrations/*.sql
var migrations embed.FS

func runMigrations(db *sql.DB) error {
	return migrate.Run(db, migrations, "migrations")
}
```

Returns `nil` when all migrations succeed or when there are no new migrations to apply.

### `sqlitedriver`

A CGO-free [`golang-migrate`](https://github.com/golang-migrate/migrate) `database.Driver` for [`ncruces/go-sqlite3`](https://github.com/ncruces/go-sqlite3). This replaces the upstream `mattn/go-sqlite3` driver (which requires CGO) so migrations can run in WASM.

Only `WithInstance` is supported — the `*sql.DB` must be opened externally with the OPFS VFS. The `Open` method is intentionally unimplemented.

```go
import (
	"database/sql"

	"github.com/justmiles/wasmkit/sqlitedriver"
)

driver, err := sqlitedriver.WithInstance(db, &sqlitedriver.Config{
	MigrationsTable: "schema_migrations",
	NoTxWrap:        false, // set true for DDL that can't run in a transaction
})
```

## How it fits together

```
Browser
┌─────────────────────────────────────────────┐
│  React UI                                   │
│  useWasm() hook  ──call("getItems",{})──►   │
│                                             │
│  ┌─────────── Web Worker ────────────────┐  │
│  │  Go/WASM binary                       │  │
│  │  bridge.Register("getItems", fn)      │  │
│  │         │                             │  │
│  │         ▼                             │  │
│  │  bridge.InitDB() ──► migrate.Run()    │  │
│  │         │                    │        │  │
│  │         ▼                    ▼        │  │
│  │       *sql.DB ◄── sqlitedriver        │  │
│  │         │                             │  │
│  │         ▼                             │  │
│  │    OPFS (SQLite)                      │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## License

[MIT](../LICENSE)
