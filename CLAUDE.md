# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a pnpm monorepo with Turbo orchestration:

- `apps/` - Applications and end-user facing packages
  - `web/` - React Router 7 (Framework mode) application with SSR
  - `api/` - Hono-based TypeScript API server
- `libs/` - Shared libraries and utilities
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
- Use `pnpm --filter @pinsquirrel/api <command>` instead of `cd apps/api && pnpm <command>`

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
Before considering any work "done", **ALL of the following must pass**:

1. **Type Check**: `pnpm typecheck` - Must pass with no errors
2. **Lint**: `pnpm lint` - Must pass with no errors (warnings should be addressed)
3. **Tests**: `pnpm test` - All tests must pass
4. **Format**: `pnpm format` - Code must be properly formatted

Run all checks from the root:
```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format
```

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

## Hono API App (apps/api)

The API app uses Hono framework for high-performance TypeScript APIs:

- **Development**: `pnpm dev --filter @pinsquirrel/api`
- **Build**: Creates production bundle in `dist/`
- **Start**: `pnpm start --filter @pinsquirrel/api` (requires build first)
- **Type Generation**: Supports Hono client type generation
- **Validation**: Uses Zod for request/response validation
- **Logging**: Pino for structured logging

### API Architecture
- `src/index.ts` - Application entry point and server setup
- `src/app.ts` - Main Hono app with middleware configuration
- `src/routes/` - Modular route handlers
- `src/middleware/` - Custom middleware (logging, error handling)
- Environment-based configuration via `process.env`

### API Testing
- `pnpm test --filter @pinsquirrel/api` - Run all tests once
- `pnpm test --filter @pinsquirrel/api -- --watch` - Run tests in watch mode for TDD
- Tests use supertest-like patterns with Hono's test utilities

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