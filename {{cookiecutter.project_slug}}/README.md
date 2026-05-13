# {{ cookiecutter.project_name }}

{{ cookiecutter.description }}

## Tech Stack

- **Backend**: Go (WASM), [wasmkit](https://github.com/justmiles/wasmkit) (bridge, SQLite, migrations)
- **Frontend**: React, TypeScript, [Vite](https://vitejs.dev/), Tailwind CSS, wasmkit (useWasm hook + Vite plugin)
- **Type Safety**: Go types compiled to TypeScript via [coder/guts](https://github.com/coder/guts)

## Getting Started

### Prerequisites

- [Devbox](https://www.jetify.com/devbox) (recommended), or manually: Go 1.24+, Node.js 20+

### Quick Start

```bash
# Enter dev environment
devbox shell

# Install dependencies
devbox run setup

# Build WASM + types and start dev server
devbox run dev
```

The app runs on [http://localhost:5173](http://localhost:5173).

## Development

### Common Commands

```bash
make dev        # Build WASM + types, start Vite dev server
make build      # Production build (WASM + Vite)
make wasm       # Compile Go to WebAssembly only
make typegen    # Regenerate TypeScript types from Go structs
make watch      # Auto-rebuild on Go file changes
make lint       # Run golangci-lint and ESLint
make clean      # Remove build artifacts
make deps       # Install all dependencies
```

### Adding a Migration

```bash
touch wasm/migrations/000002_description.up.sql
touch wasm/migrations/000002_description.down.sql
```

Edit the SQL files, then rebuild with `make wasm`. Migrations run automatically on page load.

### Type Generation

After modifying Go structs in `wasm/apitypes/types.go`:

```bash
make typegen
```

This regenerates `web/src/lib/types.gen.ts`. Do not edit that file by hand.

### Linting

```bash
make lint                          # Both Go and TypeScript
golangci-lint run ./wasm/...       # Go only
cd web && npx eslint .             # TypeScript only
```

## Building for Production

```bash
make build
```

Produces a static `web/dist/` directory. Deploy to any static host that serves `.wasm` with `Content-Type: application/wasm`.

Required response headers for OPFS support:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

## Project Structure

See [AGENTS.md](AGENTS.md) for detailed architecture documentation and coding standards.
