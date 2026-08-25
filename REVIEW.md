# Codebase Review — 2026-08-25 (v3.4.1)

Scope: every package under `apps/` and `libs/`, repo tooling, CI, and docs.
Baseline: `pnpm quality` is fully green (844 tests, 0 lint/type errors, 0 audit
findings) — but see 1.1 and 1.2: two of those gates check less than they appear to.

Overall the codebase is in good shape. The layering rule in CLAUDE.md is real — the
only `@pinsquirrel/database` imports in either app are the composition roots plus the
two documented exceptions — and the auth/rate-limit/private-mode code shows careful
thought. What follows is the mess and the risk, ordered by how much it matters.

## How to read this document

- Every item has an id (`1.4`, `2.17`, `3.2`, …). Use the id in PR titles.
- **[bug]** = user-visible misbehaviour, filed under a refactor heading only because the fix is a refactor.
- **[verified]** = reproduced during this review. Everything else was read from the
  code and should be confirmed with a failing test before fixing (per TDD).
- **Blocked on Qn** = the fix depends on an answer in section 6. Do not start those
  until the maintainer answers; the answer changes what the fix is.
- **After x.y** = do item x.y first; they touch the same code.
- Line numbers are from `main` at v3.4.1 and will drift as items land.

---

## 1. High — fix before new feature work

### Tooling that lies about being green

#### 1.1 **[verified]** — **Done**

- **Where:** `lint` in `apps/hono/package.json:11`; `lint`, `format`, `format:check` in `libs/services`, `libs/domain`, `libs/database` `package.json`
- **Problem:** Unquoted `src/**/*.ts{,x}` is expanded by `/bin/sh`, where `**` means `*`, so only files exactly two levels deep are matched. Hono **lint** covers 49 of 90 files: `src/app.tsx`, `src/index.ts`, and all 39 files under `src/views/` are never linted (hono's `format` is already `prettier --write .`, so they _are_ formatted). `libs/services` misses `src/index.ts`; `libs/domain` misses `src/index.ts` and `src/jsonify.ts`; `libs/database` misses `src/index.ts`, `src/create-repositories.ts`, `src/create-repositories.test.ts`, `src/test-setup.ts`. In `crypto`/`adapters`/`mailgun` the glob matches nothing, so the shell passes it through literally and eslint/prettier expand it correctly — those three are fine. `apps/admin` quotes its glob and is fine.
- **Fix:** Change every `lint` script to `eslint src` and every lib `format`/`format:check` to `prettier --write src` / `prettier --check src` (apps already use `.`). Running `eslint src` across all eight packages today yields exactly one finding (a `no-console` warning at `libs/database/src/test-setup.ts:33`) and `prettier --check src` is clean in every lib, so this is a one-PR change: fix the scripts, fix that warning, done. Include 3.3 (delete `apps/hono/.prettierrc`) in the same PR.

#### 1.2 **[verified]** — **Done**

- **Where:** `package.json` `quality` script; `turbo.json`; `.github/workflows/ci.yml:47`
- **Problem:** The "format" gate is `turbo format` = `prettier --write`, which never fails. All 8 packages already have a `format:check` script, but `turbo.json` has no `format:check` task and nothing runs it. Worse, the 9 files `prettier --check .` currently flags (`.vscode/extensions.json`, `CHANGELOG.md`, `docker-compose.dev.yml`, `libs/adapters/eslint.config.js`, `libs/{adapters,domain,services}/vitest.config.ts`, `pnpm-lock.yaml`, `scripts/README.md`) are all _outside_ every package's `format:check` scope, so wiring `turbo format:check` would still report green. There is no `.prettierignore` anywhere.
- **Fix:** Add a root `.prettierignore` (`pnpm-lock.yaml`, `CHANGELOG.md`, `coverage/`, `dist/`, `build/`, `apps/hono/src/static/styles.css`, `apps/hono/src/static/htmx.min.js`). Add `"format:check": "prettier --check ."` at the **root** and run it in `quality` and CI instead of `turbo format`; keep `turbo format` as the write-mode convenience. Run `prettier --write .` once to clear the remaining flagged files (the ignore list covers two of the nine). **After 1.1** (otherwise the lib `format:check` globs are still wrong).

#### 1.3

- **Where:** `libs/{domain,services,database,crypto,mailgun}/eslint.config.js`
- **Problem:** Plain `recommended`, no type-aware rules, hand-listed Node globals. Only `apps/hono`, `apps/admin` (`recommendedTypeChecked`) and `libs/adapters` (`strictTypeChecked`) are type-aware. `libs/services` — the layer that does all authorization — gets the weakest lint.
- **Fix:** One shared base config (root `eslint.config.base.js` or an `@pinsquirrel/eslint-config` workspace package) exporting the hono/admin config; each package becomes a 3-line file adding its own `ignores`. Update CLAUDE.md's "type-aware rules" sentence in the same PR (4.1 handles the rest of that file). **Blocked on Q9.** Pair with 3.1 (shared tsconfig) in one PR.

### Data integrity

#### 1.4

- **Where:** `libs/database/src/repositories/pin.ts:192-297`
- **Problem:** `create`/`update` do the pin write, the `pins_tags` delete/insert, and `tagRepository.fetchOrCreateByNames` as 3–6 separate statements with no transaction. A mid-way failure leaves a pin with no tags, or with its tag links deleted and not re-added.
- **Fix:** Wrap each in `db.transaction(tx => …)`. The transaction handle must **not** go on the `TagRepository` interface in `libs/domain` (CLAUDE.md: domain has no external deps). Options: (a) narrow `DrizzlePinRepository`'s constructor to take `DrizzleTagRepository` and add a tx-aware method there; (b) move the tag upsert into `DrizzlePinRepository`. **Blocked on Q13. After 1.5.**

#### 1.5 — **Done**

- **Where:** `libs/database/src/repositories/tag.ts:56-108`
- **Problem:** `fetchOrCreateByNames` is SELECT-then-INSERT; two concurrent saves of the same new tag (browser + extension/API) race into a `tags_user_id_name_idx` duplicate-key error.
- **Fix:** `insert … onDuplicateKeyUpdate({ set: { id: sql.raw('id') } })` then re-select by name, or catch `ER_DUP_ENTRY` and re-read. Regression test: two parallel `fetchOrCreateByNames` calls with the same new name both succeed.

#### 1.6

- **Where:** `libs/database/src/schema/users.ts:13`
- **Problem:** No index on `email_hash`, but `findByEmailHash` (`user.ts:41`) runs on every signup and password-reset request — a full table scan that an unauthenticated caller can drive.
- **Fix:** Add an index + migration. A `uniqueIndex` also adds a constraint (one account per email) and the migration fails if duplicates exist today; a plain `index` does not. **Blocked on Q14.**

### Security / correctness in the app

#### 1.7 — **Done**

- **Where:** `libs/services/src/validation/pin.ts:4-7`
- **Problem:** `urlSchema` uses `z.string().url()`, which in zod 4.4.3 accepts `javascript:` and `data:` **[verified]**. The stored URL is rendered as an `href`, so this is stored XSS. `validateUrlForFetching` already restricts to http(s).
- **Fix:** Restrict to `http:`/`https:` in `urlSchema`; regression tests for `javascript:` and `data:` rejected. (The broader zod-4 API migration is 3.12, separate PR.)

#### 1.8 — **Done**

- **Where:** `apps/hono/src/middleware/rate-limit.ts:17-29`
- **Problem:** `getClientIp` takes the _last_ `x-forwarded-for` entry (with a comment explaining why) and falls back to the socket address. The residual hole: a direct, non-proxied caller controls that last entry, so it can rotate it per request and defeat every IP-keyed limiter (sign-in, sign-up, forgot-password). Do **not** "fix" by taking the first entry — that is strictly worse.
- **Fix:** Honor `x-forwarded-for`/`x-real-ip` only when a `TRUST_PROXY` env var is set; keep the last-entry rule in that case; otherwise use the socket address. Document in DEPLOYMENT.md (4.3). **Blocked on Q1.** **PLAN.md:** Phase 6f extends `rate-limit.ts` to `/mcp`, `/api/v1/*`, `/oauth/token`, `/oauth/register` — every one of those inherits this hole, so land it before 6f.

#### 1.9 — **Done**

- **Where:** `apps/hono/src/routes/auth.tsx:106-111`
- **Problem:** Open-redirect check allows `/\evil.com`, which browsers normalise to `//evil.com`.
- **Fix:** Also reject `startsWith('/\\')`, or parse with `new URL(redirectTo, origin)` and require `.origin === origin`. Regression test.

#### 1.10 — **Done**

- **Where:** `apps/hono/src/routes/auth.tsx:396-400`; `apps/hono/src/views/components/Header.tsx:250,388`
- **Problem:** `GET /signout` destroys the session; `csrf()` does not cover GET, so `<img src="/signout">` on any site logs users out.
- **Fix:** Replace the two header links with a POST form (the `/private/lock` button already does this); delete the GET route. **Blocked on Q6.**

#### 1.11

- **Where:** `libs/services/src/services/pin.ts:222-228`; `apps/hono/src/routes/api-v1.ts:185-188`; `apps/hono/src/routes/pin-routes.tsx:126-132`
- **Problem:** `getPublicPin`'s docstring promises private pins are indistinguishable from missing ones, but a pin owned by _another_ user surfaces as `UnauthorizedPinAccessError`, which `api-v1.ts` maps to **401** — confirming the id exists. `pin.test.ts:589` locks this in. HTML routes deliberately return 404 "so ownership stays opaque". MCP (`mapDomainErrorToMcp`) follows the API.
- **Fix:** **PLAN.md:** Phase 6a rewrites the _authentication_ 401 in `mcp/auth.ts`/`api-auth.ts` to carry `WWW-Authenticate`; that is a different 401 from this _authorization_ one — don't conflate them, but coordinate edits to `errorResponse`/`mapDomainErrorToMcp` with whoever does 6a. In `getPublicPin`, map `!canRead` to `PinNotFoundError` (exactly what `TagService.getUserTagById` at `tag.ts:36-42` does); update `pin.test.ts:589`; align `errorResponse` in `api-v1.ts` and `mapDomainErrorToMcp`. **Blocked on Q2. After 2.25** (error constructors change). Touches the same `pin.ts` auth paths as 2.32.

#### 1.12 — **Done (CIDR half); DNS half blocked on Q15**

- **Where:** `libs/services/src/validation/url.ts:41-69`
- **Problem:** SSRF guard is prefix-string matching: blocks all of `172.*` (only `172.16/12` is private) but misses `169.254.*` (cloud metadata), `0.0.0.0`, IPv6 ULA/link-local, `::ffff:`-mapped IPv4, and decimal/hex IP forms.
- **Fix:** Replace with `net.isIP` + a CIDR list. Regression tests for each of the listed forms. This mechanical half is self-contained in `url.ts`. The DNS-resolution half (a hostname that resolves to a private address) needs a custom `lookup` in `NodeHttpFetcher`, is a design decision (**Q15**), and should land **after 2.10** (which also edits that file). **PLAN.md:** Phase 6e (CIMD) has the server fetch an attacker-supplied `client_id` URL — a second, unauthenticated SSRF surface. Both halves should be done and reused by 6e rather than re-decided there; this raises Q15 from "nice to have" to "needed before 6e".

---

## 2. Medium — mess that slows development

### Dead code (verified by grep across `apps/` and `libs/`, tests excluded)

#### 2.1

- **Where:** `libs/services/src/services/user.ts:21-39,67-87`
- **Problem:** `UserService.getUser` and `updateUser` have no callers; `updateUser` passes raw `UpdateUserData` (including `status`, `passwordHash`) to the repo with no validation. `user.test.ts:5` notes they're untested.
- **Fix:** Delete both. **Blocked on Q8.** **PLAN.md:** Phase 6 never references `UserService.getUser`/`updateUser` (verified by grep), which points toward "delete".

#### 2.2 — **Done**

- **Where:** `libs/domain/src/interfaces/repository.ts:3`
- **Problem:** Generic `Repository.findAll` is implemented by four Drizzle repos and called by none; `PinRepository`/`ApiKeyRepository` don't extend it, so the base interface buys nothing.
- **Fix:** Delete `findAll` from the interface and the four implementations. This removes the `findAll` half of 2.35's N+1; `findByStatus` still needs that fix.

#### 2.3 — **Done**

- **Where:** `libs/domain/src/entities/password-reset-token.ts:15-22`, `errors/auth.ts:52`, `errors/pin.ts:53`, `errors/api-key.ts:22`, `errors/validation.ts:27-45`, `index.ts:84`
- **Problem:** Dead exports: `PasswordResetRequest`, `PasswordResetConfirmation`, `ResetTokenNotFoundError`, `DuplicateTagError`, `InvalidApiKeyError`, `ValidationError.addFieldError/hasFieldError/getFieldErrors`, and the `index.ts` re-export of `FieldErrors` (the type itself is live — it types `ValidationError.fields`).
- **Fix:** Delete.

#### 2.4 — **Done**

- **Where:** `libs/database/src/repositories/user.ts:81-100,185-206`; `tag.ts:161-177`
- **Problem:** `UserRepository.list()`, `removeRole()`, `setRoles()` and `TagRepository.list()` are not on any domain interface and have zero callers; both `list()`s re-implement `applyPagination` by hand.
- **Fix:** Delete.

#### 2.5

- **Where:** `libs/database/src/repositories/session.ts` (`deleteExpiredSessions`), `password-reset.ts:111-117` (`deleteExpiredTokens`); interfaces `libs/domain/src/interfaces/session-repository.ts:15`, `password-reset-repository.ts:15`
- **Problem:** Never called, so expired rows accumulate forever; no index on `expires_at` for when a sweep is added.
- **Fix:** **Blocked on Q3.** Either (a) delete both methods from the interfaces and implementations, or (b) add an `expires_at` index + migration and a scheduled sweep (a new service method + a cron/startup job). (b) is a feature, not a deletion — keep it out of the dead-code PR. **PLAN.md:** Phase 6d already commits to a scheduled cleanup of expired/stale `oauth_clients` rows; sessions and reset tokens belong in that same job, which makes (b) the likely answer to Q3 and means the sweep should be designed once, in Phase 6, not twice.

#### 2.6 — **Skipped (Phase 7 deletes ApiKeyService)**

- **Where:** `libs/services/src/services/api-key.ts:117`
- **Problem:** `authenticateByKey` is public but only called by `authenticate` at `:104`.
- **Fix:** Make private; fold its four tests (`api-key.test.ts:248-289`) into the `authenticate` describe block. **PLAN.md:** `ApiKeyService` is deleted wholesale in Phase 7b — skip this unless Phase 7 is more than a few months out.

#### 2.7 — **Done**

- **Where:** `apps/hono/.env.example:21`
- **Problem:** `SESSION_SECRET` documented, never read (sessions are opaque DB ids).
- **Fix:** Delete the line.

#### 2.8 — **Done**

- **Where:** `apps/hono/package.json`; `libs/database/package.json`; root `package.json`
- **Problem:** hono: `mailgun.js` is a direct dep but never imported in `src`; `drizzle-orm` is needed only for a type in `lib/db.ts` and `sql` in `routes/health.ts`. database: `drizzle-kit` is in `dependencies` (only `db:*` scripts use it); `dotenv` never imported. root: `tsx` in `dependencies` is unused there (the per-package `tsx` devDeps in hono/admin/crypto **are** used — leave them).
- **Fix:** Drop hono `mailgun.js`; move `drizzle-kit` to devDependencies; remove `dotenv`; move root `tsx` out. To drop hono's `drizzle-orm`, first add `export { sql } from 'drizzle-orm'` and the client type to `libs/database/src/index.ts` (neither is exported today).
- **Note (when done):** `drizzle-kit` stayed in `dependencies`. `apps/hono/migrate-and-start.sh` runs `db:migrate` inside the runtime image, whose deps come from `pnpm install --prod` — moving it would break production migrations. Everything else in the item landed.

#### 2.9 — **Done**

- **Where:** `bookmarklet.js` (repo root); `apps/hono/.dockerignore`; root `.dockerignore`
- **Problem:** Root `bookmarklet.js` is unreferenced. `apps/hono/.dockerignore` is dead (only the root one applies to `docker build -f apps/hono/Dockerfile .`); root one still mentions `.react-router`.
- **Fix:** Delete root `bookmarklet.js` — it is unreferenced and is a different artifact from the profile bookmarklet _builder_ that 2.21 extracts to `apps/hono/src/static/bookmarklet.js`; do not move it there. delete `apps/hono/.dockerignore`; remove `.react-router`.

### Correctness bugs

#### 2.10 — **Done**

- **Where:** `libs/services/src/services/metadata.ts:30-65`; `libs/adapters/src/node-http-fetcher.ts` (`NodeHttpFetcher`)
- **Problem:** Fetch errors are classified by `message.includes('timeout')` and a regex on `'HTTP (\d+)'`, coupling the service to the adapter's error strings; the outer `catch` then re-checks `instanceof` for errors it just threw.
- **Fix:** Have `NodeHttpFetcher` throw the `FetchTimeoutError`/`HttpError` that already exist in `libs/domain`; delete the string matching and the outer wrapper. Do this **before 1.12's** DNS half, which also edits `NodeHttpFetcher`.

#### 2.11 — **Done**

- **Where:** `apps/hono/src/routes/pin-routes.tsx:93`
- **Problem:** `parseInt('abc', 10)` → `NaN` → `Pagination.fromTotalCount` (`libs/domain/src/entities/pagination.ts:46`) computes a `NaN` offset → 500 on `?page=abc`.
- **Fix:** Validate with `Number.isInteger(n) && n >= 1 ? n : 1`; regression test `GET /pins?page=abc` → 200.

#### 2.12 — **Done**

- **Where:** `libs/database/src/repositories/pin.ts:106-116`
- **Problem:** `search` builds `%${term}%` without escaping `%`/`_`, so a search for `a_c` matches `abc`, and `100%` matches anything containing `100`.
- **Fix:** Escape `%`, `_`, `\` before interpolating; regression test.

#### 2.13 — **Done**

- **Where:** `apps/hono/src/routes/profile.tsx:60,100`
- **Problem:** **[bug]** `update-email`/`change-password` success renders omit `apiKeys`, so the API Keys card shows "No API keys yet" right after a successful change. This route renders success four different ways.
- **Fix:** Use the flash + `redirect('/profile')` pattern `revoke-api-key` already uses for all four intents. **PLAN.md:** Phase 6f adds an OAuth-grants card to this page and Phase 7c removes the API-key intents; the redirect pattern is the right shape for the grants card too, so do this before 6f.
- **Note (when done):** `create-api-key` still renders inline. Its response body _is_ the payload — the raw key is shown once and is never recoverable — so redirecting would mean persisting a live credential in the sessions table to survive the hop. The other three intents redirect, `emailSuccess`/`passwordSuccess` are gone, and `profile.test.tsx` now covers every intent (part of 2.40).

#### 2.14 — **Done**

- **Where:** `apps/hono/src/routes/api-internal.ts:36`; `apps/hono/src/lib/services.ts:78`
- **Problem:** Metadata-fetch failure returns `{ error }` with HTTP 200, so `static/metadata-fetch.js:87` special-cases `!data.error`. `metadataErrorUtils.getHttpStatusForError` exists for exactly this and is never called.
- **Fix:** `return c.json({ error: message }, metadataErrorUtils.getHttpStatusForError(error))`; simplify the JS. (Do not delete `getHttpStatusForError` as dead code.)

#### 2.15 — **Done**

- **Where:** `apps/hono/src/routes/api-internal.ts:64`; `apps/hono/src/views/components/PinForm.tsx:92`
- **Problem:** The duplicate-URL "Edit instead?" link is hard-coded to `/pins/:id/edit`, so a duplicate detected from `/private/pins/new` links out of private mode.
- **Fix:** Add a `baseUrl` prop to `PinForm` (it has none today) and emit it via `hx-vals` on the URL-check request; use it in both places.
- **Note (when done):** `hx-params="url"` on that input filtered the `hx-vals` out — htmx merges vals into the form data _before_ applying `hx-params` — so the existing `exclude` value never reached the server either. Widened to `hx-params="url,exclude,baseUrl"`. The endpoint allowlists `baseUrl` to a plain absolute path, since it is interpolated into an `href` in a hand-built HTML string.

#### 2.16 — **Done**

- **Where:** `apps/hono/src/routes/pin-routes.tsx:512-548`
- **Problem:** `POST /:id/toggle-read` has no `isMissingPin` handling, so a missing/foreign pin 500s while sibling routes 404. It derives the filter query string from `Referer` (`:532-538`) and hard-codes `view: 'expanded'` (`:543`), so a toggle on a compact card comes back expanded. The list uses `?size=`, `delete-confirm`/`card` use `?view=` — three conventions.
- **Fix:** Same `try/isMissingPin` block as siblings; carry `view` and the filter params explicitly on the `hx-post` URL like `delete-confirm` does; drop the `Referer` parsing. Standardise on `?view=`: change the reader at `:57` **and** the six emitters in `views/components/ViewSettings.tsx:196-210`. This changes a user-visible URL — either accept that bookmarked `?size=compact` links fall back to expanded, or keep reading `size` as a deprecated alias for one release.
- **Note (when done):** `size` is still read as a deprecated alias; nothing emits it. `buildDeleteConfirmUrl` in `PinCard.tsx` became `buildCardActionUrl`, which the toggle-read button now uses too.

#### 2.17 — **Done**

- **Where:** `apps/hono/src/routes/auth.tsx:62-65,174-175,256,336-337`; `apps/hono/src/lib/form.ts:4-5`
- **Problem:** Casts `formData.x as string` where other routes guard first (`private.tsx:40-41` uses `typeof`, `import.tsx:71` uses `instanceof File` — leave both). Hono's `parseBody()` without `all` does _not_ produce arrays for repeated keys, but a multipart `File` part named `username` is truthy, passes `username || ''` at `:71`, and throws in `rate-limit.ts:79`'s `.toLowerCase()` → 500. `form.ts:4-5`'s docstring repeats the incorrect "repeated input yields an array" claim.
- **Fix:** Use `getString()` in `auth.tsx` only (applying it to `import.tsx` would break file upload, since `getString` returns `''` for a `File`); fix the `form.ts` docstring.

#### 2.18 — **Done**

- **Where:** `apps/hono/src/app.tsx:47`; inline scripts in `views/layouts/base.tsx:10`, `views/pages/profile.tsx:408`, `views/pages/style-guide.tsx:47`, `views/components/PinForm.tsx:99`, `routes/api-internal.ts:64,68`; `onclick=` in `profile.tsx:258,366`, `views/pages/style-guide.tsx:111`, `views/pages/server-error.tsx:32`. (`views/pages/tag-merge.tsx:80` is `<script type="application/json">` — a data island that is never executed, so `script-src 'self'` does not block it; leave it.)
- **Problem:** `secureHeaders()` ships no CSP because of the inline scripts and handlers.
- **Fix:** Move each inline script to `src/static/*.js` and each `onclick` to a data attribute + listener, then add `script-src 'self'`. **PLAN.md:** the Phase 6d consent page is a new browser page — build it without inline scripts so it doesn't join this list. Multi-PR: **after 2.21** (which moves the profile bookmarklet out) and 3.9 (static JS init consistency).

### Duplication

#### 2.19 — **Done**

- **Where:** `libs/services/src/services/pin.ts:41-50,87-96`, `api-key.ts:37-46` (shape A); `account.ts:72`, `authentication.ts:54,168` (shape B); `tag.ts:77-80` (shape C)
- **Problem:** Zod issues → `ValidationError` conversion exists in three shapes: A maps all issues; B does per-field `safeParse` keeping `issues[0]`; C uses `flatten().fieldErrors` with a custom message.
- **Fix:** One `validationErrorFromZod(error)` helper in `validation/` covering A and C (**PLAN.md:** Phase 6c adds `validation/oauth.ts` — land the helper first so OAuth doesn't become shape D); convert B's call sites to a single `safeParse` on the whole object so they can use it too (behaviour change: all field errors reported, not the first).

#### 2.20 — **Done**

- **Where:** `libs/mailgun/src/email-service.ts:27-178`
- **Problem:** Four methods repeat the same guard / from-line / `messages.create` / `EmailSendError` block (~40 lines each).
- **Fix:** Private `send(to, subject, { html, text }, headers?)` helper.

#### 2.21 — **Done**

- **Where:** `apps/hono/src/views/pages/profile.tsx` (452 lines)
- **Problem:** Five cards plus a 40-line inline bookmarklet script in one component.
- **Fix:** Split into `profile/{AccountCard,EmailForm,PasswordForm,ApiKeysCard,BookmarkletCard}.tsx`; move the bookmarklet builder to `src/static/bookmarklet.js`. Prerequisite for 2.18. **PLAN.md:** Phase 6f adds an OAuth-grants card here and Phase 7c deletes `ApiKeysCard` — splitting first makes both of those one-file changes.

#### 2.22 — **Done**

- **Where:** `apps/hono/src/views/components/Header.tsx` (410 lines); SVG icons also in `PinForm.tsx`, `tag-merge.tsx`, `FilterHeader.tsx`
- **Problem:** Desktop and mobile nav repeat the link list and search form; eight hand-written SVG icons are copy-pasted across four files.
- **Fix:** `views/components/icons.tsx` + a `NavLinks` component rendered twice with a `layout` prop.

#### 2.23

- **Where:** `apps/admin/src/mailer.ts` vs `libs/mailgun/src/email-service.ts`
- **Problem:** Two independent Mailgun clients with different `from` formatting and error mapping; admin has retry/timeout, the lib does not.
- **Fix:** Add `sendBulk`/`sendPlainText` with the retry logic to the shared Mailgun code and have admin use it. Where that code lives is **blocked on Q12** (stays `libs/mailgun`, or merges into an infrastructure package).

#### 2.24 — **Done**

- **Where:** Service tests: `account.test.ts`, `api-key.test.ts`, `user.test.ts`, `authentication.test.ts`; database tests: 57 raw `INSERT INTO` statements
- **Problem:** Four files hand-build the same `UserRepository` `vi.fn()` mock. Database tests bypass the repos under test with raw inserts whose column lists already omit `email_encrypted`/`status` in places.
- **Fix:** Shared `mockUserRepository()` factory; `insertUser/insertPin` fixture helpers (or use the repos' `create`).

### Inconsistency

#### 2.25 — **Done**

- **Where:** `libs/domain/src/errors/pin.ts:15,39,46` (`UnauthorizedPinAccessError`, `TagNotFoundError`, `UnauthorizedTagAccessError`); callers in `libs/services/src/services/pin.ts:26,181,232,251` and `tag.ts:39,69,100,127-178`
- **Problem:** Constructors take an _id_ and template it (`Tag with ID "${id}" not found`), but callers pass full sentences → messages like `Tag with ID "Target tag with ID x not found" not found`.
- **Fix:** Give them `(id: string, message?: string)`; pass ids at the call sites. (`UnauthorizedApiKeyAccessError` takes `(message?)` only — align it to the same signature.) Prerequisite for 1.11.

#### 2.26

- **Where:** `libs/services/src/services/authentication.ts:84,122,143`; `account.ts:161`
- **Problem:** `grantAccess`, `grantAdmin`, `changePassword`, `updateEmail` take a bare `userId` with no `AccessControl`, while `UserService.listByStatus` argues in a comment that services must carry their own authorization.
- **Fix:** Add an `ac: AccessControl` parameter and check `canUpdate`/`hasRole(Admin)` in-service; update `apps/hono` and `apps/admin` callers. **Blocked on Q4.**

#### 2.27

- **Where:** `apps/hono/src/routes/auth.tsx:280`
- **Problem:** `error.message.includes('Too many')` decides on a 429 by string-matching; the rate-limit middleware on `:243` already covers this route.
- **Fix:** Either throw and check a typed `RateLimitedError` from the service, or delete the branch as redundant. **Blocked on Q16.**

#### 2.28

- **Where:** `apps/hono/src/routes/tags.tsx:37`
- **Problem:** `GET /tags` calls `deleteTagsWithNoPins` — a destructive write on a GET that crawlers/prefetch trigger, and which races a concurrent `createPin` between tag insert and link insert.
- **Fix:** Move the cleanup into `TagService`/`PinService` after delete/update, or a scheduled job. **Blocked on Q5.**

#### 2.29

- **Where:** `libs/mailgun/src/types.ts:4` (`MailgunConfig.baseUrl`); `email-service.ts` client construction; `email-service.test.ts:66-69`
- **Problem:** `baseUrl` is typed and tested but the `url:` line in the client constructor is commented out, so an EU-region config silently hits the US API. The test asserts nothing about it.
- **Fix:** Pass `url: config.baseUrl` and make the test assert on it, or delete the field and the test. **Blocked on Q7.**

#### 2.30 — **Done**

- **Where:** `libs/mailgun/src/templates.ts:56,60,153-157,243,331,334`
- **Problem:** `username` (`:153,156,331`), `userEmail` (`:157`), `resetUrl` (`:56,60`), `signinUrl` (`:243`), `signupUrl` (`:334`) are interpolated into HTML bodies unescaped; `:56`, `:243` and `:334` are inside `href="…"`, so a `"` breaks the attribute. `username` is regex-restricted by `usernameSchema`; the rest are not. `resetUrl`/`signinUrl`/`signupUrl` are request-derived (`auth.tsx:185,187,188` build them from `url.origin`), so none is a trusted constant. (`:81,174-177,263,352-354` are plain-text bodies — leave those.)
- **Fix:** Tiny `escapeHtml()` applied in the HTML templates only.

#### 2.31 — **Done**

- **Where:** `apps/hono/src/routes/pin-routes.tsx:392-509`
- **Problem:** `POST /:id/edit` reads the pin up to three times and loads `userTags` before knowing whether it needs them (3 pin reads + 1 tag read on the failure path).
- **Fix:** Fetch the pin once at the top **inside** the existing `try` (moving it out would turn today's 404 at `:442-444` into a 500); reuse it in the `catch`; load `userTags` only in the error branch.

#### 2.32 — **Done**

- **Where:** `libs/services/src/services/pin.ts:276`; `tag.ts:23-29,48-61`
- **Problem:** `pins.filter(ac.canRead)` after a user-scoped query is either a no-op or silently breaks `pagination.totalCount`; the tag list runs a DB query for unauthenticated callers and then filters everything out ("future public tags").
- **Fix:** Guard on `ac.user` up front; drop the post-filters. Same file/paths as 1.11 — land together or sequentially.

#### 2.33

- **Where:** `apps/admin/src/session.ts:14`; `apps/admin/src/app.tsx:166-229`
- **Problem:** In-memory sessions never expire, so an unlocked production private key stays resident until process exit; `POST /login` (which takes real production admin credentials) has no rate limit and its catch-all branch swallows the error without logging; cookie lacks `secure`.
- **Fix:** Session TTL in `getSession`; log the unexpected branch; bind `serve` to `127.0.0.1` in `index.ts` or add rate limiting + `secure`. **Blocked on Q11** (localhost-only decides how much of this matters).

### Performance (all cheap)

#### 2.34 — **Done**

- **Where:** `libs/database/src/schema/pins.ts:31-36`
- **Problem:** Every list is `WHERE user_id=? ORDER BY created_at DESC LIMIT/OFFSET`, but the only index is `(user_id, url_hash)` → filesort of the user's whole pin set per page.
- **Fix:** `index('pins_user_id_created_at_idx').on(table.userId, table.createdAt)` + migration.

#### 2.35 — **Done**

- **Where:** `libs/database/src/repositories/user.ts:63-79`
- **Problem:** `findByStatus` (used by the admin waitlist) and `findAll` call `attachRoles` per user (N+1).
- **Fix:** One `inArray(userRoles.userId, ids)` query grouped in memory, like `getPinTags` in `pin.ts:312`. `findAll` goes away in 2.2.

#### 2.36 — **Done**

- **Where:** `libs/database/src/repositories/tag.ts:273-306`
- **Problem:** `mergeTags` does one SELECT + one INSERT per pin and one SELECT per source tag inside the transaction.
- **Fix:** `INSERT IGNORE … SELECT DISTINCT pin_id, ? FROM pins_tags WHERE tag_id IN (…)` then one `DELETE … WHERE NOT EXISTS`.

#### 2.37

- **Where:** `libs/database/src/repositories/pin.ts:239-297`
- **Problem:** `update` is ~7 round trips: calls `findById` (2 queries) just for `userId`, re-selects the pin, and re-fetches tags via `getPinTags` even when `tagNames` was provided and the result is discarded.
- **Fix:** Select `userId` only; skip `getPinTags` when `tagNames !== undefined`. Fold into the 1.4 transaction rewrite.

### Test gaps

#### 2.38 — **Done**

- **Where:** `libs/services/src/services/pinboard.ts` (206 lines)
- **Problem:** No unit tests; format rules, truncation, backdating, md5 digests are covered only through `apps/hono/src/routes/{import,export}.test.tsx`.
- **Fix:** Service-level tests for each rule.

#### 2.39 — **Done**

- **Where:** `libs/services/src/utils/crypto.test.ts:63-83`
- **Problem:** "Timing-safe" test compares wall-clock of two scrypt calls (< 5×); flaky under load and proves nothing about `timingSafeEqual`.
- **Fix:** Delete it.

#### 2.40 — **Done**

- **Where:** `apps/hono` — `routes/profile.tsx`, `middleware/api-auth.ts`, `bearer-auth.ts`, `private-mode.ts`, `mcp/*`; `pins.test.tsx`
- **Problem:** No route tests for profile intents, the three middlewares (HX-Redirect vs 302), or MCP; no error-path tests for `POST /:id/edit` (validation, duplicate, missing pin) or `toggle-read` on a missing pin.
- **Fix:** Route-level tests using the fakes in `src/test-support/pin-routes.tsx`. Pairs with 2.13, 2.16, 2.31. **PLAN.md:** `api-auth.ts` is deleted in Phase 7a and `bearer-auth.ts`/`mcp/auth.ts` are rewritten in Phase 6a with their own tests (6g) — don't write tests for those three now; the profile, `private-mode.ts`, and pin-route gaps still stand.
- **Note (when done):** The profile intents were covered by 2.13's `profile.test.tsx`. `private-mode.ts` turned out to be covered already — `private.test.tsx` mounts the real middleware, and mutating away either the unlock check or the `HX-Request` branch fails it — so this item added only the pin-route error paths: on both `POST /new` and `POST /:id/edit`, the HTMX-vs-full-page split, the duplicate-URL link to the existing pin, and the generic 500. Verified by mutation; the create-side gaps were found by mutating the create handler while checking the edit ones.

#### 2.41 — **Done**

- **Where:** `apps/admin/src/app.test.tsx`
- **Problem:** `POST /login` failure branches (unknown env, non-admin, bad password), `POST /unlock` (encrypted key, wrong passphrase), `/compose`, `/send` (validation 400, provider 500), `/logout` are untested. The happy-path login is covered via the `signIn()` helper.
- **Fix:** One test per branch.

#### 2.42 — **Done**

- **Where:** `libs/services/src/validation/user.test.ts` (10 of 10), `url.test.ts` (8 of 21)
- **Problem:** Bare `.toThrow()`, so a test passes if _any_ rule rejects.
- **Fix:** Assert the issue message/path.

#### 2.43 — **Done**

- **Where:** `libs/database/src/repositories/tag.test.ts:325`
- **Problem:** `setTimeout(10)` to force `updatedAt` to advance.
- **Fix:** Read the pre-update value from the DB and assert `>`.

---

## 3. Low — housekeeping

#### 3.1

- **Where:** `tsconfig.base.json`; every package `tsconfig.json`
- **Problem:** The base exists but no package extends it. Every package restates all options with drift (`ES2022` vs `ESNext` target; `crypto`/`mailgun` exclude tests from typecheck, others include them; `apps/*` set `declaration` though they never emit).
- **Fix:** `"extends": "../../tsconfig.base.json"` everywhere, keeping each package's current `include`/`exclude` verbatim. Whether tests should be typechecked uniformly is **Q17**. Pair with 1.3.

#### 3.2 — **Done except vitest.config.ts (Q10)**

- **Where:** `turbo.json:12-16`; root `package.json:31`; root `vitest.config.ts`
- **Problem:** `lint`/`format` `dependsOn: ["^lint"]`/`["^format"]` serialises them for no benefit. `"turbo": "latest"` is unpinned. Root `vitest.config.ts` lists 6 projects and omits `libs/crypto` and `apps/admin`.
- **Fix:** Remove the two `dependsOn`; pin `turbo` to `^2.10.10`; glob the vitest projects or delete the root file (**blocked on Q10**).

#### 3.3 — **Done**

- **Where:** `apps/hono/.prettierrc`
- **Problem:** Contains only `semi`/`singleQuote`/`trailingComma`; prettier configs do not cascade, so hono silently loses the root's `arrowParens: "avoid"` and gets the default `"always"`. Deleting it reformats 38 hono files (33 `.ts`/`.tsx` plus five `src/static/*.js`) **[verified]**.
- **Fix:** Delete it and run `prettier --write apps/hono` in the same PR as 1.1/1.2 (large mechanical diff, no logic change).

#### 3.4 — **Done**

- **Where:** `.github/workflows/ci.yml`; root `package.json` lint-staged; `apps/hono/Dockerfile`
- **Problem:** `quality` job runs `pnpm run quality`, which runs the audit that the separate `audit` job already runs. lint-staged has 8 per-package entries; adding a package means editing lint-staged, the Dockerfile's three `COPY` lists, and root `vitest.config.ts`.
- **Fix:** Delete the standalone `audit` job from `ci.yml:10-20` and keep `pnpm run audit` inside the root `quality` script, so CLAUDE.md's Quality Check Requirements stay accurate (dropping it from `quality` instead would need a CLAUDE.md edit). Single lint-staged entry `"**/*.{ts,tsx}": "eslint --fix"` (flat config finds the nearest `eslint.config.js`). `COPY --parents` in the Dockerfile (requires `# syntax=docker/dockerfile:1.7-labs` as the first line; none exists today).
- **Note (when done):** The single entry is `"**/src/**/*.{ts,tsx}"`, not `"**/*.{ts,tsx}"`. Config lookup from the linted file does work under ESLint 10, but the bare glob also hands eslint the five `.ts` files that sit _outside_ any package's `src`: `apps/{hono,admin}/vitest.config.ts` and `apps/hono/tsup.config.ts` fail with `"parserOptions.project" has been provided`, `libs/adapters/vitest.config.ts` with `not found by the project service`, and the root `vitest.config.ts` exits 2 with "couldn't find an eslint.config file" — so a commit touching any of them would be blocked. Scoping to `src` makes lint-staged check exactly what `eslint src` checks, and still needs no edit when a package is added. This also made step 1's `eslint.config.js`/`vitest.config.ts` entries in `libs/adapters/eslint.config.js` `ignores` unnecessary; they are gone. The Dockerfile's third `COPY` list (the runtime stage's per-package `node_modules`) is a deliberate subset, not a manifest list, and was left explicit; `docker build` of every stage was verified locally.

#### 3.5 — **Done**

- **Where:** `libs/database/.gitignore:11`, `vitest.config.ts:17`, `eslint.config.js:33,39`; `drizzle.config.ts:3-15`; `package.json:17`
- **Problem:** `.gitignore`/`vitest.config.ts` still reference `drizzle/` (migrations live in `src/migrations/`); `eslint.config.js` ignores `drizzle/**` and has an override for `src/scripts/**`, which is an empty leftover directory on disk. `drizzle.config.ts` throws on missing `DATABASE_URL` then has an unreachable `||` fallback. `pretest` hardcodes `docker exec pinsquirrel-mysql-1 … || true`, so a differently-named compose project silently skips test-DB creation.
- **Fix:** Update the three configs; `rmdir src/scripts` (untracked, so it will not show in the diff); pick one `DATABASE_URL` behaviour; create the test DB from `docker-compose.dev.yml` init and delete `pretest`.
- **Note (when done):** `drizzle/` became `src/migrations/` in the vitest coverage exclude and the eslint `ignores`, and was dropped from `.gitignore` (migrations are tracked). `drizzle.config.ts` throws with no fallback. The test DB now comes from `scripts/mysql-init/01-create-test-database.sql`, mounted read-only at `/docker-entrypoint-initdb.d`. MySQL runs that only on **first** initialisation of the volume, so a developer with an existing `pinsquirrel_mysql_data` volume that predates this change and never ran `pretest` needs one `docker compose -f docker-compose.dev.yml down -v` — that is the only migration cost. Verified both ways: a from-scratch volume in an isolated compose project (test DB created, writable by the app user, 158 tests green with no `pretest`), and the real `pnpm db:down && pnpm db:up` on the existing volume. CI is unaffected — `ci.yml` creates `pinsquirrel_test` through the service container's `MYSQL_DATABASE`.

#### 3.6 — **Done**

- **Where:** `libs/database/src/repositories/user.ts:38,49,60,70,77,98,123,165`
- **Problem:** Eight `as User` casts hide column/entity drift.
- **Fix:** `mapToUser(row, roles)` like the other repos.
- **Note (when done):** `attachRoles` now takes a row rather than a half-built `User`. `status` goes through an exhaustive `STATUS_BY_COLUMN` record instead of a cast, so the column's enum and `UserStatus` have to keep agreeing.

#### 3.7 — **Skipped (Q12: keep isolation)**

- **Where:** `libs/adapters` (2 classes, 40 lines), `libs/mailgun`
- **Problem:** Each is imported by exactly one file (`apps/hono/src/lib/services.ts`). They earn separate packages only by isolating `cheerio`/`mailgun.js` from the domain. `libs/crypto` (two consumers + a CLI) is a real seam and should stay.
- **Fix:** Merge both into one `libs/infrastructure`, removing two config triples. **Blocked on Q12.** Decide Q12 before 2.23 so the shared Mailgun code is written in its final home.

#### 3.8 — **Done**

- **Where:** `apps/admin/src/app.tsx:35`, `key.ts`, `runtime.ts:20`, `vitest.config.ts`, `app.test.tsx:359-360`
- **Problem:** `config = loadConfig()` at module scope forces `vi.resetModules()` gymnastics in tests; `key.ts` is three one-line wrappers over `@pinsquirrel/crypto`; `runtime.ts` hand-builds `DrizzleUserRepository` while hono uses `createRepositories`; coverage excludes `*.test.ts` but not `*.test.tsx`; duplicated assertion.
- **Fix:** Export `createApp(config)`; inline the crypto calls; use `createRepositories(db).userRepository`; `**/*.test.{ts,tsx}`; delete one assertion.
- **Note (when done):** `key.ts` and `key.test.ts` are gone — `readFileSync` plus `isEncryptedPrivateKey`/`loadPrivateKey` are called directly, and `libs/crypto/src/private-key.test.ts` already covered the round trip the deleted tests repeated. With the config passed in, `app.test.tsx` drops `vi.resetModules()`, the temp config file and the dynamic `@pinsquirrel/domain` re-import; the unlock tests now build an app per key file and run the real key handling against generated fixtures, so only the sealed-email half of `@pinsquirrel/crypto` stays mocked.

#### 3.9 — **Done**

- **Where:** `apps/hono/src/static/tag-select.js:8,244`, `dropdown.js:19,104`; `routes/private.tsx:82`
- **Problem:** `tag-select.js` initialises only on `DOMContentLoaded` while `tag-input-vanilla.js` and `metadata-fetch.js` also hook `htmx:afterSettle`, so a swapped-in tag-select is dead; `dropdown.js` tracks open state via `data-open` in one place and the `hidden` class in another; `private.tsx:82` detects beacons by `Content-Type: text/plain`.
- **Fix:** Shared `onReady(selector, init)` helper used by all three; class-only state; `?beacon=1` query flag from `private-mode.js:7`.

#### 3.10 — **Done**

- **Where:** `apps/hono/src/middleware/session.ts:124-129,204-209`; `routes/import.tsx:64`, `routes/tags.tsx:123`; `libs/services/src/services/pin.ts:258,270`, `tag.ts:151`; `libs/domain/src/entities/pagination.ts:41`; `libs/domain/src/entities/{access,pin,tag}.ts:1-2`
- **Problem:** Cookie options spelled out three times; `...(status ? [status] : [])` where `status ?? 200` works; `ac.user!` right after an `if (!ac.user)` guard; `||` on a number; three domain files import siblings without `.js` while all others use `.js`.
- **Fix:** Mechanical cleanups; one PR.

#### 3.11 — **Done (page-size half; `MAX_KEYS_PER_USER` left to Phase 7b)**

- **Where:** `libs/domain/src/entities/pagination.ts:41-42`, `libs/services/src/services/pin.ts:265-266`, `validation/pin-query.ts:31,38`; `api-key.ts:17` vs `libs/domain/src/errors/api-key.ts:17`
- **Problem:** Page-size constants live in three places; `MAX_KEYS_PER_USER = 5` is hardcoded again as "(5)" in `ApiKeyLimitExceededError`'s message; `pinGetInputSchema` is a raw shape while `tagListInputSchema` is a `z.object` whose consumer calls `.shape` (`apps/hono/src/mcp/server.ts:80`).
- **Fix:** Single exported constants; make both schemas `z.object`. **PLAN.md:** the `MAX_KEYS_PER_USER` half disappears with Phase 7b — only fix the page-size constants and the schema shape.

#### 3.12 — **Done**

- **Where:** `libs/services/src/validation/pin.ts:4-7`, `user.ts:19`, and any other `z.string().url()`/`.email()`
- **Problem:** zod 4 deprecates `z.string().url()`/`.email()` in favour of `z.url()`/`z.email()`.
- **Fix:** Mechanical migration; separate PR from 1.7 so it does not gate the security fix.
- **Note (when done):** Two call sites, both in `libs/services/src/validation` — there were no others. 1.7's http(s) refinement on `urlSchema` is untouched; `z.url()` accepts `javascript:` and `data:` exactly as `z.string().url()` did.

#### 3.13 — **Needs decision: only the maintainer can edit the permission allowlist**

- **Where:** `.claude/settings.local.json`
- **Problem:** Already git-ignored via `*.local.*`, but contains stale `@pinsquirrel/core`/`web` allow rules from the React era.
- **Fix:** Local cleanup, no PR.
- **Note:** The stale entries to drop are the six `@pinsquirrel/core` / `@pinsquirrel/web` `test:coverage`/`test`/`lint` rules, the `DATABASE_URL="postgresql://…:5432/pinsquirrel_test" … db:migrate` rule (the project is MySQL on 3306), the `curl … http://localhost:5173/signin` rule (Vite-era port), and the one-off `node -e "…md5…"` experiment. Everything else is still in use.

---

## 4. Documentation drift

#### 4.1 — **Done**

- **Where:** `CLAUDE.md`
- **Problem:** Repository structure omits `apps/admin` (local operator console, port 8200, `pnpm admin`, config in `admin.config.json`) and `libs/crypto` (email sealing + `keygen` CLI), though line 31 references `apps/admin/src/runtime.ts`. Says "ESLint v9" (v10) and "type-aware rules" (true in 3 of 8 packages until 1.3).
- **Fix:** Add both packages to the structure list; change "v9" to "v10". Leave the "type-aware rules" sentence for 1.3's PR, which is what makes it true.

#### 4.2 — **Done**

- **Where:** `README.md:34,65,69,79-81,97-108,105,123,128,147,155`
- **Problem:** Says PostgreSQL / port 5432 / `postgresql://` (project is MySQL on 3306); Node >= 22 (it's 24); documents `--filter @pinsquirrel/services dev` and `database dev` scripts that don't exist; `pnpm test --filter X` has the arguments in the wrong order; tree omits admin/crypto.
- **Fix:** Sync with `.env.example`, `engines`, and the real scripts; fix argument order to `pnpm --filter X test`.

#### 4.3 — **Done**

- **Where:** `DEPLOYMENT.md:40-45,102-125,190-191`
- **Problem:** Env-var list is `DATABASE_URL`/`PORT` only; omits `MAILGUN_*`, `NOTIFY_EMAIL`, `EMAIL_PUBLIC_KEY`, `LOG_LEVEL`, `NODE_ENV` (which gates the `secure` cookie in `session.ts:127`), and `TRUST_PROXY` once 1.8 lands. Inlined `migrate-and-start.sh` is stale vs the real script (`d85abda`). Says `/health` returns `{"status":"ok"}`; it returns `status/database/uptime/timestamp` and 503 when degraded.
- **Fix:** Env-var table mirroring `apps/hono/.env.example`; link to the script instead of inlining it; document the real health payload and 503.

#### 4.4 — **Done**

- **Where:** `scripts/README.md:111` and "Example Output"
- **Problem:** Example runs the image on port 3000 (app is 8100); the output transcript no longer matches the script.
- **Fix:** Fix the port; delete or regenerate the transcript.

#### 4.5 — **Done**

- **Where:** Root `.env.example`
- **Problem:** Duplicates one variable from `apps/hono/.env.example` and references a `pinsquirrel_dev` DB nothing uses.
- **Fix:** Delete it and point README at `apps/hono/.env.example`.

#### 4.6 — **Done**

- **Where:** `STYLE.md`
- **Problem:** Accurate for hono; admin uses its own inline dark stylesheet (`views.tsx:5-30`).
- **Fix:** One sentence saying admin is intentionally out of scope.

---

## 5. Done well (keep doing this)

- Layering is enforced by code, not just prose; both exceptions explain themselves at the point of use; `create-repositories.ts` has a test asserting the pin/tag dependency.
- `createPinRoutes` collapses the public/private mounts into one implementation with a test-support fake that lets `pins.test.tsx` and `private.test.tsx` be compared line for line.
- Sign-in rate limiting: separate per-account and per-IP limiters, only the account key resets on success, private-unlock keyed on user id with a comment explaining why IP would be wrong.
- Repository tests run against real MySQL with migrations applied; migrations and the final snapshot match the schema exactly, no orphans.
- `responses.ts` anchors wire schemas to domain types via `z.ZodType<Jsonify<T>>`, so entity changes break the build.
- Admin's threat model (key never leaves process memory, recipients recomputed at send time, `AccessControl` rebuilt per request) is thought through and its awkward test setup is commented.
- Comments consistently explain _why_ — `buildConditions` and the pagination-total bug, `pinFilterFromInput` forcing `isPrivate:false`, the `verify-deps-before-run` flag in `migrate-and-start.sh`.

---

## 6. Questions for the maintainer

Each answer unblocks the listed items.

**Q1** — Is the app always deployed behind exactly one trusted reverse proxy? If yes, `TRUST_PROXY` is a config flag; if no, the rate limiters are bypassable today.
_Unblocks: 1.8_

Yes, it's behind Caddy

**Q2** — Should `/api/v1` and MCP return 404 for another user's pin (matching HTML routes and the docstring), or is 401 intended for a future shared-pin feature?
_Unblocks: 1.11_

404 is fine

**Q3** — Is anything meant to sweep expired sessions/reset tokens, or is unbounded growth accepted? (Delete the methods, or build the sweep + index.)
_Unblocks: 2.5_

Should probably sweep old stuff

**Q4** — Should `grantAccess`/`grantAdmin`/`changePassword`/`updateEmail` take an `AccessControl` like the rest of the services, given admin is the only caller of the first two?
_Unblocks: 2.26_

Seems like a good idea

**Q5** — Is the tag cleanup on `GET /tags` intentional cheap GC, or leftover from before `deletePin` handled it?
_Unblocks: 2.28_

Not sure

_Resolved: move the cleanup into `TagService`/`PinService` after delete/update (a write on GET is wrong regardless)._

**Q6** — Is `GET /signout` kept for a client that can't POST (bookmarklet/extension), or removable?
_Unblocks: 1.10_

Remove GET

**Q7** — Was the Mailgun `url:` line commented out deliberately (US-only), or lost in a refactor?
_Unblocks: 2.29_

Not sure

_Resolved: wire `url: config.baseUrl` — it honours what the typed config already promises._

**Q8** — Are `UserService.getUser`/`updateUser` reserved for the Phase 6 OAuth work, or safe to delete now?
_Unblocks: 2.1_

Whatever makes sense

_Resolved: delete (Phase 6 never references them)._

**Q9** — Is the weaker lint config on `services`/`domain`/`database`/`crypto`/`mailgun` deliberate? Unifying on `recommendedTypeChecked` will likely surface findings in the auth layer.
_Unblocks: 1.3_

Not deliberate

**Q10** — Is the root `vitest.config.ts` used by anything (IDE runner), or is Turbo the only test entry point?
_Unblocks: 3.2_

Only turbo

**Q11** — Is `apps/admin` ever reachable off localhost? Decides whether session TTL / `secure` cookie / login rate limit matter or binding to `127.0.0.1` is enough.
_Unblocks: 2.33_

It might be deployed in the future to a custom domain/subdomain

_Resolved: do the full set — session TTL, `secure` cookie under `NODE_ENV=production`, login rate limit, log unexpected errors._

**Q12** — Merge `libs/adapters` + `libs/mailgun` into one infrastructure package, or keep per-dependency isolation?
_Unblocks: 2.23, 3.7_

Keep isolation

_Resolved: 2.23 adds the shared sender to `libs/mailgun`; 3.7 skipped._

**Q13** — For the pin+tag transaction: narrow `DrizzlePinRepository` to depend on `DrizzleTagRepository` (option a), or move the tag upsert into the pin repo (option b)? Both keep `libs/domain` dependency-free.
_Unblocks: 1.4_

Depending on DrizzleTagRepository is fine (already depends on TagRepository)

**Q14** — `email_hash`: unique index (enforces one account per email; migration fails on existing dupes) or plain index?
_Unblocks: 1.6_

Shouldn't be any existing dupes. production only has one user (me)

**Q15** — Do you want DNS-rebinding defence in `NodeHttpFetcher` (custom `lookup` that re-checks the resolved address), or is the CIDR fix in 1.12 enough for now?
_Unblocks: 1.12 (2nd half)_

I don't know what this means

_Explained: an attacker registers `evil.example` with DNS pointing at `169.254.169.254`; the hostname passes every string/CIDR check but the fetch lands on the cloud-metadata endpoint. Defence = re-check the resolved IP inside `NodeHttpFetcher`. Resolved: yes, since Phase 6e fetches attacker-supplied URLs._

**Q16** — `auth.tsx:280`'s `'Too many'` branch: keep a typed rate-limit error distinguishable from the service, or delete the branch since the middleware already returns 429?
_Unblocks: 2.27_

I guess we can delete the branch

**Q17** — Should test files be typechecked in every package? `crypto`/`mailgun` exclude them today; unifying on "yes" may surface type errors across test files.
_Unblocks: 3.1_

Sure, that seems like a good idea

---

## 7. Suggested order of attack

Steps 1, 2, 4 and 9 need no answers at all. Steps 3, 5, 6, 7 and 8 mix blocked and
unblocked items; the unblocked ones can start immediately. Within a step, items
marked **After x.y** wait on that item; no step depends on a later step.

1. **Tooling honesty** — 1.1, 1.2, 3.3 in one PR (script globs, root `format:check` + `.prettierignore`, delete hono `.prettierrc`, one big `prettier --write`). The newly-linted files are already clean apart from one warning (see 1.1).
2. **Docs sync** — 4.1–4.6. Thirty minutes; removes the most day-to-day confusion.
3. **Dead code** — 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9 now; 2.1 after Q8; 2.5 after Q3 (and only if the answer is "delete" — otherwise it's a feature PR).
4. **Correctness bugs and prerequisites** — 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.25, 2.31, each with a regression test. Small independent PRs. (2.10 and 2.25 are here because 1.12 and 1.11 depend on them.)
5. **Security** — 1.7, 1.9, 2.30, 1.12 (CIDR half) now; 1.8 after Q1; 1.10 after Q6; 1.11 after Q2 and 2.25; 1.12 (DNS half) after Q15 and 2.10.
6. **Data integrity** — 1.5 first; then 1.4 (after Q13) with 2.37 folded in; 1.6 after Q14; 2.34, 2.35, 2.36 any time.
7. **Shared tooling config** — 1.3 + 3.1 after Q9/Q17; 3.2 (vitest part after Q10), 3.4, 3.5 any time.
8. **Structural refactors** — 2.19, 2.20, 2.22, 2.24, 2.32 any time; 3.9 then 2.21 then 2.18 (CSP) as a multi-PR sequence; 2.23/3.7 after Q12; 2.26 after Q4; 2.27 after Q16; 2.28 after Q5; 2.29 after Q7; 2.33 after Q11.
9. **Tests and housekeeping** — 2.38–2.43, 3.6, 3.8, 3.10–3.13 opportunistically as files are touched.

---

## 8. Intersections with PLAN.md

PLAN.md (verified 2026-08-17) commits to OAuth 2.1 as the single auth path (Phase 6) and then
deletes the `ps_` API-key path in one diff (Phase 7, gated on 6g). That changes the value of
several items above; each affected item carries a **PLAN.md:** note, summarised here.

**Do before Phase 6 (it builds on them):**

- 1.8 — Phase 6f puts rate limiting on `/mcp`, `/api/v1/*`, `/oauth/token`, `/oauth/register`; all inherit the `x-forwarded-for` hole.
- 1.12 (both halves) + Q15 — Phase 6e fetches attacker-supplied CIMD `client_id` URLs server-side. The SSRF guard and `NodeHttpFetcher` should be hardened once and reused there.
- 2.19 — Phase 6c adds `validation/oauth.ts`; land the shared Zod→`ValidationError` helper first.
- 2.13 and 2.21 — Phase 6f adds an OAuth-grants card to the profile page; the redirect pattern and the per-card split make that a one-file change.
- 2.18's discipline — the Phase 6d consent page should ship with no inline scripts.

**Answer with Phase 6 in mind:**

- Q3 / 2.5 — Phase 6d already plans a scheduled cleanup for `oauth_clients`. Expired sessions and reset tokens belong in the same job; design the sweep once.
- Q8 / 2.1 — nothing in Phase 6 references `UserService.getUser`/`updateUser`.
- 1.11 — Phase 6a changes the _authentication_ 401 (adds `WWW-Authenticate`). The foreign-pin _authorization_ status is a separate question; coordinate the `errorResponse` edits.

**Skip or shrink — Phase 7 deletes the code:**

- 2.6 (`authenticateByKey`) — `ApiKeyService` goes in 7b.
- 2.3's `InvalidApiKeyError` and 2.25's `UnauthorizedApiKeyAccessError` alignment — the `api-key` error types go in 7b; deleting/aligning them now is harmless but wasted.
- 2.40's `api-auth.ts` / `bearer-auth.ts` / `mcp/*` test gaps — 7a deletes `api-auth.ts`; 6a rewrites the other two with tests in 6g.
- 3.11's `MAX_KEYS_PER_USER` duplication — gone in 7b.

**PLAN.md's own drift (not REVIEW.md items, but noticed while reading):** "Key Files to Reuse" still describes `session.ts` as the "pattern for new DrizzleApiKeyRepository" and `crypto.ts` as being "for API key generation"; Decision 9 says `/mcp` uses "the same Bearer token auth as the REST API" while Decision 18 gives them separate resource identifiers. Worth a superseded-marker pass when Phase 6 starts.
