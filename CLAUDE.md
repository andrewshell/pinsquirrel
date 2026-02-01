# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a pnpm monorepo with Turbo orchestration:

- `apps/` - Applications
  - `hono/` - Hono + HTMX application (main app)
- `libs/` - Shared libraries and utilities
  - `services/` - Business logic services and validation
  - `database/` - Database layer with Drizzle ORM for PostgreSQL
  - `domain/` - Domain entities and interfaces
  - `adapters/` - External service adapters
  - `mailgun/` - Email service implementation
- `pnpm-workspace.yaml` - Defines workspace packages
- `package.json` - Root package with Turbo scripts
- `turbo.json` - Turbo task configuration

## Essential Commands

### Development

- `pnpm dev` - Start development server (port 8100)
- `pnpm build` - Build all packages
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint across all workspaces
- `pnpm format` - Run Prettier formatting across all workspaces
- `pnpm test` - Run tests across all workspaces
- `pnpm typecheck` - Run TypeScript type checking

### Package Management

- `pnpm install` - Install dependencies for all workspaces
- `pnpm add <pkg> --filter <workspace>` - Add dependency to specific workspace
- `pnpm add <pkg> -w` - Add dependency to workspace root
- `pnpm --filter <workspace> <command>` - Run command in specific workspace

### Database Management

- `pnpm db:up` - Start development PostgreSQL database via Docker
- `pnpm db:down` - Stop development database

### Workspace Operations

- `pnpm -r <command>` - Run command in all workspaces
- `pnpm --filter "./apps/*" <command>` - Run command in all apps
- `pnpm --filter "./libs/*" <command>` - Run command in all libs

## Development Workflow

### IMPORTANT: Monorepo Command Guidelines

- **ALWAYS run commands from the project root** using `pnpm --filter <workspace>`
- **NEVER navigate to subdirectories** to run commands unless absolutely necessary
- If you must navigate to a subdirectory, **ALWAYS return to root** immediately after
- Use `pnpm --filter @pinsquirrel/hono <command>` instead of `cd apps/hono && pnpm <command>`
- Use `pnpm --filter @pinsquirrel/services <command>` instead of `cd libs/services && pnpm <command>`
- Use `pnpm --filter @pinsquirrel/database <command>` instead of `cd libs/database && pnpm <command>`

### Test-Driven Development (TDD) Workflow

When developing new features or fixing bugs, **ALWAYS follow the TDD red-green-refactor cycle**:

1. **RED**: Write a failing test first
   - `pnpm test --filter <workspace> -- --watch` to start test watcher
   - Write test that describes the expected behavior
   - Verify the test fails with the expected error

2. **GREEN**: Write minimal code to make the test pass
   - Implement just enough code to satisfy the test
   - Keep implementation simple and focused

3. **REFACTOR**: Improve the code while keeping tests green
   - Clean up implementation
   - Extract reusable components/functions
   - Ensure all tests still pass

### Quality Check Requirements

**NEVER mark any task as complete until ALL quality checks pass!**

Before considering any work "done", **ALL of the following must pass**:

1. **Type Check**: `pnpm typecheck` - Must pass with zero errors
2. **Lint**: `pnpm lint` - Must pass with zero errors (warnings should be addressed)
3. **Tests**: `pnpm test` - All tests must pass (100% success rate)
4. **Format**: `pnpm format` - Code must be properly formatted

**Quick Quality Check Commands:**

```bash
# Single command to run all quality checks:
pnpm quality

# Or run individually:
pnpm typecheck && pnpm lint && pnpm test && pnpm format
```

**If ANY check fails:**

- Fix typecheck errors first
- Then fix lint errors
- Then fix test failures
- Finally run format
- Re-run all checks until 100% pass

**Only when ALL checks pass should you:**

- Mark tasks as complete
- Commit changes
- Create pull requests

### Adding New Packages

1. Create directory in `apps/` or `libs/`
2. Add `package.json` with unique name following pattern `@pinsquirrel/<name>`
3. Update `pnpm-workspace.yaml` if needed
4. Install dependencies with `pnpm install`

### Inter-package Dependencies

- Reference workspace packages using `workspace:*` protocol
- Example: `"@pinsquirrel/shared": "workspace:*"`

### Turbo Configuration

- All scripts are orchestrated through Turbo
- Commands automatically handle dependency order
- Caching is enabled for builds and tests
- Output directories: `build/**`, `dist/**`

## Hono App (apps/hono)

The main application using Hono + HTMX:

- **Development**: `pnpm dev`
- **Build**: `pnpm build`
- **Start**: `pnpm start`

### Tech Stack

| Component     | Technology   | Purpose                                 |
| ------------- | ------------ | --------------------------------------- |
| Backend       | Hono         | HTTP routing, middleware, JSX templates |
| Interactivity | HTMX         | Partial page updates, form handling     |
| Complex UI    | Vanilla JS   | Dropdowns, tag input autocomplete       |
| Database      | Drizzle ORM  | PostgreSQL database access              |
| Styling       | Tailwind CSS | Utility-first CSS                       |

### Key Characteristics

- Server-rendered JSX templates (not React components)
- HTMX attributes for interactivity (no client-side state management)
- Database sessions stored in PostgreSQL
- Traditional page navigation (no client-side routing)
- Vanilla JS for dropdowns (`dropdown.js`) and tag input (`tag-input-vanilla.js`)

### Running Tests

- `pnpm test --filter @pinsquirrel/hono` - Run all tests once
- `pnpm test --filter @pinsquirrel/hono -- --watch` - Run tests in watch mode for TDD

## Services Library (libs/services)

Business logic services and validation:

- **Development**: `pnpm dev --filter @pinsquirrel/services` (TypeScript watch mode)
- **Build**: `pnpm build --filter @pinsquirrel/services` (creates `dist/`)
- **Type Check**: `pnpm typecheck --filter @pinsquirrel/services`
- **Testing**: Vitest for unit tests

### Services Architecture

- `src/services/` - Business logic services (e.g., AuthenticationService, PinService)
- `src/validation/` - Validation schemas and utilities using Zod
- `src/utils/` - Common utilities like cryptographic functions
- Uses dependency injection and clean architecture principles

### Running Tests

- `pnpm test --filter @pinsquirrel/services` - Run all tests once
- `pnpm test --filter @pinsquirrel/services -- --watch` - Run tests in watch mode for TDD

## Domain Library (libs/domain)

Core domain entities and interfaces:

- **Development**: `pnpm dev --filter @pinsquirrel/domain` (TypeScript watch mode)
- **Testing**: Vitest for unit tests
- Contains domain entities (User, Pin, Tag) and repository interfaces
- Pure domain logic with no external dependencies

## Database Library (libs/database)

Database layer with Drizzle ORM for PostgreSQL:

- **Development**: `pnpm dev --filter @pinsquirrel/database` (TypeScript watch mode)
- **Build**: `pnpm build --filter @pinsquirrel/database` (creates `dist/`)
- **Database Operations**:
  - `pnpm --filter @pinsquirrel/database db:generate` - Generate migrations
  - `pnpm --filter @pinsquirrel/database db:migrate` - Run migrations
  - `pnpm --filter @pinsquirrel/database db:studio` - Open Drizzle Studio

### Database Architecture

- `src/schema/` - Drizzle schema definitions (e.g., users table)
- `src/repositories/` - Repository implementations using Drizzle
- `src/client.ts` - Database connection configuration
- `drizzle.config.ts` - Drizzle kit configuration
- Implements repository interfaces from `@pinsquirrel/domain`

### Database Configuration

- Uses PostgreSQL with connection via `DATABASE_URL` environment variable
- Default: `postgresql://localhost:5432/pinsquirrel`

### Running Tests

- `pnpm test --filter @pinsquirrel/database` - Run all tests once
- `pnpm test --filter @pinsquirrel/database -- --watch` - Run tests in watch mode for TDD

## Code Quality Tools

### ESLint Configuration

- Modern flat ESLint v9 configuration
- TypeScript ESLint with type-aware rules
- Accessibility checks enabled

### Prettier Configuration

- Single quotes
- No semicolons
- 2-space indentation
- Trailing commas in multiline

### Type Checking

- `pnpm typecheck` - Run TypeScript compiler across all packages
- Strict mode enabled in all TypeScript configs

## Package Manager

This repository uses pnpm with version specified in `packageManager` field. Always use pnpm commands, not npm or yarn. Node.js version requirement: >= 22.0.0

## Docker Support

### Development Workflow

For local development with containerized database:

```bash
# Start development database
pnpm db:up

# Run development server (connects to containerized DB)
pnpm dev

# Stop database when done
pnpm db:down
```

### Production Deployment

#### Building Docker Image

```bash
# Build from monorepo root (required for proper build context)
cd /path/to/pinsquirrel
docker build -f apps/hono/Dockerfile -t your-username/pinsquirrel:latest .

# Or use the convenience script (builds and pushes to Docker Hub)
pnpm docker:build-push
```

#### Deployment Options

**Option 1: Self-hosted with Dockge**

- Create your own docker-compose.yml in Dockge
- Reference your published Docker Hub image
- Configure `DATABASE_URL` environment variable

**Option 2: DigitalOcean App Platform**

- Point to repository with `apps/hono/Dockerfile`
- Use managed PostgreSQL database
- Set `DATABASE_URL` environment variable

### Docker Configuration Files

- `docker-compose.dev.yml` - Development database only
- `apps/hono/Dockerfile` - Production-ready app image
- `apps/hono/.dockerignore` - Optimized build context
- `.env.example` - Environment template

### Database Connection

All environments use the `DATABASE_URL` environment variable:

- **Development**: `postgresql://pinsquirrel:pinsquirrel@localhost:5432/pinsquirrel`
- **Docker deployment**: `postgresql://pinsquirrel:pinsquirrel@postgres:5432/pinsquirrel`
- **Managed database**: `postgresql://username:password@hostname:25060/database?sslmode=require`

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide with Docker and migration details
- [STYLE.md](./STYLE.md) - Neo Brutalism UI design system and component patterns
- [README.md](./README.md) - Quick start guide and repository overview
