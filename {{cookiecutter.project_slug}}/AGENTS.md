# {{ cookiecutter.project_name }}

## Project Overview

{{ cookiecutter.project_name }} is a local-first single-page application with a **Go/WASM backend** running in a Web Worker and a **React frontend** using **shadcn/ui** and Tailwind CSS.

| Layer    | Stack                                                    |
|----------|----------------------------------------------------------|
| Backend  | Go (WASM), wasmkit (bridge + SQLite + migrations)        |
| Frontend | React, TypeScript, Vite, wasmkit (useWasm hook + plugin) |
| Bridge   | Web Worker + SharedWorker + postMessage (via wasmkit)     |

## Architecture

```
+------------------+   postMessage   +----------------------------+
|  React Frontend  | <=============> |  Web Worker (wasmkit)      |
|  (Main Thread)   |                 |  +----------------------+  |
|  Vite + wasmkit  |   SharedWorker  |  | Go/WASM Binary       |  |
|  useWasm() hook  |   coordinator   |  | - wasmkit/bridge     |  |
+------------------+   (multi-tab)   |  | - SQLite (OPFS)      |  |
                                     |  +----------+-----------+  |
                                     |             |              |
                                     |             v              |
                                     |        OPFS (disk)         |
                                     +----------------------------+
```

## Repository Structure

```
├── wasm/
│   ├── main.go              # Entry point, handlers registered via wasmkit/bridge
│   ├── apitypes/
│   │   └── types.go         # Domain types (source of truth for TypeScript)
│   └── migrations/          # SQL migration files (golang-migrate)
│       ├── 000001_initial.up.sql
│       └── 000001_initial.down.sql
├── typegen/
│   ├── go.mod
│   └── main.go              # Go-to-TypeScript type generator (coder/guts)
├── web/
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx         # React entry point
│   │   ├── App.tsx          # Root component (uses useWasm from wasmkit)
│   │   ├── lib/
│   │   │   ├── utils.ts     # cn() helper for class merging
│   │   │   └── types.gen.ts # Generated types (do not edit)
│   │   ├── components/
│   │   │   └── ui/          # shadcn/ui components (installed via CLI)
│   │   └── styles/
│   │       └── globals.css  # Tailwind + shadcn/ui CSS variables
│   ├── components.json      # shadcn/ui CLI configuration
│   ├── package.json         # depends on wasmkit npm package
│   ├── vite.config.ts       # uses wasmBridge() plugin from wasmkit
│   ├── tsconfig.json
│   ├── eslint.config.mts    # ESLint configuration
│   ├── tailwind.config.js
│   └── postcss.config.js
├── devbox.json              # Nix-based dev environment
├── .golangci.yml            # Go linter configuration
├── Makefile                 # Build, dev, lint, and clean targets
└── README.md
```

## Development Environment

Use [Devbox](https://www.jetify.com/devbox) for a reproducible dev environment:

```bash
devbox shell           # Activates Go, Node.js, golangci-lint
devbox run setup       # Installs all dependencies
devbox run dev         # Builds WASM + types, starts Vite dev server
```

Or install manually: Go 1.24+, Node.js 20+.

## Go/WASM Backend

### Exported Functions

Go functions are registered as Web Worker globals via `wasmkit/bridge`. Each handler:
- Receives a `json.RawMessage` payload (the serialized argument from the frontend).
- Returns any JSON-serialisable value and an error. The bridge handles marshalling and the error envelope.

Register new functions in `main()`:

```go
bridge.Register("myFunction", func(payload json.RawMessage) (any, error) {
    // unmarshal payload, do work, return result
})
```

### Database

- SQLite runs in-browser via `ncruces/go-sqlite3` with OPFS persistence.
- Migrations use [golang-migrate](https://github.com/golang-migrate/migrate) with embedded SQL files.
- Migration files follow the naming convention `NNNNNN_description.up.sql` / `NNNNNN_description.down.sql`.
- Migrations run automatically on page load via `initDB()`.

Adding a migration:

```bash
touch wasm/migrations/000002_description.up.sql
touch wasm/migrations/000002_description.down.sql
```

### Type Generation (Go to TypeScript)

Domain types are defined once in Go and converted to TypeScript using [coder/guts](https://github.com/coder/guts). The generated file is `web/src/lib/types.gen.ts`.

- **Source of truth**: Go structs in `wasm/apitypes/types.go` (exported types with `json` tags).
- **Generate**: `make typegen` (runs `go run .` from typegen/).
- **Frontend consumption**: Import from `@/lib/types.gen`.
- **When to regenerate**: After adding or modifying any exported struct.
- **Do not edit** `web/src/lib/types.gen.ts` by hand.

## Frontend Conventions

### React + Vite

- Components live in `web/src/components/`.
- Use functional components with hooks.
- Do not use barrel files. Import directly from the file that defines the value.
- State that crosses the WASM boundary uses the `useWasm()` hook from `wasmkit/react`.

### shadcn/ui Components

This project uses [shadcn/ui](https://ui.shadcn.com/) as the component library. shadcn/ui components are installed into the project source (not consumed as an npm package) and live in `web/src/components/ui/`.

**Adding components:**

```bash
cd web
npx shadcn@latest add button card dialog table
```

**Rules:**

- Always check if a shadcn/ui component exists before writing custom markup.
- Use the component's built-in variants and props before adding custom styles.
- Do not modify files in `components/ui/` unless extending a component's API.
- Use `cn()` from `@/lib/utils` for conditional class merging.
- No manual `z-index` on overlay components (Dialog, Sheet, Popover handle their own stacking).

**Component selection guide:**

| Need               | Use                                           |
|--------------------|-----------------------------------------------|
| Button/action      | `Button` with appropriate variant             |
| Form inputs        | `Input`, `Select`, `Switch`, `Checkbox`       |
| Data display       | `Table`, `Card`, `Badge`, `Avatar`            |
| Navigation         | `Tabs`, `Breadcrumb`                          |
| Overlays           | `Dialog`, `Sheet`, `Drawer`, `AlertDialog`    |
| Feedback           | `sonner` (toast), `Alert`, `Skeleton`         |
| Layout             | `Card`, `Separator`, `ScrollArea`             |

### Styling Rules

- Use shadcn/ui semantic color tokens (`bg-primary`, `text-muted-foreground`, `bg-destructive`). Do not use raw Tailwind colors like `bg-blue-500`.
- Use `gap-*` for spacing, not `space-x-*` or `space-y-*`.
- Use `size-*` when width and height are equal (`size-10` not `w-10 h-10`).
- Use `cn()` from `@/lib/utils` for conditional class merging.
- Use `truncate` shorthand instead of `overflow-hidden text-ellipsis whitespace-nowrap`.
- Dark mode is supported via the `class` strategy. All CSS variable tokens adapt automatically. Do not use manual `dark:` color overrides on semantic tokens.

## Coding Standards (All Languages)

- **File length**: Keep files under **400 lines** (excluding blank lines and comments). This applies to both Go and TypeScript/TSX. Split logically when approaching the limit. Enforced by `golangci-lint` (revive/file-length-limit) and ESLint (`max-lines`).
- **ASCII only**: No emojis, pictograms, or non-ASCII Unicode in source code, comments, or documentation.

### Go Coding Standards

- **Error messages**: Use concise phrasing. Avoid "failed to" prefixes. Wrap errors with `%w` to maintain chains.
- **Sentinel errors**: Use `err` prefix naming (e.g., `errNotFound`).
- **Tests**: Use `t.Parallel()` on all test functions. Place test files next to the code they test with `_test.go` suffix.
- **Linting**: `golangci-lint run ./...` from the project root.

### TypeScript Coding Standards

- **Unused variables**: Prefix with underscore (`_unused`) to satisfy the linter.
- **No `any`**: Avoid untyped `any`. Use `unknown` and narrow with type guards when the type is genuinely uncertain.
- **Linting**: `cd web && npx eslint .`

## Linting

Linting is enforced for both Go and TypeScript:

```bash
make lint             # Runs both backend and frontend linters
cd web && npx eslint .              # Frontend only
golangci-lint run ./...             # Backend only (from project root)
```

### Go Linters Enabled

- `govet` -- Reports suspicious constructs.
- `errcheck` -- Ensures error return values are checked.
- `staticcheck` -- Advanced static analysis.
- `unused` -- Finds unused code.
- `revive` -- Style and complexity checks, including 400-line file limit.

### TypeScript/ESLint Rules

- `typescript-eslint/recommended` ruleset.
- `react-hooks/recommended` for hook dependency correctness.
- `max-lines`: 400 (skip blank lines and comments).
- Unused variables must be prefixed with `_`.
