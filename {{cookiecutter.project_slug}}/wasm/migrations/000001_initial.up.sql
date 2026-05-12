CREATE TABLE entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT,
    started_at INTEGER NOT NULL,
    ended_at   INTEGER,
    created_at INTEGER NOT NULL
);
