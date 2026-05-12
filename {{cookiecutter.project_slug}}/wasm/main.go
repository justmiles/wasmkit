package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"time"

	"github.com/justmiles/wasmkit/wasmkit/bridge"

	"{{ cookiecutter.go_module }}/wasm/apitypes"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

var db *sql.DB

func main() {
	bridge.Register("initDB", func(_ json.RawMessage) (any, error) {
		var err error
		db, err = bridge.InitDB(
			"file:{{ cookiecutter.db_name }}.db?vfs=opfs",
			migrationsFS, "migrations",
		)
		return nil, err
	})

	bridge.Register("addEntry", handleAddEntry)
	bridge.Register("getEntries", handleGetEntries)
	bridge.Register("deleteEntry", handleDeleteEntry)

	bridge.Run()
}

func handleAddEntry(payload json.RawMessage) (any, error) {
	var entry apitypes.Entry
	if err := json.Unmarshal(payload, &entry); err != nil {
		return nil, err
	}
	entry.CreatedAt = time.Now().UnixMilli()

	result, err := db.Exec(
		`INSERT INTO entries (name, started_at, ended_at, created_at) VALUES (?, ?, ?, ?)`,
		entry.Name, entry.StartedAt, entry.EndedAt, entry.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	entry.ID, _ = result.LastInsertId()
	return entry, nil
}

func handleGetEntries(_ json.RawMessage) (any, error) {
	rows, err := db.Query(
		`SELECT id, name, started_at, ended_at, created_at FROM entries ORDER BY started_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var entries []apitypes.Entry
	for rows.Next() {
		var e apitypes.Entry
		if err := rows.Scan(&e.ID, &e.Name, &e.StartedAt, &e.EndedAt, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}

	return entries, nil
}

func handleDeleteEntry(payload json.RawMessage) (any, error) {
	id := 0
	if err := json.Unmarshal(payload, &id); err != nil {
		return nil, err
	}
	if _, err := db.Exec(`DELETE FROM entries WHERE id = ?`, id); err != nil {
		return nil, err
	}
	return "ok", nil
}
