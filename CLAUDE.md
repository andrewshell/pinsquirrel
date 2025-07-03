# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React Router v7 application for managing bookmarks, built with:

- **Framework**: React Router v7 with server-side rendering
- **Database**: SQLite with Drizzle ORM
- **Styling**: TailwindCSS v4 with shadcn/ui components
- **Package Manager**: pnpm
- **Language**: TypeScript

## Architecture

### Database Layer

- **ORM**: Drizzle ORM configured in `drizzle.config.ts`
- **Schema**: Located in `app/db/schema/` with modular table definitions
- **Migrations**: Auto-generated in `app/db/migrations/`
- **Connection**: Database client configured in `app/lib/db.ts`
- **Common Columns**: Reusable column definitions in `app/db/schema/common.ts` (id, createdAt, updatedAt)

### Frontend Architecture

- **Routes**: File-based routing in `app/routes/`
- **Components**: Reusable UI components in `app/components/ui/` (shadcn/ui)
- **Styling**: TailwindCSS with utility classes, global styles in `app/app.css`
- **Type Safety**: Full TypeScript integration with React Router's type generation

### Configuration Files

- `react-router.config.ts`: React Router configuration
- `drizzle.config.ts`: Database schema and migration settings
- `vite.config.ts`: Build tool configuration
- `components.json`: shadcn/ui component configuration

## Development Commands

### Core Development

- `pnpm dev` - Start development server with HMR at http://localhost:5173
- `pnpm build` - Create production build
- `pnpm start` - Start production server from build
- `pnpm typecheck` - Run TypeScript type checking with React Router type generation

### Code Quality

- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting without making changes

### Database Operations

- `pnpm drizzle-kit generate` - Generate new migration files from schema changes
- `pnpm drizzle-kit migrate` - Apply pending migrations to database
- `pnpm drizzle-kit studio` - Open Drizzle Studio for database inspection

## Key Patterns

### Database Schema

- Use `coreColumns()` from `common.ts` for id, createdAt, updatedAt fields
- Follow the modular schema pattern with separate files per table
- Database file location controlled by `DB_FILE_NAME` environment variable

### React Router Patterns

- Use `Route.MetaArgs` for page metadata
- Import types from `+types/[route-name]` for route-specific types
- Components use `~/` path alias for app directory imports

### Component Development

- shadcn/ui components are pre-configured and ready to use
- Follow the existing pattern in `app/components/ui/button.tsx`
- Use TailwindCSS utility classes for styling

## Test-Driven Development (TDD)

This project follows TDD best practices. **Always write tests before implementing features**, even for the smallest changes.

### TDD Workflow

1. **🔴 Red**: Write a failing test that describes the desired behavior
2. **🟢 Green**: Write the minimal code to make the test pass
3. **🔵 Refactor**: Improve the code while keeping tests green
4. **Repeat**: Continue the cycle for each small increment

### Test Coverage Standards

- **Target**: 100% test coverage (or as close as possible)
- **Minimum**: No feature should be considered complete below 95% coverage
- **Check coverage**: Run `pnpm test:coverage` to view coverage reports

### When to Write Tests

Write tests for **every** change, including:

- ✅ **New features** - Write tests describing expected behavior first
- ✅ **Bug fixes** - Write a test that reproduces the bug, then fix it
- ✅ **Refactoring** - Ensure existing tests still pass, add tests for edge cases
- ✅ **API changes** - Update tests to match new interfaces
- ✅ **Database changes** - Test migrations, schema changes, and data operations

### Types of Tests to Write

#### Unit Tests

- Test individual functions and components in isolation
- Mock external dependencies
- Focus on single responsibility

#### Integration Tests

- Test how different parts work together
- Database operations with real test database
- API endpoints with request/response cycles

#### Component Tests

- Test React components with user interactions
- Use `@testing-library/react` for user-centric testing
- Test both happy paths and error states

### Test File Organization

Follow these naming conventions:

- `*.test.ts` - Unit tests for utilities and business logic
- `*.test.tsx` - Component and integration tests
- Place tests alongside the code they test
- Use `test/` directory for complex integration tests

### Example TDD Process

```bash
# 1. Write failing test
echo "// TODO: Test for new feature" > app/lib/new-feature.test.ts
pnpm test new-feature  # Should fail

# 2. Implement minimal code
echo "// Minimal implementation" > app/lib/new-feature.ts
pnpm test new-feature  # Should pass

# 3. Refactor and improve
# Edit both test and implementation
pnpm test new-feature  # Should still pass

# 4. Check coverage
pnpm test:coverage
```

### Coverage Guidelines

- **Functions**: Every function must have tests
- **Branches**: All if/else paths must be tested
- **Components**: Test rendering, user interactions, and edge cases
- **Error handling**: Test both success and failure scenarios
- **Database**: Test CRUD operations, constraints, and migrations

## Quality Assurance Checklist

Before considering any feature complete, **ALWAYS** run these sanity checks in order:

### 1. Code Formatting

```bash
pnpm format
```

- Ensures consistent code style across the project
- Auto-fixes formatting issues with Prettier

### 2. Linting

```bash
pnpm lint
```

- Catches code quality issues and potential bugs
- Enforces project coding standards
- Must pass with zero errors/warnings

### 3. Type Checking

```bash
pnpm typecheck
```

- Validates TypeScript types throughout the project
- Generates React Router types automatically
- Ensures type safety and catches type errors

### 4. Testing

```bash
pnpm test:run
```

- Runs all unit and integration tests
- Must have 100% test pass rate
- Ensures new changes don't break existing functionality

### 4.1. Test Coverage

```bash
pnpm test:coverage
```

- Generates coverage report to verify test completeness
- Must maintain minimum 95% coverage (target: 100%)
- Review coverage report to identify untested code paths

### 5. Build Verification

```bash
pnpm build
```

- Verifies the application builds successfully for production
- Catches build-time errors and missing dependencies

### Additional Checks for Database Changes

If you've modified database schema:

```bash
pnpm drizzle-kit generate  # Generate new migrations
pnpm drizzle-kit migrate   # Apply migrations to test database
```

### Git Status Check

Before committing:

```bash
git status
```

- Ensure no unintended files are being committed
- Verify all necessary files are staged

## ⚠️ Important Notes

- **Always write tests first** - Follow TDD: Red → Green → Refactor
- **Never commit if any check fails** - Fix issues before proceeding
- **Maintain high test coverage** - Minimum 95%, target 100%
- **Run checks frequently** during development, not just at the end
- **Database migrations** should be reviewed carefully before committing
- **Test coverage** should be maintained or improved with new features
- **Environment variables** must be documented in `.env.example` if added
