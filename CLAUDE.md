# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a pnpm monorepo with Turbo orchestration:

- `apps/` - Applications and end-user facing packages
  - `web/` - React Router 7 (Framework mode) application
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

### Adding New Packages
1. Create directory in `apps/` or `libs/`
2. Add `package.json` with unique name
3. Install dependencies with `pnpm install`

### Inter-package Dependencies
- Reference workspace packages using `workspace:*` protocol
- Example: `"@repo/ui": "workspace:*"`

### Turbo Configuration
- All scripts are orchestrated through Turbo
- Commands automatically handle dependency order
- Caching is enabled for builds and tests
- React Router 7 outputs cached in `build/**` and `.react-router/**`

## React Router 7 App (apps/web)

The web app uses React Router 7 in Framework mode with SSR enabled:

- **Development**: `pnpm dev --filter @pinsquirrel/web`
- **Build**: Generates both client and server bundles in `build/`
- **Start**: `pnpm start --filter @pinsquirrel/web` (requires build first)
- **TypeScript**: Uses React Router's type generation system
- **Styling**: Tailwind CSS v4 with Vite integration
- **Linting**: ESLint v9 with TypeScript, React, and accessibility rules
- **Formatting**: Prettier with sensible defaults (single quotes, no semicolons)

### React Router 7 Specific Files
- `react-router.config.ts` - Framework configuration
- `app/routes.ts` - Route definitions
- `app/root.tsx` - Root component with document structure
- `.react-router/types/` - Generated TypeScript types

### Code Quality Tools
- `eslint.config.js` - Modern flat ESLint configuration
- `.prettierrc` - Prettier formatting rules
- `.prettierignore` - Files to exclude from formatting
- Run `pnpm lint --filter @pinsquirrel/web` for linting
- Run `pnpm format --filter @pinsquirrel/web` for formatting

## Package Manager

This repository uses pnpm with version specified in `packageManager` field. Always use pnpm commands, not npm or yarn.