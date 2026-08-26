# CLAUDE.md

Guidance for Claude Code working in this repository. Anything you can learn from `package.json`,
`turbo.json` or a directory listing is deliberately not repeated here.

## Layering

pnpm/Turbo monorepo: `apps/*` are composition roots and transports, `libs/services` is business
logic, `libs/database` implements the repository interfaces from `libs/domain` (pure, no
dependencies).

**Apps assemble and call services. Services use repositories. Apps do not call repositories.**

`libs/services` is the only layer that enforces `AccessControl` and validation, so a repository
call from an app is an authorization check that did not happen. Every instance of this has
produced a real bug: the REST API listed private pins because it re-decided the rule a transport
at a time, the internal check-url endpoint looked pins up with no `AccessControl` at all, and the
tag merge rules were enforced by the shape of a form rather than by the operation.

A route or middleware that wants data should call a service method. If none fits, add one — that
is the cheaper half of the work.

Two deliberate exceptions, both documented at the point of use:

- `apps/hono/src/middleware/session.ts` — a session is how an `AccessControl` gets built, so
  there is nothing for a service to check, and only this app could ever call it.
- `apps/hono/src/routes/health.ts` — asks whether the connection is alive, which no service
  models.

Composition roots (`apps/hono/src/lib/db.ts`, `apps/admin/src/runtime.ts`) construct
repositories by definition; that is their job.

## Running commands

- pnpm only — never npm or yarn.
- **Always run from the repo root with `pnpm --filter <workspace>`.** Do not `cd` into a
  package.
- `pnpm quality` is the full gate: typecheck + lint + test + format + audit.
- `pnpm format` is a Turbo task and only formats inside packages. `pnpm format:check` is
  `prettier --check .` at the root and covers root files too (`PLAN.md`, `DEPLOYMENT.md`, this
  file). To fix those: `pnpm exec prettier --write <file>`.
- For TDD, leave `pnpm --filter <workspace> test:watch` running.

## Pre-work baseline

**Before starting a task, run `pnpm run audit` on the base branch.** Advisories land against
dependencies that were fine yesterday and have nothing to do with the work at hand. If it fails,
fix it on its own branch first, then rebase. The same goes for any other quality check that is
already red on the base branch.

## TDD

**Add behaviour and fix bugs via Red → Green → Refactor.** The failing test is the spec; a bug
fix without a test that failed first has no proof it addresses the bug.

- **RED**: write the test, watch it fail for the _right_ reason — your assertion, not a typo
  or missing import. If you cannot make it fail, the behaviour already exists or the test
  asserts nothing.
- **GREEN**: the smallest change that passes. Hardcoding is fine; the next RED forces
  generalisation. Never edit the test to make it pass.
- **REFACTOR**: with tests green, restructure freely. If a refactor goes red, revert the
  refactor, not the test. Pure refactors of well-covered code need no new RED.

Commit after each cycle or small batch, not at the end of a session.

## Done means green

**Never mark a task complete, commit, or open a PR until `pnpm quality` passes.** Fix in order:
typecheck → lint → tests → format → audit (bump the package or add a `pnpm.overrides` entry).

## Hono app constraints

- **Server-rendered JSX, not React.** No client-side state or routing. HTMX drives
  interactivity; vanilla JS only where HTMX cannot (`apps/hono/src/static/*.js`).
- CSP is `script-src 'self'`: no inline `<script>`, no `onclick=`.
- Sessions live in MySQL.

## Adding a package

Name it `@pinsquirrel/<name>`, give it the same script names Turbo expects (copy a sibling's
`package.json`), reference siblings with `"workspace:*"`, extend root `tsconfig.base.json`, and
build the ESLint config with `createConfig(import.meta.dirname)` from `eslint.config.base.js`.

## Related documentation

- [PLAN.md](./PLAN.md) — Roadmap, OAuth client runbooks, decision log
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Production Docker deployment, env vars, migrations
- [STYLE.md](./STYLE.md) — Neo Brutalism UI design system
- [README.md](./README.md) — Quick start
