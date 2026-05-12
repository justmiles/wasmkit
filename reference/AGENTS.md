# TCSS Reports

## Project Overview

TCSS Reports is a full-stack web application with a **Go backend** and a **Next.js frontend**, styled with the **i3 ONE UI** design system via **shadcn/ui**.

| Layer    | Stack                                      | Port   |
|----------|--------------------------------------------|--------|
| Backend  | Go, chi router, PostgreSQL, golang-migrate | 8080   |
| Frontend | Next.js (App Router), shadcn/ui, Tailwind CSS v4 | 3000 |

## Architecture

```
┌──────────────┐        ┌──────────────────┐        ┌────────────┐
│  Next.js     │  HTTP  │  Go API Server   │  SQL   │ PostgreSQL │
│  Frontend    │───────▶│  (chi router)    │───────▶│            │
│  :3000       │        │  :8080            │        │  :5432      │
└──────────────┘        └──────────────────┘        └────────────┘
```

## Repository Structure

```
├── backend/
│   ├── main.go              # Entry point (calls cmd.Execute)
│   ├── cmd/                 # Cobra CLI commands
│   │   ├── root.go          # Root command + shared flags
│   │   ├── serve.go         # `serve` subcommand (HTTP server)
│   │   ├── migrate.go       # `migrate up|down` subcommands
│   │   └── typegen/main.go  # Go→TS type generator (coder/guts)
│   ├── internal/
│   │   ├── api/             # HTTP handlers and router
│   │   │   ├── router.go    # chi router setup with middleware
│   │   │   ├── health.go    # Health check endpoint
│   │   │   ├── sprint_metrics.go  # Jira sprint metrics handlers
│   │   │   └── operations_metrics.go # Operations (MTTA/MTTR) handlers
│   │   ├── config/          # YAML config loader
│   │   │   └── config.go    # JiraConfig types + LoadJiraConfig
│   │   ├── jira/            # Jira API client
│   │   │   ├── client.go    # HTTP client with basic auth + caching
│   │   │   └── types.go     # Jira API response types
│   │   └── database/
│   │       ├── database.go  # PostgreSQL connection pool
│   │       ├── sprints.go   # Sprint report cache queries
│   │       ├── operations.go # Operations metrics queries
│   │       └── migrations/  # SQL migration files (golang-migrate)
│   ├── go.mod
│   └── Makefile
├── frontend/
│   ├── app/                 # Next.js App Router pages
│   │   ├── globals.css      # i3 ONE UI shadcn theme
│   │   ├── layout.tsx       # Root layout with ThemeProvider
│   │   ├── page.tsx         # Landing page (report index)
│   │   ├── sprints/page.tsx # Sprint metrics report
│   │   └── operations/page.tsx # Operations dashboard (MTTA/MTTR)
│   ├── components/          # React components
│   │   ├── sprint-report.tsx       # Sprint metrics report UI
│   │   ├── operations-dashboard.tsx # Operations dashboard UI
│   │   ├── dashboard-charts.tsx    # Shared chart components
│   │   ├── global-header.tsx       # App header with sidebar nav
│   │   ├── global-footer.tsx       # App footer
│   │   └── theme-provider.tsx      # next-themes provider
│   ├── lib/                 # Shared utilities (includes api.ts for Jira endpoints)
│   ├── public/              # Static assets
│   ├── components.json      # shadcn/ui configuration
│   └── package.json
├── jira.yaml                # Jira project/board/sprint filter config
├── Dockerfile               # Multi-stage production build
├── docker-compose.yml       # Local dev PostgreSQL service
├── devbox.json              # Nix-based dev environment
└── Makefile                 # Top-level task runner
```

## Development Environment

### Prerequisites

Use [Devbox](https://www.jetify.com/devbox) for a reproducible dev environment:

```bash
devbox shell        # Activates Go, Node.js, PostgreSQL, golang-migrate, golangci-lint, frp
devbox run setup    # Installs all dependencies (go mod tidy + npm install)
```

Start services in separate terminals:

```bash
devbox run dev:backend   # cd backend && make run
devbox run dev:frontend  # cd frontend && npm run dev
```

Other devbox scripts: `migrate:up`, `migrate:down`, `test`.

Or install manually: Go 1.25+, Node.js 20+, PostgreSQL 16+.

### Running Locally

```bash
# Start PostgreSQL
docker compose up -d postgres

# Backend
cd backend && make run

# Frontend (separate terminal)
cd frontend && npm run dev
```

## Backend Conventions

### Go Project Layout

Follow the standard Go project layout:
- `main.go` — Entry point, calls `cmd.Execute()`.
- `cmd/` — [Cobra](https://github.com/spf13/cobra) CLI commands. Each file defines a subcommand.
- `internal/` — Private application code. Cannot be imported by other projects.

### CLI Commands

The backend binary uses cobra for its CLI. Available commands:

```bash
# Start the HTTP server (default command for development)
go run . serve
go run . serve --port 9090
go run . serve --auto-migrate=false

# Run migrations
go run . migrate up
go run . migrate down
go run . migrate down --steps 3
go run . migrate force 3   # Override version without running migrations

# All commands accept --database-url or read DATABASE_URL from env
go run . serve --database-url "postgres://..."
```

Adding new commands: create a new file in `cmd/`, define a `cobra.Command`, and register it with `rootCmd.AddCommand()` in an `init()` function. Shared flags (like `--database-url`) live in `root.go`.

### HTTP API

- All API routes live under `/api/v1/` prefix.
- Use chi's middleware chain: `RequestID`, `RealIP`, `Logger`, `Recoverer`, CORS.
- Handlers are methods on a `Server` struct that holds dependencies (DB pool, Jira client, config).
- Return JSON responses. Use `http.Error` for error responses.
- New endpoints: create a file in `internal/api/`, register routes in `router.go`.

Current routes:

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/jira/projects` | List configured projects |
| GET | `/api/v1/jira/boards` | List boards for a project |
| GET | `/api/v1/jira/boards/{boardId}/sprints` | List sprints for a board |
| GET | `/api/v1/jira/boards/{boardId}/sprints/{sprintId}/report` | Sprint report |
| POST | `/api/v1/jira/sprints/sync` | Sync sprint data to cache |
| GET | `/api/v1/operations/metrics` | Operations MTTA/MTTR metrics |
| POST | `/api/v1/operations/sync` | Sync operations data |
| GET | `/api/v1/operations/issue-types` | List operations issue types |

### Database

- Connection managed via `database/sql` with the `pq` driver.
- Migrations use [golang-migrate](https://github.com/golang-migrate/migrate) in `internal/database/migrations/`.
- Migration files follow the naming convention `NNNNNN_description.up.sql` / `NNNNNN_description.down.sql` with a zero-padded sequence number. The up file applies the change; the down file reverts it.
- Apply migrations: `go run . migrate up` (or `make migrate-up`)
- Revert migrations: `go run . migrate down` (or `make migrate-down`)
- Auto-migration on `serve` startup is enabled by default; disable with `--auto-migrate=false`.

### Environment Variables

| Variable          | Default                                              | Description                                  |
|-------------------|------------------------------------------------------|----------------------------------------------|
| `DATABASE_URL`    | `postgres://postgres:postgres@localhost:5432/tcss_reports?sslmode=disable` | PostgreSQL connection           |
| `API_PORT`        | `8080`                                               | HTTP server port                             |
| `JIRA_BASE_URL`   | _(none)_                                             | Jira instance URL (e.g. `https://company.atlassian.net`) |
| `JIRA_USER_EMAIL` | _(none)_                                             | Email for Jira Cloud basic auth              |
| `JIRA_API_TOKEN`  | _(none)_                                             | Jira API token                               |
| `JIRA_CONFIG`     | _(none)_                                             | Path to `jira.yaml` config file              |
| `JIRA_PROJECTS`   | _(none)_                                             | Comma-separated project keys (fallback when `JIRA_CONFIG` is not set) |

These can also be passed as CLI flags (`--database-url`, `--port`, `--jira-base-url`, `--jira-user-email`, `--jira-api-token`, `--jira-config`, `--jira-projects`). Jira variables are typically sourced from `.envrc`.

### Jira Configuration File (`jira.yaml`)

For advanced filtering, set `JIRA_CONFIG=jira.yaml` (or `--jira-config jira.yaml`). The file defines which projects, boards, and sprints appear in reports:

```yaml
projects:
  - key: TCSS                         # Jira project key
    boards:                            # optional: limit to named boards
      - name: TCSS DBA
        sprintPattern: "^DBA Sprint"   # optional: regex filter on sprint names
      - name: AWS Cloud Services       # no pattern = all sprints

# Projects queried for Operations dashboard (Service Requests, Incidents).
operationsProjects:
  - SVCDSK
```

- **`projects[].key`** — required, the Jira project key.
- **`projects[].boards`** — optional list of board names to include. Omit to include all boards.
- **`projects[].boards[].sprintPattern`** — optional regex applied to sprint names. Omit to include all sprints.
- **`operationsProjects`** — optional list of project keys for the Operations dashboard (MTTA/MTTR metrics). These are queried for Service Requests and Incidents.

If `JIRA_CONFIG` is not set, the server falls back to `JIRA_PROJECTS` (comma-separated keys, all boards/sprints included).

### Type Generation (Go → TypeScript)

API response types are defined once in Go and converted to TypeScript using [coder/guts](https://github.com/coder/guts). The generated file is `frontend/lib/types.gen.ts`.

- **Source of truth**: Go structs in `internal/api/` and `internal/jira/` (exported types with `json` tags).
- **Generate**: `make typegen` (runs `go run ./cmd/typegen/` from backend).
- **Frontend consumption**: `frontend/lib/api.ts` re-exports types from `types.gen.ts` and provides fetch helpers.
- **When to regenerate**: After adding/modifying any exported struct that appears in API responses.
- **Do not edit** `frontend/lib/types.gen.ts` by hand — it is overwritten on each generation.

## Frontend Conventions

### Next.js App Router

- Pages live in `app/` using the file-system routing convention.
- Server Components are the default. Add `"use client"` only when the component uses `useState`, `useEffect`, event handlers, or browser APIs.
- Do not use barrel files. Import directly from the file that defines the value.
- **URL State Sync** — All user-facing view state (selected tabs, filters, time ranges, dropdowns) MUST be persisted to the URL via query parameters using `window.history.replaceState`. Read initial values from `useSearchParams()` on mount. This enables shareable/bookmarkable links and browser back/forward navigation. See `sprint-report.tsx` `syncUrl()` and `operations-dashboard.tsx` `syncUrl()` for the pattern.
- **New Page Checklist** — When adding a new page, you MUST also:
  1. Add a navigation entry to the `navItems` array in `components/global-header.tsx` (sidebar nav).
  2. Add a report card to the `reports` array in `app/page.tsx` (home page index).

### shadcn/ui Components

- Add components via CLI: `npx shadcn@latest add button card dialog`
- Always check if a component exists before writing custom markup.
- Use the component's built-in variants before custom styles.

### i3 ONE UI Theme

The frontend uses the i3 ONE design system mapped to shadcn semantic tokens. Key rules:

- **Use semantic color tokens** — `bg-primary`, `text-muted-foreground`, `bg-destructive`. Never use raw Tailwind colors like `bg-blue-500`.
- **Extended tokens** — `bg-positive`, `bg-warning`, `bg-info` and their foreground variants are available for status states.
- **Typography** — Headings use Raleway (`font-heading`), body text uses Nunito Sans (`font-sans`), code uses IBM Plex Mono (`font-mono`), display/serif uses Noto Serif (`font-display`).
- **Dark mode** — Handled via `next-themes` with class strategy. All theme tokens automatically adapt. Never use manual `dark:` color overrides.

### Styling Rules

- Use `gap-*` for spacing, not `space-x-*` or `space-y-*`.
- Use `size-*` when width and height are equal (`size-10` not `w-10 h-10`).
- Use `cn()` from `lib/utils` for conditional class merging.
- Use `truncate` shorthand instead of `overflow-hidden text-ellipsis whitespace-nowrap`.
- No manual `z-index` on overlay components (Dialog, Sheet, Popover handle their own stacking).

### Component Selection Guide

| Need               | Use                                           |
|--------------------|-----------------------------------------------|
| Button/action      | `Button` with appropriate variant             |
| Form inputs        | `Input`, `Select`, `Switch`, `Checkbox`       |
| Data display       | `Table`, `Card`, `Badge`, `Avatar`            |
| Navigation         | `Sidebar`, `Tabs`, `Breadcrumb`               |
| Overlays           | `Dialog`, `Sheet`, `Drawer`, `AlertDialog`    |
| Feedback           | `sonner` (toast), `Alert`, `Skeleton`         |
| Layout             | `Card`, `Separator`, `ScrollArea`             |

### Coding Standards (All Languages)

- **File length**: Keep files under **400 lines** (excluding blank lines and comments). This applies to both Go and TypeScript/TSX. Split logically when approaching the limit. Enforced by `golangci-lint` (backend) and ESLint `max-lines` (frontend).
- **ASCII only**: No emojis, pictograms, or non-ASCII Unicode in source code, comments, or documentation.

### Golang Coding Standards

- **Error messages**: Use concise phrasing. Avoid "failed to" prefixes. Wrap errors with `%w` to maintain chains.
- **Sentinel errors**: Use `err` prefix naming (e.g., `errNotFound`).
- **Tests**: Use `t.Parallel()` on all test functions. No project-level tests exist yet -- new code should include tests.

Linting is handled by **golangci-lint** (backend) and **ESLint** (frontend), both available through devbox:

```bash
devbox run lint          # Runs both backend and frontend linters
cd frontend && npm run lint   # Frontend only
cd backend && golangci-lint run ./...  # Backend only
```

## Testing

### Backend

```bash
cd backend && make test
```

Place test files next to the code they test with `_test.go` suffix.

### Frontend

```bash
cd frontend && npm test
```

## Docker

Build a production image:

```bash
docker build -t tcss-reports .
docker run -p 8080:8080 tcss-reports
```

The Dockerfile uses a multi-stage build: frontend assets are built first, then embedded into the Go binary's static file serving.
