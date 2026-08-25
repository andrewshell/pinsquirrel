# PinSquirrel

A pnpm monorepo with a Hono + HTMX web application and shared libraries.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development database
pnpm db:up

# Start development server
pnpm dev

# Open http://localhost:8100
```

## Development Commands

### Core Workflow

```bash
pnpm install          # Install dependencies for all workspaces
pnpm dev              # Start development server
pnpm build            # Build all packages
pnpm test             # Run tests across all workspaces
```

### Database Management

```bash
pnpm db:up             # Start MySQL database via Docker
pnpm db:down           # Stop database

# Database operations (run from root)
pnpm --filter @pinsquirrel/database db:generate    # Generate migrations
pnpm --filter @pinsquirrel/database db:migrate     # Run migrations
pnpm --filter @pinsquirrel/database db:studio      # Open Drizzle Studio
```

### Code Quality

```bash
pnpm typecheck         # Type check all packages
pnpm lint              # Run ESLint across all workspaces
pnpm format            # Format code with Prettier (write mode)
pnpm format:check      # Verify formatting — this is the gate CI runs
pnpm test              # Run all tests

# Run all quality checks
pnpm quality
```

### Workspace-Specific Commands

```bash
# Hono app
pnpm --filter @pinsquirrel/hono dev           # Start dev server only
pnpm --filter @pinsquirrel/hono test          # Run app tests
pnpm --filter @pinsquirrel/hono build         # Build app

# Admin console (local operator tool, port 8200)
pnpm admin                                    # Start the admin console

# Libraries
pnpm --filter @pinsquirrel/services test      # Run services tests
pnpm --filter @pinsquirrel/database test      # Run database tests
pnpm --filter @pinsquirrel/crypto keygen      # Generate an email sealing keypair
```

### Testing

```bash
# Run all tests
pnpm test

# Test specific workspace
pnpm --filter @pinsquirrel/hono test
pnpm --filter @pinsquirrel/services test
pnpm --filter @pinsquirrel/database test

# Test with watch mode (great for TDD)
pnpm --filter @pinsquirrel/hono test:watch
pnpm --filter @pinsquirrel/services test:watch
pnpm --filter @pinsquirrel/database test:watch

# Test with coverage reports
pnpm --filter @pinsquirrel/hono test:coverage
pnpm --filter @pinsquirrel/services test:coverage
pnpm --filter @pinsquirrel/database test:coverage
```

## Repository Structure

```
├── apps/
│   ├── hono/                   # Hono + HTMX application
│   └── admin/                  # Local operator console (not deployed)
├── libs/
│   ├── services/               # Business logic services and validation
│   ├── database/               # Database layer with Drizzle ORM
│   ├── domain/                 # Domain entities and interfaces
│   ├── adapters/               # External service adapters
│   ├── crypto/                 # Email sealing and the keygen CLI
│   └── mailgun/                # Email service implementation
├── docker-compose.dev.yml      # Development MySQL database
├── package.json                # Root package with workspace scripts
└── turbo.json                  # Turbo build orchestration
```

## Environment Setup

### Database Configuration

Copy the environment template into the app that reads it:

```bash
cp apps/hono/.env.example apps/hono/.env
```

The default database connection works with `pnpm db:up`:

```
DATABASE_URL=mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel
```

`apps/hono/.env.example` documents every variable the app reads; see
[DEPLOYMENT.md](./DEPLOYMENT.md) for what each one does in production.

The admin console is configured by `apps/admin/admin.config.json` instead —
copy `apps/admin/admin.config.example.json` to get started. It reads three
environment variables: `PORT` (default `8200`), `ADMIN_HOST` (default
`127.0.0.1` — set it only to expose the console beyond loopback), and
`ADMIN_SESSION_TTL_MS` (default 8 hours, after which the unlocked private key
is dropped from memory).

### Prerequisites

- **Node.js**: >= 24.0.0
- **pnpm**: Specified in `packageManager` field (auto-installed via corepack)
- **Docker**: For development database

## Production Deployment

### Build Docker Image

```bash
# Build production image (run from repository root)
docker build -f apps/hono/Dockerfile -t your-username/pinsquirrel:latest .

# Or use the convenience script (builds and pushes to Docker Hub)
pnpm docker:build-push
```

### Deployment Options

- **Self-hosted**: Use Dockge with your published Docker image
- **DigitalOcean App Platform**: Point to repository, use managed MySQL
- **Other platforms**: Use the Dockerfile with `DATABASE_URL` environment variable

## Development Workflow

1. **Start database**: `pnpm db:up`
2. **Start development**: `pnpm dev`
3. **Make changes**: Edit code in `apps/hono/`, `libs/services/`, or `libs/database/`
4. **Run tests**: `pnpm --filter <workspace> test:watch`
5. **Quality check**: `pnpm quality`
6. **Commit changes**: Follow conventional commits

## Monorepo Guidelines

- **Always run commands from repository root** using `pnpm --filter <workspace>`
- **Follow TDD**: Write tests first, then implement features
- **Quality gates**: All checks must pass before considering work complete
- **Inter-package dependencies**: Use `workspace:*` protocol in package.json

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Detailed development workflow and codebase architecture
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment with Docker and migrations
- [STYLE.md](./STYLE.md) - Neo Brutalism UI design system and component patterns
