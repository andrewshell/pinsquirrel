# CLAUDE.md

Guidance for Claude Code working in this repository.

## Repository Structure

pnpm monorepo orchestrated with Turbo:

- `apps/hono/` — Hono + HTMX application (main app, dev port 8100)
- `libs/services/` — Business logic and validation (Zod). Dependency-injected services (e.g. `AuthenticationService`, `PinService`)
- `libs/database/` — Drizzle ORM (MySQL) schema and repositories. Implements interfaces from `@pinsquirrel/domain`
- `libs/domain/` — Domain entities (User, Pin, Tag) and repository interfaces. **No external dependencies — pure domain logic**
- `libs/adapters/` — External service adapters
- `libs/mailgun/` — Email service implementation

Workspace packages depend on each other via the `workspace:*` protocol, e.g. `"@pinsquirrel/domain": "workspace:*"`.

## Essential Commands

Root-level (Turbo orchestrates across packages):

| Command                                        | Purpose                                              |
| ---------------------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                                     | Start Hono dev server (port 8100)                    |
| `pnpm build`                                   | Build all packages                                   |
| `pnpm test`                                    | Run all tests                                        |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | Type check / ESLint / Prettier                       |
| `pnpm quality`                                 | All checks: typecheck + lint + test + format + audit |
| `pnpm run audit`                               | `pnpm audit --prod --audit-level=high` (matches CI)  |
| `pnpm db:up` / `pnpm db:down`                  | Start / stop dev MySQL container                     |

Database operations (workspace-scoped):

- `pnpm --filter @pinsquirrel/database db:generate` — generate Drizzle migration
- `pnpm --filter @pinsquirrel/database db:migrate` — run migrations
- `pnpm --filter @pinsquirrel/database db:studio` — open Drizzle Studio

For TDD, run a workspace-scoped test watcher:

```bash
pnpm --filter <workspace> test:watch
```

## Monorepo Command Guidelines

**ALWAYS run commands from the project root using `pnpm --filter <workspace>`.** Do not `cd` into a subdirectory to run commands.

```bash
# Good
pnpm --filter @pinsquirrel/hono build

# Avoid
cd apps/hono && pnpm build
```

## Pre-Work Baseline Check

**Before starting any new task, run `pnpm run audit` on the base branch.**

Audit findings usually come from upstream advisories landing against dependencies that were fine yesterday — they are unrelated to whatever feature or bug you're about to work on. If you discover one mid-task, fixing it pollutes the PR with a dependency bump that has nothing to do with the change.

If the audit fails on the base branch:

1. Stop — do not start the planned work yet.
2. Fix it on its own branch and open a separate PR (typically bumping the offending dependency or adding a `pnpm.overrides` entry).
3. Once that lands, rebase and start the planned work on a clean baseline.

The same principle applies if any other quality check is already broken on the base branch: fix it separately first.

## Test-Driven Development (TDD) Workflow

**ALWAYS write code via the Red → Green → Refactor cycle when adding behavior or fixing bugs.**

Why this matters in practice:

- The failing test is the spec. Writing it first forces you to define "done" before you start typing implementation, which catches vague requirements early.
- Bug fixes need a regression test that fails _before_ the fix. Otherwise you have no proof the fix actually addresses the reported behavior — and no guard against the bug returning.
- Refactoring with green tests is safe; refactoring without them is gambling. The cycle gives you a safety net before you need it.
- Small Red → Green → Refactor loops produce small, reviewable commits. Big-bang implementations produce big-bang PRs.

Start the watcher in the relevant workspace and leave it running:

```bash
pnpm --filter <workspace> test:watch
```

#### 1. RED — Write a failing test first

- Write the test that captures the behavior you want. Be precise about inputs, outputs, and edge cases.
- Run the watcher and confirm the test fails. Read the failure message.
- The failure must be for the _right reason_ — the assertion you wrote, not a typo, missing import, or unrelated crash. A test that fails for the wrong reason is not a real RED.
- If you can't make the test fail at all, the behavior already exists or the test is asserting nothing useful.

#### 2. GREEN — Make the test pass with the minimum change

- Write the simplest code that turns the test green. Hardcoding a return value is fine if that's what the current test demands — the next RED step will force generalization.
- Resist the urge to add features, error handling, or abstractions the current test doesn't require. They belong in a future RED step (with their own test) or not at all.
- Do not modify the test to make it pass. If the test was wrong, go back to RED and rewrite it intentionally.

#### 3. REFACTOR — Improve the design with the safety net on

- This is where design happens. With tests green, restructure freely: extract functions, rename for clarity, collapse duplication, push logic to a better layer.
- Run the watcher continuously. If a refactor turns a test red, **revert the refactor** — don't "fix" the test to match the broken refactor.
- Refactor is optional per cycle. If the GREEN code is already clean, skip straight to the next RED.
- Pure refactors of code that already has solid coverage don't need a new RED step — the existing tests _are_ the safety net.

#### Commit cadence

Commit after each completed cycle (or after a small batch of related cycles), not at the end of a multi-hour session. Small, sequential commits make review easier and bisecting trivial if something breaks later.

## Quality Check Requirements

**NEVER mark any task as complete until ALL quality checks pass!**

Before considering any work "done", **ALL of the following must pass**:

1. **Type Check**: `pnpm typecheck` - Must pass with zero errors
2. **Lint**: `pnpm lint` - Must pass with zero errors (warnings should be addressed)
3. **Tests**: `pnpm test` - All tests must pass (100% success rate)
4. **Format**: `pnpm format` - Code must be properly formatted
5. **Audit**: `pnpm run audit` - No high-severity advisories in production dependencies (matches CI)

**Quick Quality Check Commands:**

```bash
# Single command to run all quality checks:
pnpm quality

# Or run individually:
pnpm typecheck && pnpm lint && pnpm test && pnpm format && pnpm run audit
```

**If ANY check fails:**

- Fix typecheck errors first
- Then fix lint errors
- Then fix test failures
- Then run format
- Finally resolve any audit findings (upgrade the offending package, or add a `pnpm.overrides` entry pinning a safe version)
- Re-run all checks until 100% pass

**Only when ALL checks pass should you:**

- Mark tasks as complete
- Commit changes
- Create pull requests

## Adding a New Package

1. Create directory in `apps/` or `libs/`
2. Add `package.json` named `@pinsquirrel/<name>` with `typecheck`, `lint`, `test`, `format` scripts (matches Turbo task config)
3. Reference workspace siblings via `"workspace:*"` (e.g. `"@pinsquirrel/domain": "workspace:*"`)
4. Run `pnpm install`

Turbo (`turbo.json`) handles task ordering and caching across packages. Build outputs go to `build/**` or `dist/**`.

## Hono App Architecture (apps/hono)

| Component     | Technology   | Purpose                                 |
| ------------- | ------------ | --------------------------------------- |
| Backend       | Hono         | HTTP routing, middleware, JSX templates |
| Interactivity | HTMX         | Partial page updates, form handling     |
| Complex UI    | Vanilla JS   | Dropdowns, tag input autocomplete       |
| Database      | Drizzle ORM  | MySQL via `@pinsquirrel/database`       |
| Styling       | Tailwind CSS | Utility-first CSS                       |

Key constraints:

- **Server-rendered JSX templates, not React components.** No client-side state management or routing.
- HTMX attributes drive interactivity. Vanilla JS only where HTMX is insufficient (`dropdown.js`, `tag-input-vanilla.js`).
- Sessions are stored in MySQL.

## Database

- Connection via `DATABASE_URL`. Local default: `mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel` (started by `pnpm db:up`).
- Schema in `libs/database/src/schema/`, repositories in `libs/database/src/repositories/`, client in `libs/database/src/client.ts`.
- Repositories implement interfaces from `@pinsquirrel/domain`.

## Tooling Notes

- pnpm only — never npm or yarn. Node `>=24.0.0`.
- TypeScript strict mode enabled across all packages.
- ESLint v9 flat config with type-aware rules and accessibility checks.
- Prettier: single quotes, no semicolons, 2-space indent, trailing commas.

## Local Development with Docker

```bash
pnpm db:up    # start MySQL container
pnpm dev      # run app against it
pnpm db:down  # stop
```

For production Docker builds and deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Production deployment with Docker and migrations
- [STYLE.md](./STYLE.md) — Neo Brutalism UI design system
- [README.md](./README.md) — Quick start and overview
