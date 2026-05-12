# wasm-starter

A [cookiecutter](https://github.com/cookiecutter/cookiecutter) template for building local-first single-page applications with Go/WASM, browser-native SQLite (OPFS), and React.

## What you get

- **Go/WASM backend** running in a Web Worker with SQLite persistence via OPFS
- **Schema migrations** powered by `golang-migrate` with embedded SQL files
- **Type-safe bridge** with Go types auto-compiled to TypeScript via `github.com/coder/guts`
- **React + Tailwind CSS** frontend scaffolded with Vite
- **Makefile** with build, dev, watch, and clean targets
- **Fully static deployment** -- no server required

## Repo structure

This repo contains three independent artifacts:

| Artifact | Path | Published as |
|----------|------|--------------|
| Go framework | `wasmkit/` | `github.com/justmiles/wasmkit` (Go module) |
| JS/TS framework | `wasmkit-js/` | `@justmiles/wasmkit` (npm package) |
| Project template | `{{cookiecutter.project_slug}}/` | Cookiecutter template |

The Go module and npm package are **published independently** and consumed by generated projects as external dependencies. They are never rendered as part of the cookiecutter output.

## Prerequisites

- [cookiecutter](https://github.com/cookiecutter/cookiecutter) (`pipx install cookiecutter`)
- Go 1.24+
- Node.js 20+

## Usage

```bash
cookiecutter gh:justmiles/wasm-starter
```

You'll be prompted for:

| Variable | Default | Description |
|----------|---------|-------------|
| `project_name` | My WASM App | Human-readable project name |
| `project_slug` | my-wasm-app | Directory name and package identifier |
| `go_module` | github.com/myuser/my-wasm-app | Go module path |
| `db_name` | app | SQLite database filename (without .db) |
| `description` | A local-first SPA... | Short project description |
| `author` | Your Name | Author name |

After generation:

```bash
cd my-wasm-app
make deps
make dev
```

## Architecture

See [notes.md](notes.md) for a detailed architecture document covering:

- Two-runtime browser model (React UI + Go/WASM compute)
- Web Worker communication patterns and multi-tab coordination
- OPFS-backed SQLite persistence
- golang-migrate integration in WASM
- Go-to-TypeScript type generation with guts
- Build and deployment strategy

## Framework packages

### `wasmkit` (Go module)

Provides reusable Go packages for WASM apps:

- **`bridge`** -- Register Go functions as JS-callable handlers with automatic JSON marshalling and error envelopes. Includes `InitDB()` for OPFS-backed SQLite with migrations.
- **`migrate`** -- Single-call migration runner wrapping `golang-migrate` with the wasmkit SQLite driver.
- **`sqlitedriver`** -- CGO-free `golang-migrate` database driver for `ncruces/go-sqlite3`.

### `wasmkit` (npm package)

Provides the browser-side runtime:

- **`useWasm()`** hook -- Manages WASM worker lifecycle, multi-tab coordination via SharedWorker, and typed `call<T>()` for invoking Go handlers.
- **`wasmBridge()`** Vite plugin -- Sets required COOP/COEP headers for SharedArrayBuffer and OPFS.
- **Worker files** -- Dedicated WASM worker and SharedWorker coordinator shipped as static assets.
