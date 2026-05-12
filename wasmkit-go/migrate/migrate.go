// Package migrate provides a single-call migration runner for OPFS-backed
// SQLite databases in a WASM environment. It wraps golang-migrate with the
// wasmkit sqlitedriver so callers only need an *sql.DB and an embedded
// filesystem of SQL migration files.
package migrate

import (
	"database/sql"
	"embed"

	gomigrate "github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	"github.com/justmiles/wasmkit/wasmkit-go/sqlitedriver"
)

// Run applies all pending up-migrations from migrationsFS. The dir argument
// specifies the subdirectory within the embed.FS that contains the SQL files
// (typically "migrations"). Returns nil when all migrations succeed or when
// there are no new migrations to apply.
func Run(db *sql.DB, migrationsFS embed.FS, dir string) error {
	driver, err := sqlitedriver.WithInstance(db, &sqlitedriver.Config{
		MigrationsTable: "schema_migrations",
	})
	if err != nil {
		return err
	}

	source, err := iofs.New(migrationsFS, dir)
	if err != nil {
		return err
	}

	m, err := gomigrate.NewWithInstance("iofs", source, "sqlite3", driver)
	if err != nil {
		return err
	}

	if err := m.Up(); err != nil && err != gomigrate.ErrNoChange {
		return err
	}
	return nil
}
