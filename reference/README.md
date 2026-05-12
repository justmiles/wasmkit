# TCSS Reports

Internal dashboard for monitoring key business metrics and reports.

## Tech Stack

- **Backend**: Go with [chi](https://github.com/go-chi/chi) router, PostgreSQL, [golang-migrate](https://github.com/golang-migrate/migrate)
- **Frontend**: [Next.js](https://nextjs.org/) (App Router), [shadcn/ui](https://ui.shadcn.com/), Tailwind CSS v4
- **Theme**: i3 ONE UI design system

## Getting Started

### Prerequisites

- [Devbox](https://www.jetify.com/devbox) (recommended), or manually: Go 1.25+, Node.js 20+, Docker
- Docker & Docker Compose (for PostgreSQL)

### Quick Start

```bash
# Enter dev environment
devbox shell

# Start PostgreSQL
make db-up

# Install dependencies
make setup

# Run backend (terminal 1)
make dev-backend

# Run frontend (terminal 2)
make dev-frontend
```

The frontend runs on [http://localhost:3000](http://localhost:3000) and proxies API requests to the backend on port 8080.

### Adding shadcn Components

```bash
cd frontend
npx shadcn@latest add button card dialog
```

### Database Migrations

```bash
# Apply all pending migrations
make migrate-up

# Revert the last migration
make migrate-down
```

### Docker

```bash
make docker-build
make docker-run
```

## Project Structure

See [AGENTS.md](AGENTS.md) for detailed architecture documentation.

