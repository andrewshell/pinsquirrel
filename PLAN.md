# PinSquirrel API, MCP OAuth & Chrome Extension Plan

## Overview

Add API key authentication, a general-purpose REST API, API documentation, OAuth 2.1
authorization for the MCP endpoint, and a Chrome extension for bookmark syncing.

## Current Status (verified 2026-08-16)

**Phases 1–4 are shipped and on `main`.** Verified against the code: `api-keys` schema +
`DrizzleApiKeyRepository`, `ApiKeyService`, profile-page key management UI, `/api/internal/*`,
`/api/v1/{pins,pins/:id,tags,tags/:id/pins}` via `OpenAPIHono`, `/api/openapi.json`, `/api/docs`
(Scalar), and `/mcp` with the three read-only tools (`list_pins`, `get_pin`, `list_tags`).

**Phase 6 (OAuth for MCP) is the active next phase.** Decided 2026-08-16: `/mcp` should support
OAuth 2.1 so Claude and other MCP clients connect with paste-URL-and-click rather than a
hand-copied `ps_` key. API keys are **not** being replaced — see Decision 12.

**Phase 5 (Chrome extension) is deferred but still open** — `apps/chrome-extension/` does not
exist. It reads `/api/v1/*` with a `ps_` API key and does not depend on Phase 6.

Work that landed on `main` _after_ Phase 4, outside this plan's scope (context for why the
extension stalled): SEO routes (`robots.txt`, `sitemap.xml`, markdown content negotiation),
the early-access waitlist + user lifecycle states, `libs/crypto` (sealed waitlist emails),
`apps/admin` (local-only waitlist reader/mailer), and a long run of dependency/advisory
maintenance. Released as 3.3.0 on 2026-08-13.

Baseline health as of 2026-08-16: `pnpm run audit` is clean on `main`. One open PR: #72
`chore(deps): drop the now-redundant shell-quote override` (branch
`chore/drop-shell-quote-override`) — land or close it before branching Phase 6.

### Open follow-ups on the API surface

- [ ] **Extend rate limiting across the public API surface.** Phase 6 raises the priority:
      `/oauth/token` and `/oauth/register` are unauthenticated endpoints. Folded into Phase 6f.
- [ ] **Deferred read-write MCP tools** — see Phase 3b-7. Gated on the `pins:write` scope
      from Phase 6, so do Phase 6 first.
- [ ] Bump `hono-rate-limiter` to `^0.5.3`, handle its `unstorage` peer, and remove the temporary
      `peerDependencyRules` allowance — do this as part of Phase 6f.

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Complete

---

## Phase 1: API Key Infrastructure

### 1a. Domain Layer

- [x] Create `libs/domain/src/entities/api-key.ts`
  - `ApiKey` entity (implements `AccessGateable`): id, userId, name, keyHash, keyPrefix (first 8 chars), lastUsedAt, expiresAt, createdAt
  - `CreateApiKeyData` type: userId, name, keyHash, keyPrefix, expiresAt?
- [x] Create `libs/domain/src/interfaces/api-key-repository.ts`
  - `ApiKeyRepository` interface: findById, findByKeyHash, findByUserId, create, updateLastUsed, delete, countByUserId
- [x] Create `libs/domain/src/errors/api-key.ts`
  - `ApiKeyError`, `ApiKeyNotFoundError`, `ApiKeyLimitExceededError`, `InvalidApiKeyError`, `UnauthorizedApiKeyAccessError`
- [x] Update `libs/domain/src/index.ts` — add all new exports

### 1b. Database Layer

- [x] Create `libs/database/src/schema/api-keys.ts`
  - Table `api_keys`: id (varchar 36 PK), user_id (FK → users.id, cascade), name (varchar 255), key_hash (varchar 64, unique), key_prefix (varchar 8), last_used_at (timestamp), expires_at (timestamp, nullable), created_at (timestamp)
- [x] Create `libs/database/src/repositories/api-key.ts`
  - `DrizzleApiKeyRepository` implementing `ApiKeyRepository`
  - Follow pattern from `libs/database/src/repositories/session.ts`
- [x] Update `libs/database/src/index.ts` — export `DrizzleApiKeyRepository`
- [x] Generate migration: `pnpm --filter @pinsquirrel/database db:generate`
- [x] Run migration: `pnpm --filter @pinsquirrel/database db:migrate`

### 1c. Service Layer

- [x] Create `libs/services/src/validation/api-key.ts`
  - Zod schema: name (1-100 chars, trimmed)
- [x] Create `libs/services/src/services/api-key.ts`
  - `ApiKeyService` constructor: `(apiKeyRepository: ApiKeyRepository)`
  - `createApiKey(ac, {userId, name})`:
    - Validates name with Zod schema
    - Enforces max 5 keys per user (`ApiKeyLimitExceededError`)
    - Generates raw key: `'ps_' + generateSecureToken()` (using `libs/services/src/utils/crypto.ts`)
    - Stores `hashToken(rawKey)` as keyHash, first 8 chars as keyPrefix
    - Returns `{apiKey, rawKey}` — raw key shown once only
  - `listApiKeys(ac, userId)`: access control check, return user's keys
  - `revokeApiKey(ac, keyId)`: find key, access control check, delete
  - `authenticateByKey(rawKey)`: hash key → lookup by hash → check expiration → updateLastUsed → return ApiKey or null
- [x] Update `libs/services/src/index.ts` — export `ApiKeyService`
- [x] Write tests for `ApiKeyService`

### 1d. Wiring

- [x] Update `apps/hono/src/lib/db.ts` — instantiate `DrizzleApiKeyRepository`
- [x] Update `apps/hono/src/lib/services.ts` — instantiate and export `ApiKeyService`

---

## Phase 2: API Key Management UI

- [x] Update `apps/hono/src/routes/profile.tsx`
  - GET: fetch user's API keys via `apiKeyService.listApiKeys()`, pass to view
  - POST `intent=create-api-key`: create key, pass raw key to view as `newApiKey` prop
  - POST `intent=revoke-api-key`: delete key by keyId, flash success message
- [x] Update `apps/hono/src/views/pages/profile.tsx`
  - Add `apiKeys` and `newApiKey` to ProfilePageProps
  - Add "API Keys" card section (after bookmarklet section)
  - List existing keys: name, prefix (`ps_abc1...`), created date, last used date, revoke button (form with hidden keyId)
  - Create form: name input + "Create API Key" button
  - New key display: highlighted box with raw key, copy functionality, warning "this key will not be shown again"
- [x] Manual test: create key, see it listed, revoke it

---

## Phase 3: REST API

### 3a. Rename Existing Internal API

- [x] Rename `apps/hono/src/routes/api.ts` → `apps/hono/src/routes/api-internal.ts`
- [x] Update `apps/hono/src/app.tsx` — mount at `/api/internal` instead of `/api`
- [x] Update frontend JS that calls `/api/metadata` to use `/api/internal/metadata`

### 3b. Auth Middleware

- [x] Update `libs/domain/src/entities/pagination.ts` — add `totalCount: number` readonly property (stored from `fromTotalCount()` first arg)
- [x] Create `apps/hono/src/middleware/api-auth.ts`
  - `apiKeyAuth()` middleware
  - Checks `Authorization: Bearer <key>` or `X-API-Key: <key>` header
  - Calls `apiKeyService.authenticateByKey(rawKey)`
  - Looks up user via `userRepository.findById(apiKey.userId)`
  - Sets `apiUser` on Hono context variable map
  - Returns `{ "error": "..." }` with 401 on failure
  - Export `getApiUser(c)` helper

### 3c. API Routes

- [x] Create `apps/hono/src/routes/api-v1.ts`
  - Apply `apiKeyAuth()` middleware to all routes

  **Endpoints:**

  | Method | Path                    | Description      | Service Method                                      |
  | ------ | ----------------------- | ---------------- | --------------------------------------------------- |
  | GET    | `/api/v1/pins`          | List user's pins | `PinService` via findByUserId                       |
  | GET    | `/api/v1/pins/:id`      | Get single pin   | `PinService` via findById                           |
  | GET    | `/api/v1/tags`          | List user's tags | `TagService` via getUserTags/getUserTagsWithCount   |
  | GET    | `/api/v1/tags/:id/pins` | Pins for a tag   | Look up tag name, then `PinService` with tag filter |

  **Query params for pin list endpoints:**
  - `tag` (string) — filter by tag name
  - `search` (string) — search URL, title, description
  - `readLater` (boolean)
  - `noTags` (boolean)
  - `sortBy` (`created` | `title`, default `created`)
  - `sortDirection` (`asc` | `desc`, default `desc`)
  - `page` (number, default 1)
  - `pageSize` (number, default 25, max 100)

  **Response format:**

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

  **Tags response (with `?withCounts=true`):**

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

  **Error format:** `{ "error": "Human-readable message" }` with appropriate HTTP status

- [x] Update `apps/hono/src/app.tsx` — mount `app.route('/api/v1', apiV1Routes)`
- [x] Test with curl using a real API key

---

## Phase 3b: MCP Endpoints (Read-only, shipped)

Implemented with `@hono/mcp` (not `@modelcontextprotocol/hono`). Read-only only — create/update/delete tools were intentionally deferred.

### 3b-1. Install Dependencies

- [x] Install `@modelcontextprotocol/sdk` and `@hono/mcp` in `@pinsquirrel/hono`

### 3b-2. MCP Auth Helper

- [x] Create `apps/hono/src/mcp/auth.ts`
  - Extract `Authorization: Bearer <key>` from request
  - Call `apiKeyService.authenticateByKey(rawKey)` to validate
  - Look up user via `userRepository.findById(apiKey.userId)`
  - Return authenticated user or throw 401

### 3b-3. MCP Server

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

### 3b-4. MCP Route

- [x] Create `apps/hono/src/routes/mcp.ts`
  - Uses `@hono/mcp` `StreamableHTTPTransport` (Streamable HTTP)
  - Applies Bearer token auth from 3b-2
  - Bypasses CSRF and session middleware (API key auth only)

### 3b-5. Mount Route

- [x] Update `apps/hono/src/app.tsx`
  - Mounted at `/mcp` before session/CSRF middleware

### 3b-6. Test

- [x] Manual test: configure Claude Code MCP server pointing to `http://localhost:8100/mcp` with `Authorization: Bearer ps_<key>` header
- [x] Verify read-only tools appear and can list pins/tags

### 3b-7. Future: Read-write MCP Tools (deferred)

- [ ] Add `create_pin`, `update_pin`, `delete_pin` tools when there is a concrete agent use case

**Do Phase 6 first.** Write tools need a `pins:write` scope so a read-only consent grant can't
mutate data, and the scope step-up flow is far easier to introduce alongside the initial OAuth
work than to retrofit onto already-issued tokens.

---

## Phase 4: API Docs (OpenAPI + Scalar, shipped)

Approach changed: instead of a hand-written JSX docs page, the v1 routes were rewritten with `@hono/zod-openapi` to generate an OpenAPI 3.1 spec, served alongside Scalar's interactive API reference UI.

- [x] Migrate `apps/hono/src/routes/api-v1.ts` to `OpenAPIHono` with `createRoute()` definitions and Zod request/response schemas
- [x] Create `apps/hono/src/routes/api-docs.ts`
  - Mounts v1 routes via `api.route('/v1', apiV1Routes)` so paths appear under `/v1/*` in the spec
  - Registers `bearerAuth` and `apiKeyHeader` security schemes
  - Serves OpenAPI spec at `GET /api/openapi.json` (`api.doc31`)
  - Serves Scalar UI at `GET /api/docs`
- [x] Update `apps/hono/src/app.tsx` — mount at `/api` (replaces direct `/api/v1` mount; api-docs.ts re-mounts v1 internally)
- [x] Verify Scalar page renders and `openapi.json` validates

---

## Phase 5: Chrome Extension (deferred, not blocked)

> Nothing in this phase has been started. The v1 REST endpoints it depends on
> (`GET /api/v1/tags`, `GET /api/v1/tags/{id}/pins`) are live and documented at `/api/docs`, so
> the API client can be written against the published OpenAPI spec.
>
> **This phase does not need Phase 6.** The extension authenticates with a `ps_` API key pasted
> into its settings — an OAuth browser redirect would be worse UX here, not better. Phase 6 is
> for interactive MCP clients; the two auth paths coexist (Decision 12).

### 5a. Scaffold

- [ ] Create `apps/chrome-extension/package.json` (`@pinsquirrel/chrome-extension`)
- [ ] Create `apps/chrome-extension/tsconfig.json`
- [ ] Create `apps/chrome-extension/manifest.json` (Manifest V3)
  - Permissions: `bookmarks`, `storage`, `alarms`
  - Service worker: `background.js`
  - Popup: `popup.html`
- [ ] Create `apps/chrome-extension/popup.html`
- [ ] Create build script (esbuild: bundle background.ts + popup.ts)
- [ ] Add icon placeholders

### 5b. API Client

- [ ] Create `apps/chrome-extension/src/types.ts` — shared types (Tag, Pin, Pagination, ExtensionStorage)
- [ ] Create `apps/chrome-extension/src/api-client.ts`
  - `PinSquirrelApiClient` class (baseUrl, apiKey in constructor)
  - `getTags(withCounts?)` → fetch `/api/v1/tags`
  - `getPinsForTag(tagId, page?, pageSize?)` → fetch `/api/v1/tags/:id/pins`
  - `getAllPinsForTag(tagId)` → paginate through all pages

### 5c. Popup UI

- [ ] Create `apps/chrome-extension/src/popup.ts`
  - **Settings view** (unconfigured): URL input, API key input, "Connect" button (validates by fetching tags)
  - **Main view** (configured): tag checkboxes, "Sync Now" button, last sync time, status, "Disconnect"
  - Stores config in `chrome.storage.local`: `{ baseUrl, apiKey, selectedTagIds, lastSyncAt, lastSyncError }`

### 5d. Bookmark Sync

- [ ] Create `apps/chrome-extension/src/bookmark-sync.ts`
  - `findOrCreateFolder(parentId, name)` — find/create bookmark folder
  - `syncTagFolder(folderId, pins[])` — add missing bookmarks, remove extras, update changed titles
  - `removeOrphanFolders(parentFolderId, activeTagNames[])` — remove folders for deselected tags
  - `syncAll(apiClient, selectedTagIds)` — orchestrates full sync:
    1. Find/create "PinSquirrel" root folder in bookmark bar
    2. For each selected tag: find/create subfolder, fetch all pins, sync bookmarks
    3. Remove orphan subfolders
    4. Store lastSyncAt

### 5e. Background Service Worker

- [ ] Create `apps/chrome-extension/src/background.ts`
  - `chrome.runtime.onStartup` → trigger sync
  - `chrome.runtime.onInstalled` → set up alarm for periodic sync (optional)
  - Listen for messages from popup (manual sync trigger)
  - Sync logic calls into `bookmark-sync.ts`

### 5f. Testing

- [ ] Load extension unpacked in Chrome
- [ ] Configure API key and URL
- [ ] Select tags, sync, verify bookmark folders created
- [ ] Add/remove pin on website, re-sync, verify bookmarks update
- [ ] Deselect tag, sync, verify folder removed

---

## Phase 6: OAuth 2.1 for MCP

> **← Resume here.** Nothing started. Goal: a user pastes `https://pinsquirrel.com/mcp` into
> Claude (or any MCP client), clicks through a consent screen, and is connected — no hand-copied
> API key.

**Architecture:** PinSquirrel is its own **authorization server**, colocated with the resource
server. It already has users, MySQL-backed sessions, and a login UI, so the authorize endpoint is
a consent page reusing `sessionMiddleware()` and the token endpoint mints rows in a table. An
external IdP would add a cross-host discovery problem for no benefit (Decision 13).

`/mcp` stays a pure OAuth 2.1 **resource server**: validate the bearer token, check the audience,
nothing else.

**Spec basis:** MCP authorization spec revision `2025-11-25` (and current draft), which layers
OAuth 2.1 + RFC 9728 (Protected Resource Metadata) + RFC 8414 (AS Metadata) + RFC 8707 (Resource
Indicators) + RFC 9207 (`iss`) + CIMD. Anthropic's connector requirements are a strict superset
in places — those are called out inline below.

### 6a. Discovery (no OAuth yet — prove the handshake)

Ship this first and alone. It is a small diff that makes the failure mode legible: Claude will
find the metadata and then fail at a _later_, more informative step.

- [ ] Update `apps/hono/src/mcp/auth.ts` — on auth failure return a real `401` with a
      `WWW-Authenticate` header. Currently returns bare `c.json({ error }, 401)` with no header,
      which is why no client can discover anything.

  ```
  HTTP/1.1 401 Unauthorized
  WWW-Authenticate: Bearer resource_metadata="https://pinsquirrel.com/.well-known/oauth-protected-resource",
                           scope="pins:read tags:read"
  ```

  - Must be HTTP `401`, not `200` — Claude ignores `WWW-Authenticate` on a 200
  - Must be an HTTP status, **not** an MCP tool error — applies to unauthenticated _tool calls_
    too, not just the initial connect ("lazy authentication")

- [ ] Create `apps/hono/src/routes/oauth-metadata.ts`
  - `GET /.well-known/oauth-protected-resource` (RFC 9728)
    - `resource` **must match the MCP URL exactly as the user types it into Claude**, path
      included — settle on `https://pinsquirrel.com/mcp` and document that string
    - `authorization_servers: ["https://pinsquirrel.com"]` — Claude uses the **first** entry only
      and never falls back to later ones
    - `scopes_supported: ["pins:read", "tags:read"]`
  - `GET /.well-known/oauth-authorization-server` (RFC 8414):

    ```json
    {
      "issuer": "https://pinsquirrel.com",
      "authorization_endpoint": "https://pinsquirrel.com/oauth/authorize",
      "token_endpoint": "https://pinsquirrel.com/oauth/token",
      "registration_endpoint": "https://pinsquirrel.com/oauth/register",
      "scopes_supported": ["pins:read", "tags:read"],
      "response_types_supported": ["code"],
      "grant_types_supported": ["authorization_code", "refresh_token"],
      "code_challenge_methods_supported": ["S256"],
      "client_id_metadata_document_supported": true,
      "token_endpoint_auth_methods_supported": ["none", "client_secret_post"],
      "authorization_response_iss_parameter_supported": true
    }
    ```

    ⚠️ **Claude selects CIMD only if the metadata advertises _both_
    `client_id_metadata_document_supported: true` _and_ `"none"` in
    `token_endpoint_auth_methods_supported`** — the CIMD client authenticates as a public client.
    Miss either and it silently falls back to DCR.

- [ ] Mount both `.well-known` routes **before** session/CSRF middleware in `app.tsx` (same
      position as `/mcp` at line ~63) — they must be reachable unauthenticated
- [ ] Manual test: `curl -i https://localhost:8100/mcp` shows the header; both metadata documents
      fetch and parse

### 6b. Domain + database layer

- [ ] `libs/domain/src/entities/oauth-client.ts` — `OAuthClient`: id, clientId, clientName,
      redirectUris, grantTypes, tokenEndpointAuthMethod, registrationType (`cimd` | `dcr` |
      `static`), metadataUrl (CIMD only), metadataFetchedAt, createdAt
- [ ] `libs/domain/src/entities/oauth-grant.ts` — `AuthorizationCode` (code hash, clientId,
      userId, redirectUri, codeChallenge, scopes, resource, expiresAt, consumedAt) and
      `OAuthToken` (token hash, kind, clientId, userId, scopes, **resource**, expiresAt,
      revokedAt, rotatedFrom)
- [ ] `libs/domain/src/interfaces/` — repository interfaces for both
- [ ] `libs/domain/src/errors/oauth.ts` — error types that map cleanly to RFC 6749 codes
- [ ] `libs/database/src/schema/oauth-*.ts` — tables `oauth_clients`,
      `oauth_authorization_codes`, `oauth_tokens`. Hash codes and tokens at rest, same as
      `api_keys.key_hash` and `sessions`
- [ ] `libs/database/src/repositories/oauth-*.ts` — Drizzle implementations
- [ ] Generate + run migration

### 6c. Service layer

- [ ] `libs/services/src/services/oauth.ts` — `OAuthService`
  - Shape the public methods after the SDK's `OAuthServerProvider` interface
    (`authorize`, `challengeForAuthorizationCode`, `exchangeAuthorizationCode`,
    `exchangeRefreshToken`, `verifyAccessToken`, `revokeToken`) so the mental model matches the
    ecosystem — but **do not** implement the SDK interface literally; it takes an Express
    `Response` (Decision 14)
  - Reuse `libs/services/src/utils/crypto.ts` for token generation and hashing
- [ ] `libs/services/src/validation/oauth.ts` — Zod schemas. Reuse the schemas from
      `@modelcontextprotocol/sdk/shared/auth.js` where they fit; those are framework-agnostic
- [ ] Redirect-URI matching helper — see 6e, this is the fiddly part, give it its own tests
- [ ] Tests for `OAuthService`

### 6d. Endpoints

- [ ] `apps/hono/src/routes/oauth.tsx` — `GET`/`POST /oauth/authorize`
  - Browser-facing consent page. Mount **after** `sessionMiddleware()` and `csrf()` — the
    opposite of `/mcp`. Unauthenticated visitors go through the existing login flow and return
  - Require PKCE `S256`; reject `plain` and reject a missing `code_challenge`
  - Validate and persist the `resource` parameter (RFC 8707)
  - Consent screen shows `client_name` and **the redirect URI hostname** — required by the spec,
    and the only defense against loopback impersonation by a local process
  - Emit `iss` on the redirect (RFC 9207), success and error alike
- [ ] `apps/hono/src/routes/oauth-token.ts` — `POST /oauth/token`
  - ⚠️ **Must parse `application/x-www-form-urlencoded`.** Claude sends both the initial exchange
    and refreshes that way; a JSON-only handler returns `415` and the whole flow dies. Note
    `/oauth/register` is `application/json` — different parser, don't share one
  - Verify PKCE, single-use authorization codes, bind `resource` onto the issued token
  - **Rotate refresh tokens** — DCR and CIMD both register Claude as a _public_ client, and
    OAuth 2.1 requires rotation for those. Return the new refresh token in the same response
    that invalidates the old one
  - Return RFC 6749 codes — **`invalid_grant`**, never a custom code, on a dead refresh token;
    Claude's recovery keys on it
- [ ] `apps/hono/src/routes/oauth-register.ts` — `POST /oauth/register` (RFC 7591, DCR fallback)
- [ ] Bypass CSRF for `/oauth/token` and `/oauth/register` (mount before `csrf()` like `/mcp`)
- [ ] Update `apps/hono/src/mcp/auth.ts` — accept OAuth access tokens alongside `ps_` keys.
      **Validate the token audience**: reject any token whose stored `resource` isn't this
      server. This is a spec MUST and the confused-deputy defense; it's the step hand-rolled
      implementations most often skip
- [ ] Populate `scopes` in the `AuthInfo` object (currently hardcoded `[]` at `mcp/auth.ts:20`)

### 6e. Client registration (CIMD-first)

- [ ] CIMD resolution: when `client_id` is an HTTPS URL, fetch it, validate the document's
      `client_id` matches the URL exactly, validate `redirect_uris`, cache respecting HTTP cache
      headers
  - ⚠️ **SSRF guard required** — this is a server-side fetch of a caller-supplied URL. Block
    private ranges, loopback, link-local, and cap redirects/response size
- [ ] **Redirect URI matching — the bug-prone part.** Two shapes:
  - Hosted Claude (web, Desktop, mobile, Cowork): exact match on
    `https://claude.ai/api/mcp/auth_callback`
  - Claude Code: native client, RFC 8252 loopback on an **ephemeral port**. It declares portless
    `http://localhost/callback` and `http://127.0.0.1/callback` in its CIMD
    (`https://claude.ai/oauth/claude-code-client-metadata`), so **matching must ignore the port
    for loopback hosts**. RFC 8252 §7.3 requires this for `127.0.0.1`; apply the same to
    `localhost` or Claude Code cannot connect. There is an open Claude Code issue (#37747) on
    exactly this interaction — test against the real client, not just a unit test
- [ ] DCR as fallback for clients that don't do CIMD. Prefer CIMD: DCR is deprecated in the spec
      and makes Claude register a **new client row on every fresh connection** (Decision 15)
- [ ] Support pre-registered static credentials — lets an org paste its own `client_id` when
      adding PinSquirrel as a custom connector

### 6f. Rate limiting and hardening

Folded in from the standing follow-up; Phase 6 raises the priority, since `/oauth/token` and
`/oauth/register` are unauthenticated endpoints.

- [ ] Extend `rate-limit.ts` coverage to `/mcp`, `/api/v1/*`, `/oauth/token`, `/oauth/register`
- [ ] Bump `hono-rate-limiter` to `^0.5.3`, handle its `unstorage` peer, remove the temporary
      `peerDependencyRules` allowance
- [ ] **Latency budget** — Claude waits **10s** for discovery/register/token and **30s** for
      refresh, then treats the flow as failed. Don't buffer the response behind slow downstream
      work
- [ ] Profile page: list and revoke active OAuth grants, next to the existing API key section
- [ ] Anthropic egresses from `160.79.104.0/21` — note it in DEPLOYMENT.md if a WAF ever lands

### 6g. Testing

- [ ] Unit tests: PKCE verification, redirect-URI matching (esp. loopback port-agnostic),
      audience validation, refresh rotation, RFC 6749 error mapping
- [ ] End-to-end against **Claude Code** (`claude mcp add --transport http pinsquirrel <url>`) —
      exercises the CIMD + loopback path
- [ ] End-to-end against **claude.ai** as a custom connector — exercises the fixed-callback path
- [ ] Verify a token issued for a different `resource` is rejected at `/mcp`
- [ ] Verify an expired token triggers refresh, and a revoked refresh token returns
      `invalid_grant` and prompts re-consent

---

## Key Technical Decisions

1. **API key format**: `ps_` prefix + `generateSecureToken()` (base64url, 32 bytes). Stored as SHA-256 hash. Prefix shown for identification.
2. **API versioning**: `/api/v1/` path prefix for future compatibility
3. **Auth header**: Supports both `Authorization: Bearer` and `X-API-Key` for flexibility
4. **Pagination**: Page-based (not cursor-based) — matches existing `Pagination` class in domain layer. `totalCount` will be added to the `Pagination` class (Phase 1a) so API responses can be built directly from it.
5. **Existing API separation**: Rename existing `/api/metadata` (session-auth, frontend-only) to `/api/internal/metadata` to cleanly separate internal endpoints from the public API.
6. **One-way sync**: Extension never writes to PinSquirrel. Locally deleted bookmarks are re-created on next sync.
7. **Chrome extension is standalone**: No workspace dependency on other packages — communicates only via HTTP API. Build uses esbuild independently (not in Turbo pipeline).
8. **Read-only API for now**: Only GET endpoints in v1. Write endpoints can be added later when there's a use case beyond the Chrome extension.
9. **MCP transport**: Streamable HTTP via `@hono/mcp` (`@modelcontextprotocol/hono` does not exist as a published package). Mounted at `/mcp`. Uses same Bearer token auth as REST API (existing `ps_` API keys).
10. **MCP tools are read-only for now**: Initial implementation ships only `list_pins`, `get_pin`, `list_tags` — matches the read-only v1 REST API. Read-write tools (`create_pin`, `update_pin`, `delete_pin`) are deferred until there's a concrete agent use case.
11. **API docs via OpenAPI + Scalar**: Instead of a hand-written JSX docs page, v1 routes use `@hono/zod-openapi` to generate an OpenAPI 3.1 spec (`/api/openapi.json`) rendered with Scalar (`/api/docs`). Schema-driven docs stay in sync with route definitions automatically.
12. **OAuth and API keys coexist — OAuth does not replace `ps_` keys** (decided 2026-08-16). They solve different problems: OAuth is for interactive clients that need per-user consent and can survive a browser redirect (Claude, other MCP clients); API keys are for scripts, curl, and the Chrome extension, where a redirect is hostile UX. `authenticateBearer` branches on the token prefix and returns the same `AuthInfo` either way.
13. **PinSquirrel is its own authorization server**, colocated with the resource server. It already owns users, MySQL sessions, and a login UI, so `/oauth/authorize` is a consent page over existing session middleware. An external IdP (Auth0/Keycloak/WorkOS) would introduce a cross-host discovery problem — a documented common failure mode — for no benefit at this scale.
14. **Hand-roll the OAuth endpoints in Hono; don't use the MCP SDK's auth router.** Verified against `@modelcontextprotocol/sdk` 1.29.0 in the tree: every handler (`authorize`, `token`, `register`, `metadata`, `revoke`) and `router.js` imports from `express`, and `OAuthServerProvider.authorize()` takes an Express `Response`. Two things are still reusable: the `OAuthServerProvider` interface as the shape for `OAuthService`, and the framework-agnostic Zod schemas in `@modelcontextprotocol/sdk/shared/auth.js`.
15. **CIMD is the primary client-registration path; DCR is the fallback.** Dynamic Client Registration is deprecated in the current spec, and operationally it makes Claude register a new client on every fresh connection — an unbounded `oauth_clients` table for a public server. A CIMD `client_id` is a self-hosted HTTPS URL that gets fetched and cached instead, and is portable across authorization servers.
16. **Scopes start minimal**: `pins:read`, `tags:read` — matching the read-only MCP tools. `pins:write` arrives with Phase 3b-7's write tools, via the spec's step-up authorization flow. Easier to add a scope later than to un-grant an over-broad one.
17. **Token audience binding is mandatory**: the `resource` (RFC 8707) from the authorization request is stored on the access token, and `/mcp` rejects any token not issued for itself. Spec MUST, and the confused-deputy defense.

## Key Files to Reuse

_All paths below re-verified 2026-08-16 — still present and accurate._

- `libs/services/src/utils/crypto.ts` — `generateSecureToken()`, `hashToken()` for API key generation/hashing
- `libs/domain/src/entities/access.ts` — `AccessControl`, `AccessGateable` for authorization
- `libs/database/src/repositories/session.ts` — pattern for new DrizzleApiKeyRepository
- `libs/domain/src/entities/pagination.ts` — `Pagination` class for API response pagination
- `apps/hono/src/middleware/session.ts` — pattern reference for api-auth middleware
- `apps/hono/src/lib/services.ts` — already-instantiated service singletons for MCP tool handlers
- `apps/hono/src/lib/db.ts` — already-instantiated repositories (userRepository for MCP user lookup)

### Additional for Phase 6 (OAuth)

- `apps/hono/src/middleware/bearer-auth.ts` — `authenticateBearer()`; extend to accept OAuth access tokens alongside `ps_` keys
- `apps/hono/src/mcp/auth.ts` — where the `401` gains its `WWW-Authenticate` header and where `AuthInfo.scopes` gets populated
- `apps/hono/src/middleware/session.ts` — `/oauth/authorize` is a browser page and reuses this
- `apps/hono/src/middleware/rate-limit.ts` — currently only wired into `routes/auth.tsx`; Phase 6f extends it
- `apps/hono/src/app.tsx` (~line 63) — the pre-session/pre-CSRF mount point pattern that `.well-known`, `/oauth/token`, and `/oauth/register` need
- `libs/database/src/schema/api-keys.ts` — closest existing pattern for the hashed-secret OAuth tables

## Reference

- [MCP spec — Authorization](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP spec — Client Registration (CIMD vs DCR)](https://modelcontextprotocol.io/specification/draft/basic/authorization/client-registration)
- [Anthropic — Authentication for connectors](https://claude.com/docs/connectors/building/authentication) — Anthropic-specific requirements beyond the spec (callback URLs, latency budgets, CIMD selection rules)
- [Claude Code CIMD redirect_uri port issue #37747](https://github.com/anthropics/claude-code/issues/37747)
