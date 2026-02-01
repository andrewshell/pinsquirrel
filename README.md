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
pnpm db:up             # Start PostgreSQL database via Docker
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
pnpm format            # Format code with Prettier
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

# Services library
pnpm --filter @pinsquirrel/services test     # Run services tests
pnpm --filter @pinsquirrel/services dev      # TypeScript watch mode

# Database library
pnpm --filter @pinsquirrel/database test     # Run database tests
pnpm --filter @pinsquirrel/database dev      # TypeScript watch mode
```

### Testing

```bash
# Run all tests
pnpm test

# Test specific workspace
pnpm test --filter @pinsquirrel/hono
pnpm test --filter @pinsquirrel/services
pnpm test --filter @pinsquirrel/database

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
│   └── hono/                   # Hono + HTMX application
├── libs/
│   ├── services/               # Business logic services and validation
│   ├── database/               # Database layer with Drizzle ORM
│   ├── domain/                 # Domain entities and interfaces
│   ├── adapters/               # External service adapters
│   └── mailgun/                # Email service implementation
├── docker-compose.dev.yml      # Development PostgreSQL database
├── package.json               # Root package with workspace scripts
└── turbo.json                 # Turbo build orchestration
```

## Environment Setup

### Database Configuration

Copy the environment template:

```bash
cp .env.example .env
```

The default database connection works with `pnpm db:up`:

```
DATABASE_URL=postgresql://pinsquirrel:pinsquirrel@localhost:5432/pinsquirrel
```

### Prerequisites

- **Node.js**: >= 22.0.0
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
- **DigitalOcean App Platform**: Point to repository, use managed PostgreSQL
- **Other platforms**: Use the Dockerfile with `DATABASE_URL` environment variable

## Development Workflow

1. **Start database**: `pnpm db:up`
2. **Start development**: `pnpm dev`
3. **Make changes**: Edit code in `apps/hono/`, `libs/services/`, or `libs/database/`
4. **Run tests**: `pnpm test --filter <workspace> -- --watch`
5. **Quality check**: `pnpm quality`
6. **Commit changes**: Follow conventional commits

## Monorepo Guidelines

- **Always run commands from repository root** using `pnpm --filter <workspace>`
- **Follow TDD**: Write tests first, then implement features
- **Quality gates**: All checks must pass before considering work complete
- **Inter-package dependencies**: Use `workspace:*` protocol in package.json

---

For more detailed information, see [CLAUDE.md](./CLAUDE.md).
