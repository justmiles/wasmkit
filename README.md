# wasmkit

A [cookiecutter](https://github.com/cookiecutter/cookiecutter) template and framework for building local-first single-page applications with Go/WASM, browser-native SQLite (OPFS), and React.

## What you get

- **Go/WASM backend** running in a Web Worker with SQLite persistence via OPFS
- **Schema migrations** powered by `golang-migrate` with embedded SQL files
- **Type-safe bridge** with Go types auto-compiled to TypeScript via `github.com/coder/guts`
- **React + Tailwind CSS** frontend scaffolded with Vite
- **Makefile** with build, dev, watch, and clean targets
- **Fully static deployment** — no server required

## Repo structure

This repo contains three independent artifacts:

| Artifact | Path | Published as |
|----------|------|--------------|
| Go framework | `wasmkit-go/` | `github.com/justmiles/wasmkit/wasmkit-go` (Go module) |
| JS/TS framework | `wasmkit-js/` | `@justmiles/wasmkit` (npm package) |
| Project template | `{{cookiecutter.project_slug}}/` | Cookiecutter template |

The Go module and npm package are **published independently** and consumed by generated projects as external dependencies. They are never rendered as part of the cookiecutter output.

## Prerequisites

- [cookiecutter](https://github.com/cookiecutter/cookiecutter) (`pipx install cookiecutter`)
- Go 1.26+
- Node.js 20+

Or use [Devbox](https://www.jetify.com/devbox) — each generated project includes a `devbox.json` with the correct toolchain.

## Usage

```bash
cookiecutter gh:justmiles/wasmkit
```

You'll be prompted for:

| Variable | Default | Description |
|----------|---------|-------------|
| `project_name` | My WASM App | Human-readable project name |
| `project_slug` | my-wasm-app | Directory name and package identifier (auto-derived from `project_name`) |
| `go_module` | github.com/myuser/my-wasm-app | Go module path |
| `db_name` | app | SQLite database filename (without `.db`) |
| `description` | A local-first SPA... | Short project description |
| `author` | Your Name | Author name |

After generation:

```bash
cd my-wasm-app
devbox run setup
devbox run dev
```

## Generated project layout

```
my-wasm-app/
├── wasm/           # Go/WASM backend (compiles to main.wasm)
├── web/            # React + Vite frontend
├── typegen/        # Go → TypeScript type generation
├── Makefile        # Build, dev, watch, lint, clean, deps targets
├── devbox.json     # Devbox dev environment
└── go.work         # Go workspace for wasm/ and typegen/
```

### Key Makefile targets

| Target | Description |
|--------|-------------|
| `make deps` | Install Go and Node.js dependencies |
| `make dev` | Build WASM + types, then start the Vite dev server |
| `make build` | Full production build (WASM + types + Vite bundle) |
| `make watch` | Watch Go source and rebuild WASM + types on change |
| `make lint` | Run Go and TypeScript linters |
| `make clean` | Remove build artifacts |

## Framework packages

### `wasmkit` (Go module)

Provides reusable Go packages for WASM apps:

- **`bridge`** — Register Go functions as JS-callable handlers with automatic JSON marshalling and error envelopes. Includes `InitDB()` for OPFS-backed SQLite with migrations.
- **`migrate`** — Single-call migration runner wrapping `golang-migrate` with the wasmkit SQLite driver.
- **`sqlitedriver`** — CGO-free `golang-migrate` database driver for `ncruces/go-sqlite3`.

### `@justmiles/wasmkit` (npm package)

Provides the browser-side runtime:

- **`useWasm()`** hook — Manages WASM worker lifecycle, multi-tab coordination via SharedWorker, and typed `call<T>()` for invoking Go handlers.
- **`wasmBridge()`** Vite plugin — Sets required COOP/COEP headers for SharedArrayBuffer and OPFS.
- **Worker files** — Dedicated WASM worker and SharedWorker coordinator shipped as static assets.

## License

[MIT](LICENSE)
