# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a pnpm monorepo with Turbo orchestration:

- `apps/` - Applications and end-user facing packages
  - `web/` - React Router 7 (Framework mode) application with SSR
- `libs/` - Shared libraries and utilities
  - `core/` - Core business logic and domain entities
  - `database/` - Database layer with Drizzle ORM for PostgreSQL
- `pnpm-workspace.yaml` - Defines workspace packages
- `package.json` - Root package with Turbo scripts
- `turbo.json` - Turbo task configuration

## Essential Commands

### Development
- `pnpm dev` - Start development servers across all workspaces
- `pnpm build` - Build all packages
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
- Use `pnpm --filter @pinsquirrel/core <command>` instead of `cd libs/core && pnpm <command>`
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

### 🚨 CRITICAL: Quality Check Requirements

**NEVER mark any task as complete until ALL quality checks pass!**

Before considering any work "done", **ALL of the following must pass**:

1. **Type Check**: `pnpm typecheck` - Must pass with zero errors
2. **Lint**: `pnpm lint` - Must pass with zero errors (warnings should be addressed)
3. **Tests**: `pnpm test` - All tests must pass (100% success rate)
4. **Format**: `pnpm format` - Code must be properly formatted

**💡 Quick Quality Check Commands:**
```bash
# Single command to run all quality checks:
pnpm quality

# Or run individually:
pnpm typecheck && pnpm lint && pnpm test && pnpm format
```

**❌ If ANY check fails:**
- Fix typecheck errors first
- Then fix lint errors  
- Then fix test failures
- Finally run format
- Re-run all checks until 100% pass

**✅ Only when ALL checks pass should you:**
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

## React Router 7 App (apps/web)

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

## Core Library (libs/core)

Business logic and domain entities:

- **Development**: `pnpm dev --filter @pinsquirrel/core` (TypeScript watch mode)
- **Build**: `pnpm build --filter @pinsquirrel/core` (creates `dist/`)
- **Type Check**: `pnpm typecheck --filter @pinsquirrel/core`
- **Testing**: Vitest for unit tests

### Core Architecture
- `src/entities/` - Domain entities and interfaces (e.g., User)
- `src/interfaces/` - Repository contracts and abstractions
- `src/errors/` - Custom domain error classes
- Uses clean architecture principles with dependency inversion

### Running Tests
- `pnpm test --filter @pinsquirrel/core` - Run all tests once
- `pnpm test --filter @pinsquirrel/core -- --watch` - Run tests in watch mode for TDD

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
- Implements repository interfaces from `@pinsquirrel/core`

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

## Agent OS Documentation

### Product Context
- **Mission & Vision:** @.agent-os/product/mission.md
- **Technical Architecture:** @.agent-os/product/tech-stack.md
- **Development Roadmap:** @.agent-os/product/roadmap.md
- **Decision History:** @.agent-os/product/decisions.md

### Development Standards
- **Code Style:** @~/.agent-os/standards/code-style.md
- **Best Practices:** @~/.agent-os/standards/best-practices.md

### Project Management
- **Active Specs:** @.agent-os/specs/
- **Spec Planning:** Use `@~/.agent-os/instructions/create-spec.md`
- **Tasks Execution:** Use `@~/.agent-os/instructions/execute-tasks.md`

## Workflow Instructions

When asked to work on this codebase:

1. **First**, check @.agent-os/product/roadmap.md for current priorities
2. **Then**, follow the appropriate instruction file:
   - For new features: @.agent-os/instructions/create-spec.md
   - For tasks execution: @.agent-os/instructions/execute-tasks.md
3. **Always**, adhere to the standards in the files listed above
4. **🚨 BEFORE marking ANY task complete**: Run ALL quality checks (see Quality Check Requirements above)
   - `pnpm quality` (runs all checks) OR `pnpm typecheck && pnpm lint && pnpm test && pnpm format`
   - ALL must pass with zero errors before task completion

## Important Notes

- Product-specific files in `.agent-os/product/` override any global standards
- User's specific instructions override (or amend) instructions found in `.agent-os/specs/...`
- Always adhere to established patterns, code style, and best practices documented above.