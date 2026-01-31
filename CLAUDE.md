# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a pnpm monorepo with Turbo orchestration:

- `apps/` - Applications and end-user facing packages
  - `web/` - React Router 7 (Framework mode) application with SSR **(being replaced)**
  - `hono/` - Hono + HTMX application **(in development)**
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

- `pnpm dev` - Start React app (port 8100)
- `pnpm dev:hono` - Start Hono app (port 8100)
- `pnpm dev:all` - Start all development servers
- `pnpm build` - Build all packages
- `pnpm build:web` - Build React app only
- `pnpm build:hono` - Build Hono app only
- `pnpm start` - Start React app (production)
- `pnpm start:hono` - Start Hono app (production)
- `pnpm lint` - Run ESLint across all workspaces
- `pnpm format` - Run Prettier formatting across all workspaces
- `pnpm test` - Run tests across all workspaces
- `pnpm typecheck` - Run TypeScript type checking (includes React Router type generation)

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
- Use `pnpm --filter @pinsquirrel/web <command>` instead of `cd apps/web && pnpm <command>`
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
- Output directories: `build/**`, `dist/**`, `.react-router/**`

## React Router 7 App (apps/web) - Being Replaced

The web app uses React Router 7 in Framework mode with SSR enabled:

- **Development**: `pnpm dev --filter @pinsquirrel/web`
- **Build**: Generates both client and server bundles in `build/`
- **Start**: `pnpm start --filter @pinsquirrel/web` (requires build first)
- **TypeScript**: Uses React Router's type generation system
- **Path Aliases**: `~/*` maps to `app/*` directory
- **Styling**: Tailwind CSS v4 with Vite integration
- **Testing**: Vitest with React Testing Library

### React Router 7 Specific Files

- `react-router.config.ts` - Framework configuration
- `app/routes.ts` - Route definitions
- `app/root.tsx` - Root component with document structure
- `.react-router/types/` - Generated TypeScript types

### Running Tests

- `pnpm test --filter @pinsquirrel/web` - Run all tests once
- `pnpm test --filter @pinsquirrel/web -- <pattern>` - Run specific test files
- `pnpm test --filter @pinsquirrel/web -- --watch` - Run tests in watch mode for TDD

## Stack Migration: Hono + HTMX

**STATUS: Active Migration**

We are migrating from React Router 7 to a simpler stack. See `PLAN.md` for full details.

### Why the Migration

- React is overkill for this app's needs (mostly server-rendered forms)
- Simpler stack = less code, easier maintenance
- HTMX handles most interactivity without client-side JavaScript
- Vanilla JS for dropdowns and tag input (no framework needed)

### New Stack

| Component     | Technology           | Purpose                                 |
| ------------- | -------------------- | --------------------------------------- |
| Backend       | Hono                 | HTTP routing, middleware, JSX templates |
| Interactivity | HTMX                 | Partial page updates, form handling     |
| Complex UI    | Vanilla JS           | Dropdowns, tag input autocomplete       |
| Database      | Drizzle (unchanged)  | Same libs, no changes                   |
| Styling       | Tailwind (unchanged) | Same styles                             |

### Parallel Development

Both apps run simultaneously during migration:

- **React app**: `localhost:5173` via `pnpm dev --filter @pinsquirrel/web`
- **Hono app**: `localhost:8100` via `pnpm dev --filter @pinsquirrel/hono`

Both share the same database and libs - no data migration needed.

### Hono App (apps/hono) - In Development

- **Development**: `pnpm dev --filter @pinsquirrel/hono`
- **Build**: `pnpm build --filter @pinsquirrel/hono`
- **Start**: `pnpm start --filter @pinsquirrel/hono`

Key differences from React app:

- Server-rendered JSX templates (not React components)
- HTMX attributes for interactivity (not React state)
- Database sessions stored in PostgreSQL
- No client-side routing - traditional page navigation
- Vanilla JS for dropdowns (`dropdown.js`) and tag input (`tag-input-vanilla.js`)

### Migration Plan Reference

See `PLAN.md` for:

- Detailed phase breakdown (7 phases)
- Task checklists for each feature
- Technical decisions made

### When Working on This Codebase

1. **Check which app you're working on** - most new work should be in `apps/hono`
2. **The React app (`apps/web`) is being deprecated** - only fix critical bugs there
3. **All libs remain shared** - changes to services/database/domain affect both apps
4. **Reference PLAN.md** for current migration status and next tasks

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
- React-specific rules for web app
- Accessibility checks enabled

### Prettier Configuration

- Single quotes
- No semicolons
- 2-space indentation
- Trailing commas in multiline

### Type Checking

- `pnpm typecheck` - Run TypeScript compiler across all packages
- Strict mode enabled in all TypeScript configs
- React Router generates types automatically

## Package Manager

This repository uses pnpm with version specified in `packageManager` field. Always use pnpm commands, not npm or yarn. Node.js version requirement: >= 22.0.0

## Docker Support

### Development Workflow

For local development with containerized database:

```bash
# Start development database
pnpm db:up

# Run development servers (connects to containerized DB)
pnpm dev

# Stop database when done
pnpm db:down
```

### Production Deployment

#### Building Docker Image

```bash
# Build from monorepo root (required for proper build context)
cd /path/to/pinsquirrel
docker build -f apps/web/Dockerfile -t your-username/pinsquirrel-web:latest .

# Push to Docker Hub
docker push your-username/pinsquirrel-web:latest
```

#### Deployment Options

**Option 1: Self-hosted with Dockge**

- Create your own docker-compose.yml in Dockge
- Reference your published Docker Hub image
- Configure `DATABASE_URL` environment variable

**Option 2: DigitalOcean App Platform**

- Point to repository with `apps/web/Dockerfile`
- Use managed PostgreSQL database
- Set `DATABASE_URL` environment variable

### Docker Configuration Files

- `docker-compose.dev.yml` - Development database only
- `apps/web/Dockerfile` - Production-ready web app image
- `apps/web/.dockerignore` - Optimized build context
- `.env.example` / `apps/web/.env.example` - Environment templates

### Database Connection

All environments use the `DATABASE_URL` environment variable:

- **Development**: `postgresql://pinsquirrel:pinsquirrel@localhost:5432/pinsquirrel`
- **Docker deployment**: `postgresql://pinsquirrel:pinsquirrel@postgres:5432/pinsquirrel`
- **Managed database**: `postgresql://username:password@hostname:25060/database?sslmode=require`
