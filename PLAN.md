# PinSquirrel API, OAuth & Chrome extension plan

## Status (verified 2026-08-26)

PinSquirrel serves a read-only REST API at `/api/v1` (pins, a single pin, tags, and the pins for
a tag), an OpenAPI 3.1 spec at `/api/openapi.json` rendered with Scalar at `/api/docs`, and an
MCP endpoint at `/mcp` with three read-only tools. OAuth 2.1 is the single authentication path
for both, with PinSquirrel acting as its own authorization server and `/mcp` and `/api/v1`
standing as two separately-identified protected resources. It has been driven end to end by real
clients — Claude Code over CIMD, claude.ai as a custom connector, and the Chrome extension over
DCR — and in process against the real app and database in `apps/hono/src/oauth-e2e.test.ts`.

The Chrome extension (`apps/chrome-extension/`, its README is the reference) syncs selected tags
into bookmark folders over `/api/v1` and is built and tested in a real Chrome. Distribution
beyond "load unpacked" is deferred.

The only open work is Phase 8. Everything else this plan once tracked has shipped; the reasoning
that outlived the checklists is in the decision log below.

## Ground rules

CLAUDE.md's layering rule (apps call services, services call repositories) applies throughout and
is not repeated here. On top of it:

- New repositories join `createRepositories()` in `libs/database/src/create-repositories.ts`.
  Nothing outside that package constructs a Drizzle repository.
- Every store with an expiry joins `MaintenanceService.sweepExpired()` and its `SweepResult`.
  `apps/hono/src/lib/expiry-sweep.ts` runs it hourly; there is no second scheduler.
- CSP is `script-src 'self'` (`apps/hono/src/middleware/security-headers.ts`). No inline
  `<script>`, no `onclick=`. Page behaviour lives in `apps/hono/src/static/*.js`, wired with
  `onReady()`.
- Outbound fetches of a caller-supplied URL go through the injected `HttpFetcher`, backed by
  `NodeHttpFetcher` (`libs/adapters`), which pins the connection to the address it validated and
  re-checks every redirect hop. `validateUrlForFetching`
  (`libs/services/src/validation/url.ts`) is the string-level pre-check that runs first.
- Every user-scoped service operation takes an `AccessControl` and gates on it.
- `BASE_URL` is the only source of the issuer and the two resource identifiers. It is read once
  in `apps/hono/src/lib/config.ts`, which exports `baseUrl` and `oauthConfig`; services receive
  those strings and never read `process.env`. Never derive an issuer from the request — a
  spoofed `Host` header must not change what the server claims to be.
- One URI normalization rule, `libs/services/src/validation/oauth-uri.ts`, shared by metadata
  generation, redirect-URI matching, DCR dedup and the audience check. Divergent normalization
  produces audience failures that look like random connection breakage.
- One Zod-to-`ValidationError` helper, `validationErrorFromZod`
  (`libs/services/src/validation/zod-error.ts`). Routes translate that to RFC 6749 codes, not
  the service.
- Rate limiting is `RateLimiter` (`middleware/rate-limiter.ts`) plus `rateLimitByIp()` /
  `rateLimitByClientId()` (`middleware/rate-limit.ts`), applied inside the route file. `getClientIp`
  honours forwarding headers only when `TRUST_PROXY` is set; production sets it.
- `/mcp` builds an `McpServer` and a `StreamableHTTPTransport` per request and closes both
  afterwards. Do not reintroduce a shared transport: it caps the process at one MCP session and
  maps responses back to requests by JSON-RPC id across every caller.
- Mount order in `apps/hono/src/app.tsx` is load-bearing: `.well-known`, `/oauth/token`,
  `/oauth/register` and `/mcp` mount before `sessionMiddleware()` and `csrf()`, because a
  bearer-authenticated or unauthenticated machine endpoint must not mint a session or demand a
  CSRF token; `/oauth/authorize` and `/profile` mount after, because they are pages.

---

## Phase 8: Read-write MCP tools

Deferred from the original MCP work until there is a concrete agent use case.

- [ ] Add `create_pin`, `update_pin` and `delete_pin` to `createMcpServer()` in
      `apps/hono/src/mcp/server.ts`, over `PinService.createPin()`, `updatePin()` and
      `deletePin()`. Errors go through `mapDomainErrorToMcp()` (`apps/hono/src/mcp/errors.ts`)
      like the three read tools, rather than growing their own mapping
- [ ] Add a `pins:write` scope. No such scope exists today: `SUPPORTED_SCOPES` in
      `libs/services/src/services/oauth.ts` is `['pins:read', 'tags:read', 'offline_access']`,
      `DEFAULT_SCOPES` is the first two, and `OAUTH_RESOURCE_SCOPES` in
      `apps/hono/src/lib/config.ts` — which is what both protected-resource metadata documents
      and both `WWW-Authenticate` challenges advertise — is `['pins:read', 'tags:read']`
- [ ] Describe it on the consent screen. `SCOPE_DESCRIPTIONS` in
      `apps/hono/src/views/pages/oauth-consent.tsx` has one line per scope, and an undescribed
      scope is one a user is asked to approve without being told what it does
- [ ] Gate the write tools on the granted scope, so a token issued before `pins:write` existed —
      or one whose user approved only reads — cannot mutate data. The scopes are already on the
      principal: `oauthAuth` puts them on the context and `mcpAuth` passes them into the SDK's
      `AuthInfo`
- [ ] Work out the step-up: an existing connection holds a read-only grant, and asking for
      `pins:write` means sending the client back through `/oauth/authorize` for a new consent.
      Decide whether that re-consent replaces the old grant or runs alongside it, and what the
      MCP client sees in the meantime

---

## Runbooks

### Claude Code

1. `pnpm db:up`, then `pnpm dev`. Leave `BASE_URL` at its default `http://localhost:8100`. It
   has to be the origin the client actually reaches, because the issuer, both resource
   identifiers and the audience check all come from it.
2. `claude mcp add --transport http pinsquirrel http://localhost:8100/mcp`. The URL must match
   the resource identifier exactly, path included: `http://localhost:8100/mcp`.
3. Run `/mcp` in Claude Code, pick `pinsquirrel`, and choose to authenticate. A browser opens on
   `http://localhost:8100/oauth/authorize?...`.
4. Sign in if you are not already. The consent screen must name Claude Code, say it sends you
   back to `127.0.0.1` or `localhost`, and list `pins:read`, `tags:read` and `offline_access`.
   Approve it. The browser lands on a loopback port Claude Code is listening on.
5. Back in Claude Code the server reads as connected. Ask it to list your bookmarks.
6. Check the registration took the CIMD path rather than the DCR fallback:
   `select client_id, registration_type from oauth_clients` should show
   `https://claude.ai/oauth/claude-code-client-metadata` and `cimd`. A `dcr_` row instead means
   the metadata document was not selected, and the authorization-server document is where to
   look (`client_id_metadata_document_supported` and `"none"` both have to be advertised).
7. Open `/profile`. The Connected Applications card should name Claude Code, say MCP, list the
   three scopes, and carry today's date. Revoke it and confirm the client has to ask again.

### claude.ai as a custom connector

1. This one cannot run against localhost. Claude's servers fetch the metadata documents and post
   to the token endpoint themselves, so the deployment needs a public HTTPS origin. A tunnel is
   fine. Set `BASE_URL` to the tunnel's URL and restart: the issuer and both resource identifiers
   are read once at boot, so a tunnel started afterwards will not be reflected.
2. In claude.ai, add a custom connector pointing at `https://<your-host>/mcp`.
3. The redirect URI is the fixed `https://claude.ai/api/mcp/auth_callback`, which is the
   exact-match path rather than the loopback one. If you would rather hand it a `client_id` you
   control, set `OAUTH_STATIC_CLIENTS` before boot:
   `[{"client_id":"claude-web","client_name":"Claude","redirect_uris":["https://claude.ai/api/mcp/auth_callback"]}]`.
   It must not be an http(s) URL, since that form is read as a CIMD document.
4. The consent screen must name the connector and say it sends you back to `claude.ai`. Approve.
5. Confirm the connector lists the tools and that a query returns your bookmarks.
6. Check `/profile` shows the grant against MCP, and that revoking it disconnects the connector.

### Chrome extension

The extension's own README covers building it and loading `dist/` unpacked. Against a dev server
nothing has to be reconfigured: `BASE_URL` defaults to `http://localhost:8100`, which is in the
manifest's `host_permissions`, and the session cookie is only `Secure` in production.

1. `pnpm db:up`, `pnpm dev`, and sign in to the app in the same Chrome profile —
   `/oauth/authorize` is behind `requireAuth()`.
2. Type `http://localhost:8100` into the popup: an origin, no path, which is all `parseBaseUrl`
   accepts. Connect. The popup vanishes as the consent window opens — expected; reopen it to see
   the result, and watch the flow in the service worker's DevTools, not the popup's.
3. The redirect URI is `https://<extension-id>.chromiumapp.org/`, which needs nothing on the
   server. The DCR `client_id` is derived from the metadata, so one extension dedups to one
   `oauth_clients` row — but Chrome derives an unpacked extension's ID from its directory path,
   so a second checkout is a second row, and `/oauth/register` allows ten per IP per hour.
4. Tick tags, Sync Now, and check the bookmarks bar for a "PinSquirrel" folder. Revoke from
   `/profile` and confirm the popup comes back on Connect with a notice rather than failing
   silently.

---

## Key technical decisions

1. **API versioning**: `/api/v1/` path prefix for future compatibility.
2. **Pagination**: page-based, not cursor-based, to match the `Pagination` class in
   `libs/domain/src/entities/pagination.ts`, which carries `totalCount` so an API response can be
   built directly from it.
3. **Existing API separation**: the session-authenticated, frontend-only endpoints live under
   `/api/internal/*`, separate from the public API.
4. **One-way sync**: the extension never writes to PinSquirrel. Locally deleted bookmarks come
   back on the next sync.
5. **Chrome extension is standalone**: no workspace dependency on other packages; it talks only
   over the HTTP API. Build uses esbuild on its own, outside the Turbo pipeline.
6. **Read-only API for now**: only GET endpoints in v1. Write endpoints can come later when
   there is a use case beyond the Chrome extension.
7. **MCP transport**: Streamable HTTP via `@hono/mcp` (`@modelcontextprotocol/hono` does not
   exist as a published package), mounted at `/mcp`, authenticated with OAuth `pso_` tokens
   bound to its own resource identifier (Decision 16). The route builds an `McpServer` and a
   transport per request; a shared transport caps the process at one MCP session and mixes
   responses between concurrent callers by JSON-RPC id.
8. **MCP tools are read-only for now**: `list_pins`, `get_pin`, `list_tags`, matching the
   read-only v1 REST API. Read-write tools wait for a concrete agent use case (Phase 8).
9. **API docs via OpenAPI + Scalar**: the v1 routes use `@hono/zod-openapi` to generate an
   OpenAPI 3.1 spec (`/api/openapi.json`) rendered with Scalar (`/api/docs`). Schema-driven
   docs stay in sync with route definitions on their own.
10. **OAuth 2.1 is the auth path for `/mcp` and `/api/v1`, and the only one.** One credential
    type means one code path: no prefix dispatch, no discriminated-union auth result, no
    per-route flag deciding which credentials a route accepts. A second live credential type
    would be permanent maintenance — its own storage, revocation UI, docs, and a dispatch branch
    in every auth site. Do not add one without re-litigating this.

    Two types stay distinct and should not be conflated: the app's own auth principal
    (`oauthPrincipal` on the Hono context) and the MCP SDK's `AuthInfo`, which `mcpAuth()` builds
    _from_ it.

11. **PinSquirrel is its own authorization server**, colocated with the resource server. It
    already owns users, MySQL sessions, and a login UI, so `/oauth/authorize` is a consent page
    over existing session middleware. An external IdP (Auth0/Keycloak/WorkOS) would add a
    cross-host discovery problem, a documented common failure mode, for no benefit at this scale.
12. **Hand-roll the OAuth endpoints in Hono; don't use the MCP SDK's auth router.** Every handler
    (`authorize`, `token`, `register`, `metadata`, `revoke`) and `router.js` imports from
    `express`, and `OAuthServerProvider.authorize()` takes an Express `Response`. Re-confirmed
    2026-08-25 on `@modelcontextprotocol/sdk` 1.30.0. Two things are still reusable: the
    `OAuthServerProvider` interface as the shape for `OAuthService`, and the framework-agnostic
    Zod schemas in `@modelcontextprotocol/sdk/shared/auth.js`. Check again only if the SDK moves
    a major; `@hono/mcp` declares the SDK as a peer at `^1.29.0`, so the floor is unlikely to
    move without a `@hono/mcp` bump.
13. **CIMD is the primary client-registration path; DCR is the fallback.** Dynamic Client
    Registration is deprecated in the current spec, and in practice it makes Claude register a
    new client on every fresh connection, which means an unbounded `oauth_clients` table for a
    public server. A CIMD `client_id` is a self-hosted HTTPS URL that gets fetched and cached
    instead, and it is portable across authorization servers.
14. **Scopes start minimal**: `pins:read` and `tags:read` on both resources, plus
    `offline_access` advertised by the authorization server only. `pins:write` arrives with the
    Phase 8 write tools, via the spec's step-up authorization flow. Adding a scope later is easy.
    Un-granting an over-broad one is not.
15. **Token audience binding is mandatory**: the `resource` (RFC 8707) from the authorization
    request is stored on the access token, and each resource rejects any token not issued for
    itself. Spec MUST, and the confused-deputy defense.
16. **`/mcp` and `/api/v1` are both OAuth resources, with _separate_ resource identifiers.**
    Two protected resources, one authorization server:

    | Resource URI                     | Clients                      | Metadata document                              |
    | -------------------------------- | ---------------------------- | ---------------------------------------------- |
    | `https://pinsquirrel.com/mcp`    | Claude and other MCP clients | `/.well-known/oauth-protected-resource/mcp`    |
    | `https://pinsquirrel.com/api/v1` | Chrome extension, scripts    | `/.well-known/oauth-protected-resource/api/v1` |

    A token minted for one must be rejected by the other. Collapsing both to a single audience
    (`https://pinsquirrel.com`, or any bare-origin check) would reduce audience binding to an
    origin match and let an `/mcp` grant drive the REST API. That is exactly the confused-deputy
    hole Decision 15 forbids, and RFC 8707 makes the path component significant so this
    distinction can be expressed. The cost is one extra metadata document and passing the
    expected resource into the auth middleware rather than hardcoding it.

17. **The Chrome extension authenticates via `chrome.identity.launchWebAuthFlow`.** Chrome mints an extension-owned callback at
    `https://<extension-id>.chromiumapp.org/`, so it is an ordinary authorization-code + PKCE
    flow against a fixed HTTPS redirect URI, with no loopback-port matching and no secret stored
    in the extension. Requires the `identity` permission in the manifest, `offline_access` so the
    service worker can refresh unattended, and tokens in `chrome.storage.local`. Never
    `chrome.storage.sync`, which replicates across machines and is not a secret store.
18. **The issuer comes from `BASE_URL`.** The `issuer`, the `resource`
    identifiers, the `iss` parameter and the audience check all have to agree on one string that
    a request cannot influence, or a spoofed `Host` header becomes a way to confuse audiences.
    `BASE_URL` is a deployment fact, read once in `apps/hono/src/lib/config.ts` and passed in,
    the way `MailgunEmailService` gets its config. `routes/seo.ts` still derives its origin from
    the request URL, which is fine for a sitemap and must not be copied for anything OAuth
    touches.
19. **A connection is a client, not a client and a resource.** Revocation runs by user and
    client — `revokeGrantFamily` is what a refresh-token replay triggers too — so the profile
    page lists one row per client naming every audience it holds, and revoking it takes both.
    Splitting families by audience would let a replay on one audience leave the other alive,
    which is the wrong direction for a security response, and no client uses both audiences.

## Reference

- [MCP spec: Authorization](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP spec: Client Registration (CIMD vs DCR)](https://modelcontextprotocol.io/specification/draft/basic/authorization/client-registration)
- [Anthropic: Authentication for connectors](https://claude.com/docs/connectors/building/authentication), the Anthropic-specific requirements beyond the spec (callback URLs, latency budgets, CIMD selection rules)
- [Claude Code CIMD redirect_uri port issue #37747](https://github.com/anthropics/claude-code/issues/37747), closed 2026-05-24. Evidence that portless-CIMD loopback matching is easy to get wrong on both sides
