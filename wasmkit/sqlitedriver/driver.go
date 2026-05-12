// Package sqlitedriver implements the golang-migrate database.Driver interface
// for use with ncruces/go-sqlite3 in a WASM environment. It is adapted from
// github.com/golang-migrate/migrate/v4/database/sqlite3 with the CGO-dependent
// mattn/go-sqlite3 import removed. Only WithInstance is supported; the Open
// method is intentionally not implemented because the *sql.DB is managed
// externally (opened via ncruces/go-sqlite3 with the OPFS VFS).
package sqlitedriver

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"sync/atomic"

	"github.com/golang-migrate/migrate/v4/database"
)

const DefaultMigrationsTable = "schema_migrations"

var (
	ErrNilConfig = fmt.Errorf("no config")
)

type Config struct {
	MigrationsTable string
	NoTxWrap        bool
}

type Sqlite struct {
	db       *sql.DB
	isLocked atomic.Bool
	config   *Config
}

// WithInstance creates a new migrate database driver from an existing *sql.DB.
// The caller is responsible for opening and closing the database connection.
func WithInstance(instance *sql.DB, config *Config) (database.Driver, error) {
	if config == nil {
		return nil, ErrNilConfig
	}

	if err := instance.Ping(); err != nil {
		return nil, err
	}

	if config.MigrationsTable == "" {
		config.MigrationsTable = DefaultMigrationsTable
	}

	mx := &Sqlite{
		db:     instance,
		config: config,
	}
	if err := mx.ensureVersionTable(); err != nil {
		return nil, err
	}
	return mx, nil
}

func (m *Sqlite) ensureVersionTable() (err error) {
	if err = m.Lock(); err != nil {
		return err
	}
	defer func() {
		if e := m.Unlock(); e != nil {
			err = errors.Join(err, e)
		}
	}()

	query := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s (version uint64, dirty bool);
		CREATE UNIQUE INDEX IF NOT EXISTS version_unique ON %s (version);
	`, m.config.MigrationsTable, m.config.MigrationsTable)

	_, err = m.db.Exec(query)
	return err
}

func (m *Sqlite) Open(_ string) (database.Driver, error) {
	return nil, fmt.Errorf("open is not supported; use WithInstance instead")
}

func (m *Sqlite) Close() error {
	return m.db.Close()
}

func (m *Sqlite) Lock() error {
	if !m.isLocked.CompareAndSwap(false, true) {
		return database.ErrLocked
	}
	return nil
}

func (m *Sqlite) Unlock() error {
	if !m.isLocked.CompareAndSwap(true, false) {
		return database.ErrNotLocked
	}
	return nil
}

func (m *Sqlite) Run(migration io.Reader) error {
	buf, err := io.ReadAll(migration)
	if err != nil {
		return err
	}
	query := string(buf)

	if m.config.NoTxWrap {
		return m.executeQueryNoTx(query)
	}
	return m.executeQuery(query)
}

func (m *Sqlite) executeQuery(query string) error {
	tx, err := m.db.Begin()
	if err != nil {
		return &database.Error{OrigErr: err, Err: "transaction start failed"}
	}
	if _, err := tx.Exec(query); err != nil {
		if errRollback := tx.Rollback(); errRollback != nil {
			err = errors.Join(err, errRollback)
		}
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}
	if err := tx.Commit(); err != nil {
		return &database.Error{OrigErr: err, Err: "transaction commit failed"}
	}
	return nil
}

func (m *Sqlite) executeQueryNoTx(query string) error {
	if _, err := m.db.Exec(query); err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}
	return nil
}

func (m *Sqlite) SetVersion(version int, dirty bool) error {
	tx, err := m.db.Begin()
	if err != nil {
		return &database.Error{OrigErr: err, Err: "transaction start failed"}
	}

	query := "DELETE FROM " + m.config.MigrationsTable
	if _, err := tx.Exec(query); err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}

	if version >= 0 || (version == database.NilVersion && dirty) {
		query := fmt.Sprintf(`INSERT INTO %s (version, dirty) VALUES (?, ?)`, m.config.MigrationsTable)
		if _, err := tx.Exec(query, version, dirty); err != nil {
			if errRollback := tx.Rollback(); errRollback != nil {
				err = errors.Join(err, errRollback)
			}
			return &database.Error{OrigErr: err, Query: []byte(query)}
		}
	}

	if err := tx.Commit(); err != nil {
		return &database.Error{OrigErr: err, Err: "transaction commit failed"}
	}
	return nil
}

func (m *Sqlite) Version() (version int, dirty bool, err error) {
	query := "SELECT version, dirty FROM " + m.config.MigrationsTable + " LIMIT 1"
	err = m.db.QueryRow(query).Scan(&version, &dirty)
	if err != nil {
		return database.NilVersion, false, nil
	}
	return version, dirty, nil
}

func (m *Sqlite) Drop() (err error) {
	query := `SELECT name FROM sqlite_master WHERE type = 'table';`
	tables, err := m.db.Query(query)
	if err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}
	defer func() {
		if errClose := tables.Close(); errClose != nil {
			err = errors.Join(err, errClose)
		}
	}()

	var tableNames []string
	for tables.Next() {
		var name string
		if err := tables.Scan(&name); err != nil {
			return err
		}
		if name != "" {
			tableNames = append(tableNames, name)
		}
	}
	if err := tables.Err(); err != nil {
		return &database.Error{OrigErr: err, Query: []byte(query)}
	}

	for _, t := range tableNames {
		q := "DROP TABLE " + t
		if err := m.executeQuery(q); err != nil {
			return &database.Error{OrigErr: err, Query: []byte(q)}
		}
	}

	if len(tableNames) > 0 {
		if _, err := m.db.Exec("VACUUM"); err != nil {
			return &database.Error{OrigErr: err, Query: []byte("VACUUM")}
		}
	}
	return nil
}
