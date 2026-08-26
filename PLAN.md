# PinSquirrel API, OAuth & Chrome extension plan

## Overview

A general-purpose REST API, API documentation, an MCP endpoint, OAuth 2.1 as the single
authentication path for both, and a Chrome extension for bookmark syncing.

## Current status (verified 2026-08-25)

> ### Architecture since 2026-08-17, and what Phase 6 now builds on
>
> The 2026-08-25 codebase review (PR #109, ~90 commits; REVIEW.md retired in #112) changed the
> shape of the code Phase 6 slots into. None of it touched the OAuth design, but several of the
> plan's instructions were written against the old shape. They are corrected below. These are the
> rules that matter, each named again at the step it constrains:
>
> 1. **Layering is a rule now, not a habit** (CLAUDE.md "Layering", `fd48f13`). Apps call
>    services. Services call repositories. Apps never call repositories. The MCP and REST auth
>    middleware used to look the user up with `userRepository.findById`; that is gone.
>    `ApiKeyService.authenticate(rawKey)` resolves the token and the account in one service
>    call, and `middleware/bearer-auth.ts` only parses the header. Phase 6d's OAuth middleware
>    gets the same split. Transport parses, `OAuthService` resolves the principal.
> 2. **The database package wires the repositories.** `createRepositories(db)` in
>    `libs/database/src/create-repositories.ts` returns the `Repositories` set, and both
>    composition roots (`apps/hono/src/lib/db.ts`, `apps/admin/src/runtime.ts`) destructure it.
>    New repositories join that factory. Nothing outside the package should `new Drizzle…`.
> 3. **One sweep, one scheduler.** `apps/hono/src/lib/expiry-sweep.ts` runs
>    `MaintenanceService.sweepExpired()` (`libs/services`) hourly. Every OAuth table with an
>    expiry joins that method and its `SweepResult`. There is no second job.
> 4. **CSP is `script-src 'self'`** (`middleware/security-headers.ts`). No inline `<script>`, no
>    `onclick=`. Behaviour lives in `apps/hono/src/static/*.js`, wired with `onReady()`.
> 5. **Outbound fetches go through `NodeHttpFetcher`** (`libs/adapters`). It pins the
>    connection to the address it validated (so DNS rebinding cannot swap it) and re-checks every
>    redirect hop. Callers receive it as the `HttpFetcher` interface;
>    `MetadataService(httpFetcher, htmlParser)` is the pattern. `validateUrlForFetching`
>    (`libs/services/src/validation/url.ts`) is the string-level pre-check.
> 6. **`AccessControl` on every user-scoped operation** (`eb638b4`). Grant listing and
>    revocation take an `ac`, and the grant entity implements `AccessGateable`, exactly as
>    `ApiKeyService.listApiKeys` / `revokeApiKey` do today.
> 7. **One Zod-to-`ValidationError` helper**, `validationErrorFromZod`
>    (`libs/services/src/validation/zod-error.ts`). OAuth endpoints translate that to RFC 6749
>    codes at the route, not in the service.
> 8. **Rate limiting is a reusable pair.** `RateLimiter` (`middleware/rate-limiter.ts`) and
>    `rateLimitByIp()` / `getClientIp()` (`middleware/rate-limit.ts`). `getClientIp` honours
>    forwarding headers only when `TRUST_PROXY` is set (`abda250`). Production sets it.
> 9. **There is no base-URL config yet.** `routes/seo.ts` derives its origin from the request
>    URL. That is fine for a sitemap and wrong for an OAuth issuer, because a spoofed `Host`
>    header must not change what the server claims to be. Phase 6a adds `BASE_URL` (Decision 20).
> 10. **The profile page is one card per file** under `views/pages/profile/` (`e918e5f`).
>     `ApiKeysCard.tsx` and `static/api-key-copy.js` are the whole key UI. 6f adds a sibling card,
>     7c deletes those two files.
>
> The line-number references the 2026-08-17 revision carried (`app.tsx:63`, `api-auth.ts:19`,
> `mcp/auth.ts:17-22`) are replaced below with symbol names. The review moved all of them.

> ### Auth pivot, decided 2026-08-17
>
> **OAuth 2.1 replaces `ps_` API keys outright. There is one auth path, not two.** This reverses
> the 2026-08-16 position (old Decision 12) that the two would coexist, and it supersedes the
> short-lived Decision 18 that kept `/api/v1/*` API-key-only. The reasoning: nothing external
> consumes the REST API yet, so there is no migration cost, and a second live credential type is
> permanent maintenance (its own storage, revocation UI, docs, and dispatch branch) bought for a
> use case that does not exist.
>
> This makes the plan simpler. The dual-credential machinery Phase 6d was carrying (prefix
> dispatch, a discriminated-union auth result, an `allowOAuth` route flag) is deleted rather than
> built. See Decision 12 (rewritten) and Decision 18 (rewritten).
>
> Consequences, worked through below. Phases 1-2 (API key infrastructure and its profile UI) are
> now shipped-then-removed, tracked as new Phase 7. Phase 5 (Chrome extension) authenticates
> via `chrome.identity.launchWebAuthFlow` and therefore now depends on Phase 6. Both `/mcp` and
> `/api/v1` become OAuth protected resources with separate resource identifiers (Decision 18).

**Phases 1-4 are shipped and on `main`.** Verified against the code: `api-keys` schema +
`DrizzleApiKeyRepository`, `ApiKeyService`, profile-page key management UI, `/api/internal/*`,
`/api/v1/{pins,pins/:id,tags,tags/:id/pins}` via `OpenAPIHono`, `/api/openapi.json`, `/api/docs`
(Scalar), and `/mcp` with the three read-only tools (`list_pins`, `get_pin`, `list_tags`).
Phase 7 removes the API-key portions of Phases 1-2. They stay working until OAuth is proven
end-to-end, then come out.

**Phase 6 (OAuth 2.1) is the active next phase and the critical path for everything.**
`/mcp` and `/api/v1/*` both depend on it, and so does Phase 5. The goal for MCP clients is
unchanged. Paste the URL, click consent, connected. No hand-copied key.

**Phase 5 (Chrome extension) is deferred and blocked on Phase 6.** `apps/chrome-extension/`
does not exist, and its auth path is OAuth via `chrome.identity.launchWebAuthFlow` (Decision 19).

Work that landed on `main` after Phase 4, outside this plan's scope (and the reason the
extension stalled): SEO routes (`robots.txt`, `sitemap.xml`, markdown content negotiation),
the early-access waitlist + user lifecycle states, `libs/crypto` (sealed waitlist emails),
`apps/admin` (local-only waitlist reader/mailer), and a long run of dependency/advisory
maintenance. Released as 3.3.0 on 2026-08-13.

Baseline health as of 2026-08-25: `pnpm run audit` is clean on `main`, and the Phase 6 gate is
clear. There is no blocking PR. Since the 2026-08-17 revision: 3.4.0 (2026-08-18, with the
Drizzle v1 release candidate, `createRepositories`, `createEmailSealer`,
`ApiKeyService.authenticate`, the layering rule in CLAUDE.md, and three brute-force fixes around
password checks) and 3.4.1 (production Docker build repaired for pnpm 11); then the review landing
(PR #109) and the two dependabot groups on top of it. `@modelcontextprotocol/sdk` is `^1.30.0`
(1.30.0 resolved) and `@hono/mcp` `^0.3.2`. Phase 6 can branch from `main` as it stands.

### Open follow-ups on the public API

- [ ] Extend rate limiting across the public endpoints. Phase 6 raises the priority, since
      `/oauth/token` and `/oauth/register` are unauthenticated. Folded into Phase 6f.
- [ ] Deferred read-write MCP tools. See Phase 3b-7. Gated on the `pins:write` scope
      from Phase 6, so do Phase 6 first.
- [ ] Remove the API key infrastructure once OAuth is proven. New Phase 7.
- [ ] `MailgunConfig.baseUrl` is honoured by the email service but never set by
      `apps/hono/src/lib/services.ts`. Unrelated to OAuth; only matters if Mailgun EU is ever
      used. Wire a `MAILGUN_BASE_URL` env through when it does.
- [x] ~~Bump `hono-rate-limiter` to `^0.5.3`, handle its `unstorage` peer, and remove the temporary
      `peerDependencyRules` allowance.~~ Resolved 2026-08-17. See Phase 6f for what was actually
      required (much less than this item assumed).

## Status legend

- [ ] Not started
- [~] In progress
- [x] Complete

---

## Phase 1: API key infrastructure (shipped, scheduled for removal)

> Shipped and working, but superseded by the 2026-08-17 auth pivot (Decision 12). Everything
> below stays live until OAuth passes 6g, then comes out in Phase 7. Recorded as built, for
> history. Do not extend it.

### 1a. Domain layer

- [x] Create `libs/domain/src/entities/api-key.ts`
  - `ApiKey` entity (implements `AccessGateable`): id, userId, name, keyHash, keyPrefix (first 8 chars), lastUsedAt, expiresAt, createdAt
  - `CreateApiKeyData` type: userId, name, keyHash, keyPrefix, expiresAt?
- [x] Create `libs/domain/src/interfaces/api-key-repository.ts`
  - `ApiKeyRepository` interface: findById, findByKeyHash, findByUserId, create, updateLastUsed, delete, countByUserId
- [x] Create `libs/domain/src/errors/api-key.ts`
  - `ApiKeyError`, `ApiKeyNotFoundError`, `ApiKeyLimitExceededError`, `InvalidApiKeyError`, `UnauthorizedApiKeyAccessError`
- [x] Update `libs/domain/src/index.ts` to add all new exports

### 1b. Database layer

- [x] Create `libs/database/src/schema/api-keys.ts`
  - Table `api_keys`: id (varchar 36 PK), user_id (FK → users.id, cascade), name (varchar 255), key_hash (varchar 64, unique), key_prefix (varchar 8), last_used_at (timestamp), expires_at (timestamp, nullable), created_at (timestamp)
- [x] Create `libs/database/src/repositories/api-key.ts`
  - `DrizzleApiKeyRepository` implementing `ApiKeyRepository`
  - Follow pattern from `libs/database/src/repositories/session.ts`
- [x] Update `libs/database/src/index.ts` to export `DrizzleApiKeyRepository`
- [x] Generate migration: `pnpm --filter @pinsquirrel/database db:generate`
- [x] Run migration: `pnpm --filter @pinsquirrel/database db:migrate`

### 1c. Service layer

- [x] Create `libs/services/src/validation/api-key.ts`
  - Zod schema: name (1-100 chars, trimmed)
- [x] Create `libs/services/src/services/api-key.ts`
  - `ApiKeyService` constructor: `(apiKeyRepository: ApiKeyRepository)`
  - `createApiKey(ac, {userId, name})`:
    - Validates name with Zod schema
    - Enforces max 5 keys per user (`ApiKeyLimitExceededError`)
    - Generates raw key: `'ps_' + generateSecureToken()` (using `libs/services/src/utils/crypto.ts`)
    - Stores `hashToken(rawKey)` as keyHash, first 8 chars as keyPrefix
    - Returns `{apiKey, rawKey}`. The raw key is shown once only
  - `listApiKeys(ac, userId)`: access control check, return user's keys
  - `revokeApiKey(ac, keyId)`: find key, access control check, delete
  - `authenticateByKey(rawKey)`: hash key → lookup by hash → check expiration → updateLastUsed → return ApiKey or null
  - `authenticate(rawKey)` (added 2026-08-18, `fe3109c`): `authenticateByKey` plus the user
    lookup, returning `{apiKey, user}` or `null`. It exists so the transports stop calling
    `userRepository` themselves, and it is the model for `OAuthService.verifyAccessToken`
- [x] Update `libs/services/src/index.ts` to export `ApiKeyService`
- [x] Write tests for `ApiKeyService`

### 1d. Wiring

- [x] ~~Update `apps/hono/src/lib/db.ts`, instantiate `DrizzleApiKeyRepository`~~ Since
      `3a924eb`, `createRepositories()` in `libs/database` builds the repository and
      `lib/db.ts` only destructures it
- [x] Update `apps/hono/src/lib/services.ts` to instantiate and export `ApiKeyService`
      (now `new ApiKeyService(apiKeyRepository, userRepository)`)

---

## Phase 2: API key management UI (shipped, scheduled for removal)

> Superseded by the 2026-08-17 auth pivot (Decision 12). The OAuth grants list in 6f replaces
> this card; Phase 7c tracks the removal.

- [x] Update `apps/hono/src/routes/profile.tsx`
  - GET: fetch user's API keys via `apiKeyService.listApiKeys()`, pass to view
  - POST `intent=create-api-key`: create key, pass raw key to view as `newApiKey` prop
  - POST `intent=revoke-api-key`: delete key by keyId, flash success message
- [x] Update `apps/hono/src/views/pages/profile.tsx`
  - Add `apiKeys` and `newApiKey` to ProfilePageProps
  - Add "API Keys" card section. Since `e918e5f` this is its own file,
    `views/pages/profile/ApiKeysCard.tsx`, with its copy button in `static/api-key-copy.js`
    (CSP forbids the inline handler it used to have)
  - List existing keys: name, prefix (`ps_abc1...`), created date, last used date, revoke button (form with hidden keyId)
  - Create form: name input + "Create API Key" button
  - New key display: highlighted box with raw key, copy functionality, warning "this key will not be shown again"
- [x] Manual test: create key, see it listed, revoke it

---

## Phase 3: REST API

### 3a. Rename existing internal API

- [x] Rename `apps/hono/src/routes/api.ts` → `apps/hono/src/routes/api-internal.ts`
- [x] Update `apps/hono/src/app.tsx` to mount at `/api/internal` instead of `/api`
- [x] Update frontend JS that calls `/api/metadata` to use `/api/internal/metadata`

### 3b. Auth middleware

> `apiKeyAuth()` and the `X-API-Key` header below are as-built history, superseded by the
> 2026-08-17 auth pivot (Decision 12). Phase 6d adds a standalone OAuth middleware beside them;
> Phase 7a deletes them.

- [x] Update `libs/domain/src/entities/pagination.ts` to add a `totalCount: number` readonly property (stored from `fromTotalCount()` first arg)
- [x] Create `apps/hono/src/middleware/api-auth.ts`
  - `apiKeyAuth()` middleware
  - Checks `Authorization: Bearer <key>` or `X-API-Key: <key>` header
  - ~~Calls `apiKeyService.authenticateByKey(rawKey)` and looks up the user via
    `userRepository.findById(apiKey.userId)`~~ As of `fe3109c`, header parsing lives in
    `middleware/bearer-auth.ts` (`authenticateBearer`), and the token-to-principal step is one
    service call, `apiKeyService.authenticate(rawKey)`. The middleware never touches a repository
  - Sets `apiUser` on Hono context variable map
  - Returns `{ "error": "..." }` with 401 on failure
  - Export `getApiUser(c)` helper

### 3c. API routes

- [x] Create `apps/hono/src/routes/api-v1.ts`
  - Apply `apiKeyAuth()` middleware to all routes

  Endpoints:

  | Method | Path                    | Description      | Service Method                                      |
  | ------ | ----------------------- | ---------------- | --------------------------------------------------- |
  | GET    | `/api/v1/pins`          | List user's pins | `PinService` via findByUserId                       |
  | GET    | `/api/v1/pins/:id`      | Get single pin   | `PinService` via findById                           |
  | GET    | `/api/v1/tags`          | List user's tags | `TagService` via getUserTags/getUserTagsWithCount   |
  | GET    | `/api/v1/tags/:id/pins` | Pins for a tag   | Look up tag name, then `PinService` with tag filter |

  Query params for pin list endpoints:
  - `tag` (string): filter by tag name
  - `search` (string): search URL, title, description
  - `readLater` (boolean)
  - `noTags` (boolean)
  - `sortBy` (`created` | `title`, default `created`)
  - `sortDirection` (`asc` | `desc`, default `desc`)
  - `page` (number, default 1)
  - `pageSize` (number, default 25, max 100)

  Response format:

  ```json
  {
    "data": [
      {
        "id": "...",
        "url": "...",
        "title": "...",
        "description": "...",
        "readLater": false,
        "tags": ["tag1"],
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "totalCount": 87,
      "totalPages": 4,
      "hasNext": true,
      "hasPrevious": false
    }
  }
  ```

  Tags response (with `?withCounts=true`):

  ```json
  {
    "data": [
      {
        "id": "...",
        "name": "javascript",
        "pinCount": 12,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  }
  ```

  Error format: `{ "error": "Human-readable message" }` with the appropriate HTTP status

- [x] Update `apps/hono/src/app.tsx` to mount `app.route('/api/v1', apiV1Routes)`
- [x] Test with curl using a real API key

---

## Phase 3b: MCP endpoints (read-only, shipped)

Implemented with `@hono/mcp` (not `@modelcontextprotocol/hono`). Read-only only. The create, update, and delete tools were deferred on purpose.

### 3b-1. Install dependencies

- [x] Install `@modelcontextprotocol/sdk` and `@hono/mcp` in `@pinsquirrel/hono`

### 3b-2. MCP auth helper

- [x] Create `apps/hono/src/mcp/auth.ts`
  - Extract `Authorization: Bearer <key>` from request (via `authenticateBearer` with
    `allowApiKeyHeader: false`)
  - ~~Call `apiKeyService.authenticateByKey(rawKey)` and look up the user via
    `userRepository.findById`~~ Now `apiKeyService.authenticate(rawKey)`, for the reason given in 3b
  - Build the SDK `AuthInfo` (`token`, `clientId`, `scopes: []`, `extra.user`) or return 401

### 3b-3. MCP server

- [x] Create `apps/hono/src/mcp/server.ts`
  - `McpServer` instance with tools:

  | Tool         | Description                                                 | Service Method                                        | Status       |
  | ------------ | ----------------------------------------------------------- | ----------------------------------------------------- | ------------ |
  | `list_pins`  | List/search pins with filtering & pagination                | `PinService.getUserPinsWithPagination()`              | [x] Shipped  |
  | `get_pin`    | Get a single pin by ID                                      | `PinService.getPin()`                                 | [x] Shipped  |
  | `list_tags`  | List user's tags with optional pin counts                   | `TagService.getUserTags()` / `getUserTagsWithCount()` | [x] Shipped  |
  | `create_pin` | Create a new pin (url, title, description, tags, readLater) | `PinService.createPin()`                              | [ ] Deferred |
  | `update_pin` | Update an existing pin                                      | `PinService.updatePin()`                              | [ ] Deferred |
  | `delete_pin` | Delete a pin by ID                                          | `PinService.deletePin()`                              | [ ] Deferred |
  - Each tool handler gets the authenticated user from `extra.authInfo.extra.user`, creates `AccessControl`, calls service, returns JSON text content
  - Errors go through `mapDomainErrorToMcp()` in `mcp/errors.ts` (`5f44477`), which mirrors the
    REST `errorResponse` helper. Another user's pin or tag reads as "not found" over both REST
    and MCP. The write tools in 3b-7 reuse it rather than growing their own mapping

### 3b-4. MCP route

- [x] Create `apps/hono/src/routes/mcp.ts`
  - Uses `@hono/mcp` `StreamableHTTPTransport` (Streamable HTTP)
  - Applies Bearer token auth from 3b-2
  - Bypasses CSRF and session middleware (API key auth only)

### 3b-5. Mount route

- [x] Update `apps/hono/src/app.tsx`
  - Mounted at `/mcp` before session/CSRF middleware

### 3b-6. Test

- [x] Manual test: configure Claude Code MCP server pointing to `http://localhost:8100/mcp` with `Authorization: Bearer ps_<key>` header
- [x] Verify read-only tools appear and can list pins/tags

### 3b-7. Future: read-write MCP tools (deferred)

- [ ] Add `create_pin`, `update_pin`, `delete_pin` tools when there is a concrete agent use case

Do Phase 6 first. Write tools need a `pins:write` scope so a read-only consent grant can't
mutate data. Introducing the scope step-up flow alongside the initial OAuth work is far easier
than retrofitting it onto tokens that have already been issued.

---

## Phase 4: API docs (OpenAPI + Scalar, shipped)

The approach changed. Instead of a hand-written JSX docs page, the v1 routes were rewritten with `@hono/zod-openapi` to generate an OpenAPI 3.1 spec, served alongside Scalar's interactive API reference UI.

- [x] Migrate `apps/hono/src/routes/api-v1.ts` to `OpenAPIHono` with `createRoute()` definitions and Zod request/response schemas
- [x] Create `apps/hono/src/routes/api-docs.ts`
  - Mounts v1 routes via `api.route('/v1', apiV1Routes)` so paths appear under `/v1/*` in the spec
  - Registers `bearerAuth` and `apiKeyHeader` security schemes
  - Serves OpenAPI spec at `GET /api/openapi.json` (`api.doc31`)
  - Serves Scalar UI at `GET /api/docs`
- [x] Update `apps/hono/src/app.tsx` to mount at `/api` (replaces the direct `/api/v1` mount; api-docs.ts re-mounts v1 internally)
- [x] Verify Scalar page renders and `openapi.json` validates

---

## Phase 5: Chrome extension (deferred, now blocked on Phase 6)

> Nothing in this phase has been started. The v1 REST endpoints it depends on
> (`GET /api/v1/tags`, `GET /api/v1/tags/{id}/pins`) are live and documented at `/api/docs`, so
> the API client can be written against the published OpenAPI spec.
>
> This phase now depends on Phase 6 (changed 2026-08-17). It previously authenticated with a
> pasted `ps_` API key, and the plan argued an OAuth redirect would be worse UX here. Both are
> obsolete. API keys are being removed (Decision 12), and MV3 gives the extension an OAuth path
> that never leaves Chrome, `chrome.identity.launchWebAuthFlow` (Decision 19). Build Phase 6
> first; the extension needs `/api/v1` to be a working OAuth resource before its API client can
> authenticate at all.

### 5a. Scaffold

- [ ] Create `apps/chrome-extension/package.json` (`@pinsquirrel/chrome-extension`)
- [ ] Create `apps/chrome-extension/tsconfig.json`
- [ ] Create `apps/chrome-extension/manifest.json` (Manifest V3)
  - Permissions: `bookmarks`, `storage`, `alarms`, `identity` (required for
    `launchWebAuthFlow`)
  - Service worker: `background.js`
  - Popup: `popup.html`
- [ ] Create `apps/chrome-extension/popup.html`
- [ ] Create build script (esbuild: bundle background.ts + popup.ts)
- [ ] Add icon placeholders

### 5b. OAuth client

- [ ] Create `apps/chrome-extension/src/auth.ts`: authorization-code + PKCE via
      `chrome.identity.launchWebAuthFlow` (Decision 19)
  - Redirect URI is `chrome.identity.getRedirectURL()` →
    `https://<extension-id>.chromiumapp.org/`. That is a fixed HTTPS callback, so none of the
    loopback port-matching grief from Phase 6e applies here
  - Register the extension as a CIMD client if it can host a metadata document, otherwise DCR
  - Generate the PKCE verifier with `crypto.getRandomValues`; `S256` only
  - Request `resource=https://pinsquirrel.com/api/v1` (RFC 8707), not the `/mcp` resource.
    A token minted for `/mcp` must not work here (Decision 18)
  - Request `offline_access` so the service worker can refresh without reopening a browser tab
- [ ] Token storage and refresh
  - Persist tokens in `chrome.storage.local`; never in `chrome.storage.sync` (it replicates
    across a user's machines and is not a secret store)
  - Refresh on `401`, then retry once; on `invalid_grant`, drop the tokens and re-prompt consent
  - Refresh-token rotation is mandatory server-side (Phase 6d). Always persist the new refresh
    token from the response that invalidated the old one, or the next refresh fails

### 5c. API client

- [ ] Create `apps/chrome-extension/src/types.ts` with the shared types (Tag, Pin, Pagination, ExtensionStorage)
- [ ] Create `apps/chrome-extension/src/api-client.ts`
  - `PinSquirrelApiClient` class (baseUrl + a token provider from 5b, not a raw key)
  - `getTags(withCounts?)` → fetch `/api/v1/tags`
  - `getPinsForTag(tagId, page?, pageSize?)` → fetch `/api/v1/tags/:id/pins`
  - `getAllPinsForTag(tagId)` → paginate through all pages

### 5d. Popup UI

- [ ] Create `apps/chrome-extension/src/popup.ts`
  - Settings view (unconfigured): URL input and a "Connect" button that launches the OAuth flow
    (no API key field)
  - Main view (configured): tag checkboxes, "Sync Now" button, last sync time, status,
    "Disconnect". Disconnect revokes the token server-side, then clears local storage
  - Stores config in `chrome.storage.local`:
    `{ baseUrl, accessToken, refreshToken, expiresAt, selectedTagIds, lastSyncAt, lastSyncError }`

### 5e. Bookmark sync

- [ ] Create `apps/chrome-extension/src/bookmark-sync.ts`
  - `findOrCreateFolder(parentId, name)`: find or create a bookmark folder
  - `syncTagFolder(folderId, pins[])`: add missing bookmarks, remove extras, update changed titles
  - `removeOrphanFolders(parentFolderId, activeTagNames[])`: remove folders for deselected tags
  - `syncAll(apiClient, selectedTagIds)`: orchestrates the full sync:
    1. Find/create "PinSquirrel" root folder in bookmark bar
    2. For each selected tag: find/create subfolder, fetch all pins, sync bookmarks
    3. Remove orphan subfolders
    4. Store lastSyncAt

### 5f. Background service worker

- [ ] Create `apps/chrome-extension/src/background.ts`
  - `chrome.runtime.onStartup` → trigger sync
  - `chrome.runtime.onInstalled` → set up alarm for periodic sync (optional)
  - Listen for messages from popup (manual sync trigger)
  - Sync logic calls into `bookmark-sync.ts`

### 5g. Testing

- [ ] Load extension unpacked in Chrome
- [ ] Connect via the OAuth flow: consent screen appears, `launchWebAuthFlow` closes cleanly,
      tokens land in `chrome.storage.local`
- [ ] Select tags, sync, verify bookmark folders created
- [ ] Add/remove pin on website, re-sync, verify bookmarks update
- [ ] Deselect tag, sync, verify folder removed
- [ ] Force an access-token expiry and confirm the service worker refreshes and retries without
      user interaction
- [ ] Revoke the grant from the profile page (Phase 6f) and confirm the extension shows a
      re-consent prompt rather than silently failing forever
- [ ] Confirm a token minted for the `/mcp` resource is rejected by `/api/v1` (Decision 18)

---

## Phase 6: OAuth 2.1 (the only auth path)

> **Resume here.** Nothing started. Goal: a user pastes `https://pinsquirrel.com/mcp` into
> Claude (or any MCP client), clicks through a consent screen, and is connected. No hand-copied
> API key.
>
> This is the critical path for the whole plan (2026-08-17). It used to be an MCP nicety
> layered over a working API-key system. Now it is the only way anything authenticates once
> Phase 7 removes `ps_` keys, and Phase 5 cannot start without it.

> The ground rules from the 2026-08-25 review are listed under "Architecture since 2026-08-17"
> at the top of this document and repeated at the step each one constrains. The short version:
> routes and middleware call `OAuthService` and nothing below it; repositories join
> `createRepositories`; expiry joins `MaintenanceService.sweepExpired`; the consent page and the
> grants card ship no inline script; the CIMD fetch goes through the injected `HttpFetcher`; the
> issuer comes from `BASE_URL`, never from the request.

Where each piece lives (Decision 20, the layering rule applied to OAuth):

| Concern                                                                        | Layer                                             | Why there                                                                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Entities, repository interfaces, RFC 6749 error types                          | `libs/domain`                                     | Pure, no dependencies                                                                                       |
| Tables, Drizzle repositories, `createRepositories` entries                     | `libs/database`                                   | Persistence only                                                                                            |
| PKCE, code/token issuance and rotation, audience check, CIMD resolution, dedup | `libs/services` `OAuthService`                    | The one place `AccessControl` and validation are enforced; testable without HTTP                            |
| URI normalization + loopback-port-agnostic matching                            | `libs/services/src/validation/oauth-uri.ts`       | Pure functions shared by the service (matching, dedup) and the app (metadata documents)                     |
| Header parsing, `WWW-Authenticate`, context variables, consent HTML, form/JSON | `apps/hono` routes + `middleware/oauth-auth.ts`   | Transport. Calls `oauthService.*`; imports nothing from `lib/db.ts`                                         |
| Sweeping expired codes/tokens/incomplete clients                               | `MaintenanceService.sweepExpired` + `SweepResult` | Already scheduled by `lib/expiry-sweep.ts`                                                                  |
| Rate limits on `/oauth/token`, `/oauth/register`                               | `middleware/rate-limit.ts` limiters               | Same `RateLimiter` / `rateLimitByIp` the sign-in routes use                                                 |
| `BASE_URL`                                                                     | env → `apps/hono` config, passed into the service | Issuer/resource identifiers are deployment facts; the service receives them, it does not read `process.env` |

PinSquirrel is its own authorization server, colocated with the resource server. It already has
users, MySQL-backed sessions, and a login UI, so the authorize endpoint is a consent page reusing
`sessionMiddleware()` and the token endpoint mints rows in a table. An external IdP would add a
cross-host discovery problem for no benefit (Decision 13).

Two protected resources, one authorization server (Decision 18). Both `/mcp` and `/api/v1` are
pure OAuth 2.1 resource servers. They validate the bearer token, check the audience, and nothing
else. But they are distinct resources with distinct identifiers and distinct metadata documents:

| Resource URI                     | Served to                    | Metadata document                              |
| -------------------------------- | ---------------------------- | ---------------------------------------------- |
| `https://pinsquirrel.com/mcp`    | Claude and other MCP clients | `/.well-known/oauth-protected-resource/mcp`    |
| `https://pinsquirrel.com/api/v1` | Chrome extension, scripts    | `/.well-known/oauth-protected-resource/api/v1` |

A token minted for one must not be accepted by the other. That is the confused-deputy defense
(Decision 17), and it is why the two identifiers stay separate rather than collapsing to a bare
origin.

Sequencing: build alongside, then cut over. `ps_` keys keep working untouched through all of
Phase 6; nothing dual-dispatches. Write a separate OAuth authentication path, switch each route to
it, verify end-to-end (6g), and only then delete the key path in Phase 7. This is what avoids the
discriminated-union and prefix-dispatch work the plan used to carry. That complexity only existed
to let the two credential types share one code path, and they no longer need to.

Spec basis: MCP authorization spec revision `2025-11-25` (and current draft), which layers OAuth
2.1 + RFC 9728 (Protected Resource Metadata) + RFC 8414 (AS Metadata) + RFC 8707 (Resource
Indicators) + RFC 9207 (`iss`) + CIMD. Anthropic's connector requirements go beyond the spec in
places; those are called out inline below.

### 6a. Discovery (no OAuth yet, prove the handshake)

Ship this first and alone. It is a small diff that makes the failure mode legible. Claude will
find the metadata and then fail at a later, more informative step.

- [ ] Update `apps/hono/src/mcp/auth.ts` so that on auth failure it returns a real `401` with a
      `WWW-Authenticate` header. It currently returns a bare `c.json({ error }, 401)` with no
      header, which is why no client can discover anything.

  ```http
  HTTP/1.1 401 Unauthorized
  WWW-Authenticate: Bearer resource_metadata="https://pinsquirrel.com/.well-known/oauth-protected-resource/mcp",
                           scope="pins:read tags:read"
  ```

  - Must be HTTP `401`, not `200`. Claude ignores `WWW-Authenticate` on a 200
  - Must be an HTTP status, not an MCP tool error. This applies to unauthenticated tool calls
    too, not just the initial connect ("lazy authentication")

- [ ] Give `/api/v1/*` the same treatment, pointing at its own resource metadata document.
      `apiKeyAuth()` in `middleware/api-auth.ts` currently returns a bare `c.json({ error }, 401)`.
      Now that the REST API is an OAuth resource too (Decision 18), it needs a discoverable
      challenge, with `resource_metadata=".../oauth-protected-resource/api/v1"`, not the `/mcp`
      document. Get this wrong and the Chrome extension asks for the wrong audience, so every
      token it obtains is rejected.

- [ ] Derive every issuer and resource URL from a new `BASE_URL` env, not a hardcoded constant and
      not the request (Decision 20). Dev is `http://localhost:8100` (plain HTTP, no local TLS);
      production is `https://pinsquirrel.com`. The documents below show the production values.
  - There is no base-URL config today (verified 2026-08-25). `routes/seo.ts` builds its origin
    from `c.req.url`. That is acceptable for a sitemap but not for an issuer. The value the AS
    signs its identity with must not follow a spoofed `Host` header
  - Add `BASE_URL` to `apps/hono/.env.example` and to the env table in `DEPLOYMENT.md`. Fail at
    boot if it is unset in production; default to `http://localhost:8100` otherwise
  - Read it once in the composition root (`lib/services.ts`) and pass the resulting issuer and
    resource URIs into `OAuthService` and the metadata route. The service never reads
    `process.env`, same as `MailgunEmailService` receiving its config
- [ ] Create `apps/hono/src/routes/oauth-metadata.ts`
  - `GET /.well-known/oauth-protected-resource/mcp` (RFC 9728), the MCP resource
    - `resource` must match the MCP URL exactly as the user types it into Claude, path included.
      Settle on `https://pinsquirrel.com/mcp` and document that string
    - `authorization_servers: ["https://pinsquirrel.com"]`. Claude uses the first entry only and
      never falls back to later ones
    - `scopes_supported: ["pins:read", "tags:read"]`
    - Do not list `offline_access` here. The spec says protected resources SHOULD NOT advertise
      it, because refresh is not a resource requirement. It belongs only in the
      authorization-server document below.
  - `GET /.well-known/oauth-protected-resource/api/v1` (RFC 9728), the REST resource
    - `resource: "https://pinsquirrel.com/api/v1"`, same `authorization_servers`, same
      `scopes_supported`, and likewise no `offline_access`
    - RFC 9728 §3.1 builds the document path by inserting `/.well-known/oauth-protected-resource`
      before the resource's own path, so the resource `…/api/v1` publishes at
      `/.well-known/oauth-protected-resource/api/v1`. Derive both documents from the resource URI
      with one shared helper rather than hand-writing the paths. Getting the transform wrong is
      silent: the client 404s on discovery and gives up.
  - `GET /.well-known/oauth-authorization-server` (RFC 8414):

    ```json
    {
      "issuer": "https://pinsquirrel.com",
      "authorization_endpoint": "https://pinsquirrel.com/oauth/authorize",
      "token_endpoint": "https://pinsquirrel.com/oauth/token",
      "registration_endpoint": "https://pinsquirrel.com/oauth/register",
      "scopes_supported": ["pins:read", "tags:read", "offline_access"],
      "response_types_supported": ["code"],
      "grant_types_supported": ["authorization_code", "refresh_token"],
      "code_challenge_methods_supported": ["S256"],
      "client_id_metadata_document_supported": true,
      "token_endpoint_auth_methods_supported": ["none"],
      "authorization_response_iss_parameter_supported": true
    }
    ```

    Claude selects CIMD only if the metadata advertises both
    `client_id_metadata_document_supported: true` and `"none"` in
    `token_endpoint_auth_methods_supported`, because the CIMD client authenticates as a public
    client. Miss either and it silently falls back to DCR.

    `offline_access` is listed here deliberately. Claude appends it to the authorization request
    only when the authorization-server metadata advertises it. Without it Claude never receives
    a refresh token and the connection dies at the first access-token expiry.

    `token_endpoint_auth_methods_supported` lists only `"none"`. Advertise what is implemented.
    Add `client_secret_post` only alongside the confidential pre-registered client support in
    6e, not before.

- [ ] Mount both `.well-known` routes before session/CSRF middleware in `app.tsx` (next to the
      `app.route('/mcp', mcpRoutes)` line). They must be reachable unauthenticated. Verified
      2026-08-25: nothing currently serves `/.well-known/*`, and the pre-session `seoRoutes` mount
      claims only `/robots.txt` and `/sitemap.xml`, so the path is free. `securityHeaders()` runs
      on `*` ahead of everything, which is fine. CSP does not affect a JSON document.
- [ ] Manual test. A bare `GET` does not exercise the tool-call path, so POST a JSON-RPC body and
      assert the `401` plus the header (note plain `http`, the dev server has no TLS):

  ```sh
  curl -si http://localhost:8100/mcp \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_pins","arguments":{}}}'
  ```

- [ ] Manual test: both metadata documents fetch and parse, and their URLs reflect the local
      base-URL config rather than production

### 6b. Domain + database layer

`libs/domain` has no dependencies and must stay that way: entities, interfaces, and errors only.
Anything that needs `node:net` or a URL parser belongs in `libs/services`.

- [ ] `libs/domain/src/entities/oauth-client.ts`: `OAuthClient` with id, clientId, clientName,
      redirectUris, grantTypes, tokenEndpointAuthMethod, registrationType (`cimd` | `dcr` |
      `static`), metadataUrl (CIMD only), metadataFetchedAt, createdAt
- [ ] `libs/domain/src/entities/oauth-grant.ts`: `AuthorizationCode` (code hash, clientId,
      userId, redirectUri, codeChallenge, scopes, resource, expiresAt, consumedAt) and
      `OAuthToken` (token hash, kind, clientId, userId, scopes, resource, expiresAt, revokedAt,
      rotatedFrom). `OAuthToken` implements `AccessGateable` (`userId` is the gate), so
      `AccessControl.canDelete(token)` decides revocation the way it does for `ApiKey` and `Pin`
- [ ] `libs/domain/src/interfaces/`: repository interfaces for both. Each store with an expiry
      exposes a `deleteExpired…(): Promise<number>` in the shape of
      `SessionRepository.deleteExpiredSessions`, so 6c can add it to the sweep
- [ ] `libs/domain/src/errors/oauth.ts`: error types that map cleanly to RFC 6749 codes
- [ ] `libs/database/src/schema/oauth-*.ts`: tables `oauth_clients`,
      `oauth_authorization_codes`, `oauth_tokens`. Hash codes and tokens at rest, same as
      `api_keys.key_hash` and `sessions`
- [ ] `libs/database/src/repositories/oauth-*.ts`: Drizzle implementations
- [ ] Add all three to `createRepositories()` and the `Repositories` interface in
      `libs/database/src/create-repositories.ts`, and extend the existing
      `create-repositories.test.ts`. `apps/hono/src/lib/db.ts` then just destructures them;
      `apps/admin` picks them up for free and ignores them. Do not `new Drizzle…` in the app
- [ ] Generate + run migration (`drizzle.config` now points at `src/migrations`, `ad41976`)

### 6c. Service layer

- [ ] `libs/services/src/services/oauth.ts`: `OAuthService`
  - Constructor: `(clientRepository, codeRepository, tokenRepository, userRepository,
httpFetcher: HttpFetcher, config: { issuer, resources })`. The fetcher is the domain
    interface, injected exactly as `MetadataService(httpFetcher, htmlParser)` does. The CIMD
    fetch is a service concern (6e), not a route concern, and tests hand it a fake
  - Shape the public methods after the SDK's `OAuthServerProvider` interface
    (`authorize`, `challengeForAuthorizationCode`, `exchangeAuthorizationCode`,
    `exchangeRefreshToken`, `verifyAccessToken`, `revokeToken`) so the mental model matches the
    ecosystem. Do not implement the SDK interface literally; it takes an Express `Response`
    (Decision 14, re-confirmed 2026-08-25 against 1.30.0: `server/auth/router.js` still imports
    `express`)
  - `verifyAccessToken(rawToken, expectedResource)` returns the principal, not just the token:
    `{ token, user, clientId, scopes } | null`, having done the hash lookup, expiry, revocation,
    and audience checks and the `userRepository.findById`. This is the OAuth twin of
    `ApiKeyService.authenticate` and is the reason 6d's middleware needs no repository. A token
    whose user is gone reads as an invalid token, for the same enumeration reason
  - User-facing grant operations take an `AccessControl`: `listGrants(ac, userId)` and
    `revokeGrant(ac, tokenId)`, checked with `ac.canCreateAs` / `ac.canDelete` exactly as
    `ApiKeyService.listApiKeys` / `revokeApiKey`. The token endpoint's own operations (exchange,
    refresh) have no `ac`. The client is the caller, and the code or refresh token is the proof.
    Mirror the `MaintenanceService` comment explaining why when writing it
  - Reuse `libs/services/src/utils/crypto.ts` for token generation and hashing
- [ ] `libs/services/src/validation/oauth.ts`: Zod schemas. Reuse the schemas from
      `@modelcontextprotocol/sdk/shared/auth.js` where they fit; those are framework-agnostic.
      Convert failures with `validationErrorFromZod` (`validation/zod-error.ts`) like every other
      service; the route maps `ValidationError` to `invalid_request` / `invalid_client_metadata`
- [ ] `libs/services/src/validation/oauth-uri.ts`: the one URI normalization rule (scheme/host
      case, default port, trailing slash) and the one loopback canonicalization (drop the port for
      `localhost`, `127.0.0.0/8`, `::1` only). Used by redirect-URI matching (6e), DCR dedup (6d),
      audience comparison (6d), and the app's metadata documents (6a). Pure functions, exported
      from the package index like `pinFilterFromInput`. This is the fiddly part. Give it its own
      tests
- [ ] Extend `MaintenanceService.sweepExpired()` with expired authorization codes, expired and
      revoked tokens, and `oauth_clients` rows that never completed an authorization within their
      TTL. Add the three counts to `SweepResult`; the existing `Promise.all` shape already sweeps
      stores independently. Nothing changes in `apps/hono`; `startExpirySweep` runs it
- [ ] Tests for `OAuthService`

### 6d. Endpoints

- [ ] `apps/hono/src/routes/oauth.tsx`: `GET`/`POST /oauth/authorize`
  - Browser-facing consent page. Mount after `sessionMiddleware()` and `csrf()`, the opposite of
    `/mcp`. Use `requireAuth()` from `middleware/session.ts`; unauthenticated visitors go through
    the existing login flow and return. The `/\evil.com` redirect fix in `89d8983` already
    constrains the return path. Reuse that check, don't write a second
  - The route calls `oauthService.authorize(...)` and renders. It imports from `lib/services`,
    never from `lib/db`. A repository call here would be exactly the layering hole CLAUDE.md
    describes
  - No inline script (CSP). The page is server-rendered JSX. If the approve/deny buttons need any
    behaviour, it goes in `static/oauth-consent.js` wired with `onReady()`. Plain forms need
    nothing
  - Require PKCE `S256`; reject `plain` and reject a missing `code_challenge`
  - Validate and persist the `resource` parameter (RFC 8707)
  - The consent screen shows `client_name` and the redirect URI hostname. The spec requires it,
    and it is the only defense against loopback impersonation by a local process
  - Emit `iss` on the redirect (RFC 9207), success and error alike
- [ ] `apps/hono/src/routes/oauth-token.ts`: `POST /oauth/token`
  - Must parse `application/x-www-form-urlencoded`. Claude sends both the initial exchange and
    refreshes that way; a JSON-only handler returns `415` and the whole flow dies. Note
    `/oauth/register` is `application/json`. Different parser, don't share one
  - Verify PKCE, single-use authorization codes, bind `resource` onto the issued token
  - Rotate refresh tokens. DCR and CIMD both register Claude as a public client, and OAuth 2.1
    requires rotation for those. Return the new refresh token in the same response that
    invalidates the old one
  - Return RFC 6749 codes. `invalid_grant`, never a custom code, on a dead refresh token; Claude's
    recovery keys on it
- [ ] `apps/hono/src/routes/oauth-register.ts`: `POST /oauth/register` (RFC 7591, DCR fallback)
  - Bound the growth. DCR lets an anonymous caller create rows, and Claude registers afresh on
    every new connection. Before shipping the endpoint: a per-IP registration quota (Phase 6f), a
    TTL on `oauth_clients` rows that never completed an authorization, and the cleanup covering
    both expired incomplete registrations and stale completed ones. That cleanup is the
    `MaintenanceService.sweepExpired` extension from 6c, not a new job.
  - Deduplicate on a canonicalized key, not raw metadata equality. Claude Code registers a fresh
    ephemeral loopback port each connection, so byte-equal metadata comparison still yields one
    row per connection, the exact thing dedup is meant to prevent. Build the dedup key by omitting
    the port for loopback hosts only (`localhost`, `127.0.0.0/8`, `::1`), preserving scheme,
    host, and path, and keeping exact-port matching for every non-loopback host. This is the same
    canonicalization the redirect-URI matcher in 6e needs. Write it once and share it.
- [ ] Bypass CSRF for `/oauth/token` and `/oauth/register` (mount before `csrf()` like `/mcp`)
- [ ] Give OAuth access tokens their own prefix, `pso_`. Not for dispatch (there is nothing to
      dispatch between), but so a leaked or logged token is identifiable on sight, and so Phase 7's
      removal can assert no `ps_` value ever reaches the OAuth path.
- [ ] Create a new `apps/hono/src/middleware/oauth-auth.ts`. Do not extend `bearer-auth.ts`. It
      does what `bearer-auth.ts` does and no more: parse `Authorization: Bearer`, call
      `oauthService.verifyAccessToken(raw, expectedResource)`, render the failure as a `401` +
      `WWW-Authenticate`, set the context variables. The hash lookup, expiry, revocation, and
      audience checks live in the service (6c). The middleware imports from `lib/services` only,
      the same split `bearer-auth.ts` documents in its own header comment ("header parsing stays
      here because it is transport").
  - This is the simplification the auth pivot buys. The previous plan had `authenticateBearer`
    dispatch on prefix and return a discriminated union that both `apiKeyAuth()` and `mcpAuth()`
    would narrow, plus an `allowOAuth` flag to keep OAuth off `/api/v1`. None of that gets built.
    One credential type means one code path; a union exists only to let two credential types
    share one function. Leave `bearer-auth.ts` untouched and delete it wholesale in Phase 7.
  - Return the fields `mcpAuth()` needs directly: `token`, `clientId`, `scopes`, `extra.user`
    (the `c.set('auth', …)` block in `mcp/auth.ts`). Populate `scopes` for real, replacing the
    hardcoded `[]`, and set `clientId` to the OAuth client id rather than the user id it is
    today.
  - Note for Phase 7: `ApiAuthVariables` in `middleware/api-auth.ts` declares `apiKey: ApiKey`
    as a non-optional `ContextVariableMap` entry. Nothing reads it. `getApiKey()` has zero call
    sites and `c.get('apiKey')` is never consumed (re-traced 2026-08-25), so the declaration is
    the only thing holding the field alive, and it leaves with the rest of the key path.
- [ ] Switch `/mcp` and `/api/v1/*` over to the new middleware, one route at a time. `ps_` keys
      keep working until Phase 7; there is no single cutover moment.
  - Each route validates the audience against its own resource URI. `/mcp` accepts only tokens
    minted for `https://pinsquirrel.com/mcp`; `/api/v1/*` accepts only
    `https://pinsquirrel.com/api/v1`. Never the issuer `https://pinsquirrel.com`, and never a bare
    origin match. The two resources differ by exactly the path component RFC 8707 makes
    significant, so an origin-only check would let an `/mcp` token drive the REST API. Make the
    expected resource a parameter of the middleware so neither route can inherit the other's.
  - One URI normalization rule, shared everywhere: metadata generation, the `resource` parameter
    on authorization and token requests, token issuance, and this audience check. Divergent
    normalization (trailing slash, case, default port) produces audience failures that look like
    random connection breakage.
  - `X-API-Key` disappears entirely. It was the API-key-only header, and there are no API keys.
    `Authorization: Bearer` is the only accepted credential form. Drop `apiKeyHeader` from the
    OpenAPI security schemes in `routes/api-docs.ts` at the same time.
- [ ] Tests: OAuth token succeeds on its own resource; an `/mcp` token is rejected by `/api/v1`
      and vice versa; expired token rejected; revoked token rejected; `X-API-Key` rejected
      everywhere
- [ ] Populate `scopes` in the `AuthInfo` object (currently hardcoded `[]` in `mcpAuth()`)

### 6e. Client registration (CIMD-first)

- [ ] CIMD resolution: when `client_id` is an HTTPS URL, fetch it, validate the document's
      `client_id` matches the URL exactly, validate `redirect_uris`, cache respecting HTTP cache
      headers
  - SSRF guard required. This is a server-side fetch of a caller-supplied URL, and most of the
    guard already exists (`ebbffa3`, `4c3fedc`, `718ae26`). Reuse it; do not write a second
    fetcher:
    - `NodeHttpFetcher` (`libs/adapters`) installs a `lookup` on its undici `Agent` that checks
      every resolved address against `isBlockedIpAddress` (`libs/domain`: private, loopback,
      link-local, CGNAT, IPv6-mapped, by CIDR) and fails the connect if any is blocked. The check
      happens at connect time, so DNS rebinding and validate-then-fetch races are already closed.
      Each redirect hop connects through the same dispatcher, so a 302 to `169.254.169.254` is
      refused too. It has a 10s overall timeout and reports refusals as `InvalidUrlError`
    - `validateUrlForFetching` (`libs/services/src/validation/url.ts`) is the string-level
      pre-check (literal IPs, `localhost`, `.local`). Run it first so an obviously bad URL never
      reaches DNS
    - `OAuthService` receives the fetcher as the `HttpFetcher` interface (6c). `fetch()` returns
      the body as text; the service parses JSON and validates it with the CIMD Zod schema
    - What is still missing for CIMD belongs in the service, not a new adapter: require `https`
      and a non-empty path on the `client_id` (`validateUrlForFetching` allows `http`); a
      response size cap (the fetcher has none; CIMD documents are small, so a low cap is fine);
      and, if redirects are to be allowed at all, a hop cap. Simplest is to refuse redirects for
      CIMD entirely. A metadata URL that redirects is a misconfigured client
  - Tests: unit-test the service against a fake `HttpFetcher`. The adapter already has its own
    rebinding and redirect tests in `node-http-fetcher.test.ts`; do not duplicate them. Cover
    `http` scheme rejected, missing path rejected, oversized response, `client_id` mismatch
    between URL and document, invalid `redirect_uris`
- [ ] Redirect URI matching, the bug-prone part. Two shapes:
  - Hosted Claude (web, Desktop, mobile, Cowork): exact match on
    `https://claude.ai/api/mcp/auth_callback`
  - Claude Code: native client, RFC 8252 loopback on an ephemeral port. It declares portless
    `http://localhost/callback` and `http://127.0.0.1/callback` in its CIMD
    (`https://claude.ai/oauth/claude-code-client-metadata`), so matching must ignore the port
    for loopback hosts. RFC 8252 §7.3 requires this for `127.0.0.1`; apply the same to
    `localhost` or Claude Code cannot connect. Claude Code issue #37747 (closed 2026-05-24) was a
    regression in exactly this interaction. It's fixed upstream, cited here only as evidence
    that the portless-CIMD path is easy to get wrong on both sides. Test against the real client,
    not just a unit test
- [ ] DCR as fallback for clients that don't do CIMD. Prefer CIMD: DCR is deprecated in the spec
      and makes Claude register a new client row on every fresh connection (Decision 15)
- [ ] Support pre-registered static credentials, so an org can paste its own `client_id` when
      adding PinSquirrel as a custom connector

### 6f. Rate limiting and hardening

Folded in from the standing follow-up. Phase 6 raises the priority, since `/oauth/token` and
`/oauth/register` are unauthenticated endpoints.

- [ ] Extend `rate-limit.ts` coverage to `/mcp`, `/api/v1/*`, `/oauth/token`, `/oauth/register`.
      Today it is wired into `routes/auth.tsx` and `routes/private.tsx` (verified 2026-08-25).
  - Add limiters next to the existing ones (`signupLimiter`, `forgotPasswordLimiter`, …) and
    apply them with `rateLimitByIp(limiter, message)`, which answers `429` with `Retry-After`.
    `/oauth/token` additionally keys a limiter on `client_id`, since a public client's IP proves
    little
  - `getClientIp` only trusts `x-forwarded-for` when `TRUST_PROXY` is set (`abda250`), and
    production sets it (`DEPLOYMENT.md`). Nothing to do here, but the limits are meaningless in
    a deployment that forgets it
  - The limiter is in-process memory. Fine for one instance. Note it in `DEPLOYMENT.md` as the
    thing to replace if a second instance ever runs
- [x] ~~Bump `hono-rate-limiter` to `^0.5.3`, handle its `unstorage` peer, remove the temporary
      `peerDependencyRules` allowance.~~ Done 2026-08-17. All three clauses turned out to be stale
      or already satisfied, and none of it was Phase 6 work:
  - The bump was already satisfied transitively. `hono-rate-limiter` is not a direct dependency.
    It arrives as a peer of `@hono/mcp@0.3.1`, which declares `^0.5.3`, and 0.5.3 is what the
    lockfile resolves.
  - The `unstorage` peer needs no handling: `hono-rate-limiter@0.5.3` marks it `optional: true`
    in `peerDependenciesMeta`.
  - The `peerDependencyRules` allowance (relocated into `pnpm-workspace.yaml` by #80) had gone
    inert. It permitted `0.4.2`, a version nothing requests. Removed in its own PR after
    confirming a forced full re-resolve produced a zero-line lockfile diff and no peer warnings.
- [ ] Latency budget. Claude waits 10s for discovery/register/token and 30s for refresh, then
      treats the flow as failed. Don't buffer the response behind slow downstream work
- [ ] Profile page: list and revoke active OAuth grants. This lands next to the API key section
      for now and replaces it in Phase 7. Users need a working revocation UI before the key UI is
      removed, not after
  - New file `views/pages/profile/OAuthGrantsCard.tsx` plus one line in `views/pages/profile.tsx`.
    The page is a stack of independent cards (`e918e5f`), and `ApiKeysCard.tsx` is the template
  - `routes/profile.tsx` gains a `revoke-oauth-grant` intent calling
    `oauthService.revokeGrant(ac, tokenId)`, flash + redirect like `revoke-api-key`
  - No inline script (CSP). A grants list needs none. If a confirm step is wanted, it is a
    `static/*.js` file with `onReady()`
- [ ] Anthropic egresses from `160.79.104.0/21`. Note it in DEPLOYMENT.md if a WAF ever lands

### 6g. Testing

This is the cutover gate. Phase 7 deletes the API key path, so everything below has to pass
before anything is removed. After Phase 7 there is no fallback credential to debug with.

- [ ] Unit tests: PKCE verification, redirect-URI matching (esp. loopback port-agnostic),
      audience validation, refresh rotation, RFC 6749 error mapping
- [ ] End-to-end against Claude Code (`claude mcp add --transport http pinsquirrel <url>`), which
      exercises the CIMD + loopback path
- [ ] End-to-end against claude.ai as a custom connector, which exercises the fixed-callback path
- [ ] Verify a token issued for a different `resource` is rejected at `/mcp`
- [ ] Verify an `/mcp` token is rejected at `/api/v1`, and an `/api/v1` token at `/mcp`
- [ ] Verify an expired token triggers refresh, and a revoked refresh token returns
      `invalid_grant` and prompts re-consent
- [ ] Verify the profile page can revoke a live grant and the client notices

---

## Phase 7: Remove the API key path

> **Gated on 6g passing.** Nothing here starts until OAuth works end-to-end against both a real
> MCP client and the Chrome extension. Until then `ps_` keys stay as the working fallback. That
> is the whole reason Phase 6 builds alongside the key path instead of replacing it in place.

Decision 12 (rewritten) makes OAuth the only auth path. This phase collects the removal into one
reviewable diff instead of letting it leak through Phase 6.

### 7a. Routes and middleware

- [ ] Delete `apps/hono/src/middleware/bearer-auth.ts` and
      `apps/hono/src/middleware/api-auth.ts` (`apiKeyAuth`, `getApiUser`, `getApiKey`)
- [ ] Remove the `apiUser` / `apiKey` entries from the Hono `ContextVariableMap`
- [ ] Confirm no route still references `X-API-Key`, and drop `apiKeyHeader` from the OpenAPI
      security schemes if 6d has not already
- [ ] `middleware/session.ts`: its header comment cites `ApiKeyService.authenticate` as the
      service-side counterpart to session lookup. Point it at `OAuthService.verifyAccessToken`

### 7b. Service, database, domain

- [ ] Delete `ApiKeyService`, its validation schema (`validation/api-key.ts`), and its tests
- [ ] Delete `DrizzleApiKeyRepository`, the `ApiKeyRepository` interface, the `ApiKey` entity, and
      the `api-key` error types; drop their exports from each package's `index.ts`
- [ ] Remove `apiKeyRepository` from `createRepositories()` / the `Repositories` interface and
      its test in `libs/database`, then from the destructuring in `lib/db.ts`; remove
      `apiKeyService` from `lib/services.ts`. (`apps/admin` never used it.)
- [ ] Generate and run a migration dropping the `api_keys` table. Run it after the deploy that
      removes the code. A migration that drops a table still referenced by running instances
      takes the app down

### 7c. UI and docs

- [ ] Delete `views/pages/profile/ApiKeysCard.tsx` and `static/api-key-copy.js`, drop the
      `apiKeys` / `newApiKey` props and the card line from `views/pages/profile.tsx`, and remove
      the `create-api-key` / `revoke-api-key` intents (and the `ApiKeyLimitExceededError` branch
      and the `listApiKeys` calls in the error path) from `routes/profile.tsx`; the
      `OAuthGrantsCard` from 6f takes its place. Update `profile.test.tsx` accordingly
- [ ] Purge `ps_` from the docs: `/api/docs` descriptions, README, and this plan's historical
      decisions. The decisions get a "superseded" marker, not a silent edit

### 7d. Verify

- [ ] `pnpm quality` green
- [ ] A previously-issued `ps_` key is rejected everywhere
- [ ] MCP and the Chrome extension both still work on OAuth alone

---

## Key technical decisions

1. ~~**API key format**: `ps_` prefix + `generateSecureToken()` (base64url, 32 bytes). Stored as SHA-256 hash. Prefix shown for identification.~~ Superseded 2026-08-17 by Decision 12. API keys are being removed in Phase 7. Kept for history; the hashing approach carries over to OAuth tokens (`pso_`), which reuse the same `crypto.ts` helpers.
2. **API versioning**: `/api/v1/` path prefix for future compatibility
3. ~~**Auth header**: Supports both `Authorization: Bearer` and `X-API-Key` for flexibility~~ Superseded 2026-08-17 by Decision 12. `X-API-Key` existed only for API keys and goes with them. `Authorization: Bearer` is the only credential form.
4. **Pagination**: Page-based, not cursor-based, to match the existing `Pagination` class in the domain layer. Phase 1a adds `totalCount` to the `Pagination` class so API responses can be built directly from it.
5. **Existing API separation**: Rename the existing `/api/metadata` (session-auth, frontend-only) to `/api/internal/metadata` so internal endpoints are separate from the public API.
6. **One-way sync**: The extension never writes to PinSquirrel. Locally deleted bookmarks come back on the next sync.
7. **Chrome extension is standalone**: No workspace dependency on other packages; it talks only over the HTTP API. Build uses esbuild on its own, outside the Turbo pipeline.
8. **Read-only API for now**: Only GET endpoints in v1. Write endpoints can come later when there is a use case beyond the Chrome extension.
9. **MCP transport**: Streamable HTTP via `@hono/mcp` (`@modelcontextprotocol/hono` does not exist as a published package). Mounted at `/mcp`. Bearer token auth, sharing the token-validation code with the REST API but with its own resource identifier (Decision 18). `ps_` API keys as shipped, OAuth `pso_` tokens after Phase 6, and OAuth only after Phase 7.
10. **MCP tools are read-only for now**: The initial implementation ships only `list_pins`, `get_pin`, `list_tags`, matching the read-only v1 REST API. Read-write tools (`create_pin`, `update_pin`, `delete_pin`) wait for a concrete agent use case.
11. **API docs via OpenAPI + Scalar**: Instead of a hand-written JSX docs page, v1 routes use `@hono/zod-openapi` to generate an OpenAPI 3.1 spec (`/api/openapi.json`) rendered with Scalar (`/api/docs`). Schema-driven docs stay in sync with route definitions on their own.
12. **OAuth 2.1 replaces `ps_` API keys. One auth path, not two** (decided 2026-08-17, reversing the 2026-08-16 position that they would coexist). The old reasoning was that the two serve different clients: OAuth for interactive clients that can survive a browser redirect, API keys for scripts, curl, and the Chrome extension. That trade no longer holds up. Nothing external consumes the REST API yet, so there is no migration cost to eat. The Chrome extension has a native OAuth path in MV3 that is _better_ than a pasted key (Decision 19). And a second live credential type is permanent maintenance, with separate storage, revocation UI, docs, and a dispatch branch in every auth site, all bought for a hypothetical.

    It also removes work rather than adding it. The coexistence design required prefix dispatch in `authenticateBearer`, a discriminated-union result both consumers narrow, and an `allowOAuth` flag to keep OAuth off `/api/v1`. None of that gets built. One credential type means one code path. Phase 6 adds a standalone OAuth middleware next to the existing key path, and Phase 7 deletes the key path once 6g proves the replacement.

    Two types stay distinct and should not be conflated: the app's own auth result, and the MCP SDK's `AuthInfo`, which `mcpAuth()` builds _from_ it.

13. **PinSquirrel is its own authorization server**, colocated with the resource server. It already owns users, MySQL sessions, and a login UI, so `/oauth/authorize` is a consent page over existing session middleware. An external IdP (Auth0/Keycloak/WorkOS) would add a cross-host discovery problem, a documented common failure mode, for no benefit at this scale.
14. **Hand-roll the OAuth endpoints in Hono; don't use the MCP SDK's auth router.** Originally verified against `@modelcontextprotocol/sdk` 1.29.0: every handler (`authorize`, `token`, `register`, `metadata`, `revoke`) and `router.js` imports from `express`, and `OAuthServerProvider.authorize()` takes an Express `Response`. Two things are still reusable: the `OAuthServerProvider` interface as the shape for `OAuthService`, and the framework-agnostic Zod schemas in `@modelcontextprotocol/sdk/shared/auth.js`. Re-confirmed 2026-08-25 on `^1.30.0` (1.30.0 resolved): `dist/esm/server/auth/router.js` still imports `express`. Check again only if the SDK moves a major. `@hono/mcp@0.3.2` declares the SDK as a peer at `^1.29.0`, so the floor is unlikely to move without a `@hono/mcp` bump.
15. **CIMD is the primary client-registration path; DCR is the fallback.** Dynamic Client Registration is deprecated in the current spec, and in practice it makes Claude register a new client on every fresh connection, which means an unbounded `oauth_clients` table for a public server. A CIMD `client_id` is a self-hosted HTTPS URL that gets fetched and cached instead, and it is portable across authorization servers.
16. **Scopes start minimal**: `pins:read`, `tags:read`, matching the read-only MCP tools. `pins:write` arrives with Phase 3b-7's write tools, via the spec's step-up authorization flow. Adding a scope later is easy. Un-granting an over-broad one is not.
17. **Token audience binding is mandatory**: the `resource` (RFC 8707) from the authorization request is stored on the access token, and `/mcp` rejects any token not issued for itself. Spec MUST, and the confused-deputy defense.
18. **`/mcp` and `/api/v1` are both OAuth resources, with _separate_ resource identifiers** (decided 2026-08-17, replacing the same-day draft that kept `/api/v1` API-key-only; that draft died with Decision 12). Two protected resources, one authorization server:

    | Resource URI                     | Clients                      | Metadata document                              |
    | -------------------------------- | ---------------------------- | ---------------------------------------------- |
    | `https://pinsquirrel.com/mcp`    | Claude and other MCP clients | `/.well-known/oauth-protected-resource/mcp`    |
    | `https://pinsquirrel.com/api/v1` | Chrome extension, scripts    | `/.well-known/oauth-protected-resource/api/v1` |

    A token minted for one must be rejected by the other. Collapsing both to a single audience (`https://pinsquirrel.com`, or any bare-origin check) would reduce audience binding to an origin match and let an `/mcp` grant drive the REST API. That is exactly the confused-deputy hole Decision 17 forbids, and RFC 8707 makes the path component significant so this distinction can be expressed. The cost is one extra metadata document and passing the expected resource into the auth middleware rather than hardcoding it.

19. **The Chrome extension authenticates via `chrome.identity.launchWebAuthFlow`** (decided 2026-08-17). This replaces the pasted-API-key design and the plan's former claim that an OAuth redirect would be hostile UX in an extension. That was true of a generic browser redirect, not of the MV3 identity API. Chrome mints an extension-owned callback at `https://<extension-id>.chromiumapp.org/`, so it is an ordinary authorization-code + PKCE flow against a fixed HTTPS redirect URI, with no loopback-port matching (the fiddliest part of Phase 6e) and no secret stored in the extension. Requires the `identity` permission in the manifest, `offline_access` so the service worker can refresh unattended, and tokens in `chrome.storage.local`. Never `chrome.storage.sync`, which replicates across machines and is not a secret store.

20. **OAuth follows the layering rule, and the issuer comes from `BASE_URL`** (decided 2026-08-25, after the review landed). Two halves:

    _Layering._ CLAUDE.md's rule (apps call services, services call repositories) was written after the REST API listed private pins and the check-url endpoint skipped `AccessControl`, both because a transport reached past the service. The review then removed the last such case in the auth path. `ApiKeyService.authenticate` resolves a token to its user, so `bearer-auth.ts` no longer touches `userRepository`. OAuth inherits that shape from the start. `OAuthService.verifyAccessToken(raw, expectedResource)` returns the principal. `middleware/oauth-auth.ts` parses a header and renders a `401`. `routes/oauth*.ts` render pages and forms. Nothing in `apps/hono/src/{routes,middleware,mcp}` imports from `lib/db.ts`. `createRepositories()` in `libs/database` creates the OAuth repositories like every other one, `MaintenanceService.sweepExpired` sweeps their expiry like every other store, and the CIMD fetch arrives in the service as the injected `HttpFetcher` (backed by the SSRF-guarded `NodeHttpFetcher`) like the metadata fetch does. The test for whether a new piece is in the right layer: can you unit-test it without HTTP and without a database? If it is in `libs/services`, yes.

    _Issuer._ Nothing in the app had a base-URL setting; `routes/seo.ts` reads the origin off the request. That cannot carry over to OAuth. The `issuer`, the `resource` identifiers, the `iss` parameter, and the audience check all have to agree on one string that a request cannot influence, or a spoofed `Host` header becomes a way to confuse audiences. `BASE_URL` is a deployment fact, read once in the composition root and passed in, the way `MailgunEmailService` gets its config.

## Key files to reuse

_All paths below re-verified 2026-08-25, present and accurate on `main`._

- `libs/services/src/utils/crypto.ts`: `generateSecureToken()`, `hashToken()`. Written for API keys, reused as-is for OAuth `pso_` tokens and codes
- `libs/domain/src/entities/access.ts`: `AccessControl`, `AccessGateable` for authorization
- `libs/database/src/repositories/session.ts`: the hashed-secret-with-expiry repository pattern (was the model for `DrizzleApiKeyRepository`; now the model for the OAuth token/code repositories), including `deleteExpiredSessions()` as the sweep hook shape
- `libs/database/src/create-repositories.ts`: where every repository is constructed. OAuth's three join the `Repositories` interface here
- `libs/domain/src/entities/pagination.ts`: `Pagination` class for API response pagination
- `apps/hono/src/lib/services.ts`: the composition root. Service singletons for routes, middleware and MCP tool handlers, and where `BASE_URL` gets read
- `apps/hono/src/lib/db.ts`: destructures `createRepositories(db)`. Routes and middleware do not import from it (CLAUDE.md "Layering")

### Additional for Phase 6 (OAuth)

- `libs/services/src/services/api-key.ts`: `ApiKeyService.authenticate()` is the token-to-principal shape `OAuthService.verifyAccessToken()` copies; `listApiKeys` / `revokeApiKey` are the `AccessControl` shape for grants
- `libs/services/src/services/maintenance.ts` + `apps/hono/src/lib/expiry-sweep.ts`: `sweepExpired()` / `SweepResult` and the hourly scheduler. OAuth expiry joins the former, never adds to the latter
- `libs/services/src/validation/zod-error.ts`: `validationErrorFromZod`, the one Zod to `ValidationError` conversion
- `libs/services/src/validation/url.ts`: `validateUrlForFetching`, the CIMD pre-check
- `libs/adapters/src/node-http-fetcher.ts`: the SSRF-guarded fetcher behind the `HttpFetcher` interface `OAuthService` receives. `libs/services/src/services/metadata.ts` shows the injection
- `apps/hono/src/middleware/bearer-auth.ts`: `authenticateBearer()`, the transport-only split to copy into `oauth-auth.ts`, not extend. Deleted in Phase 7
- `apps/hono/src/mcp/auth.ts`: where the `401` gains its `WWW-Authenticate` header and where `AuthInfo.scopes` gets populated
- `apps/hono/src/mcp/errors.ts`: `mapDomainErrorToMcp()`, for the 3b-7 write tools
- `apps/hono/src/middleware/session.ts`: `requireAuth()`. `/oauth/authorize` is a browser page and reuses this
- `apps/hono/src/middleware/rate-limit.ts` / `rate-limiter.ts`: `RateLimiter`, `rateLimitByIp()`, `getClientIp()`. Phase 6f adds limiters here
- `apps/hono/src/middleware/security-headers.ts`: the CSP the consent page and grants card must satisfy. `static/on-ready.js` is how page behaviour is attached
- `apps/hono/src/views/pages/profile/ApiKeysCard.tsx`: the card pattern `OAuthGrantsCard.tsx` copies
- `apps/hono/src/app.tsx`: the `app.route('/mcp', mcpRoutes)` line marks the pre-session/pre-CSRF mount point that `.well-known`, `/oauth/token`, and `/oauth/register` need
- `apps/hono/src/routes/seo.ts`: `getOrigin(c.req.url)`, the request-derived origin that is fine for a sitemap and must not be used for the issuer
- `libs/database/src/schema/api-keys.ts`: closest existing pattern for the hashed-secret OAuth tables

## Reference

- [MCP spec: Authorization](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP spec: Client Registration (CIMD vs DCR)](https://modelcontextprotocol.io/specification/draft/basic/authorization/client-registration)
- [Anthropic: Authentication for connectors](https://claude.com/docs/connectors/building/authentication), the Anthropic-specific requirements beyond the spec (callback URLs, latency budgets, CIMD selection rules)
- [Claude Code CIMD redirect_uri port issue #37747](https://github.com/anthropics/claude-code/issues/37747), closed 2026-05-24. Historical evidence that portless-CIMD loopback matching is easy to get wrong
