# PinSquirrel API, OAuth & Chrome extension plan

## Status (verified 2026-08-26)

PinSquirrel serves a read-only REST API at `/api/v1` (pins, a single pin, tags, and the pins for
a tag), an OpenAPI 3.1 spec at `/api/openapi.json` rendered with Scalar at `/api/docs`, and an
MCP endpoint at `/mcp` with eight tools — three reads, and five writes behind the write scopes.
OAuth 2.1 is the single authentication path for both, with PinSquirrel acting as its own
authorization server and `/mcp` and `/api/v1` standing as two separately-identified protected
resources. It has been driven end to end by real clients — Claude Code over CIMD, claude.ai as a
custom connector, and the Chrome extension over DCR — and in process against the real app and
database in `apps/hono/src/oauth-e2e.test.ts`.

The Chrome extension (`apps/chrome-extension/`, its README is the reference) syncs selected tags
into bookmark folders over `/api/v1` and is built and tested in a real Chrome. Distribution
beyond "load unpacked" is deferred.

Everything this plan once tracked as read-only has shipped, and so has the write side it was
opened for; the reasoning that outlived the checklists is in the decision log below. The two use
cases that drove it:

1. **Pin the current page from the extension**, so the bookmarklet is no longer the only way to
   create a pin from a browser. Phase 9, by opening the site's own pin form in a popup window —
   no API in the flow.
2. **Let an LLM help retag a library** — the account has many tags holding one or two pins and
   many pins holding no tags, and that is a job for an agent that can read and write over MCP.
   Phase 10.

The second needs a write scope that the server actually enforces. Phase 8 built that:
`pins:write` and `tags:write` are granted, advertised and described on the consent screen, and
two guards refuse a call that lacks them — `requireScope` for a route and `mcp/scopes.ts` for a
tool. Phase 10 built the write surface they guard, and with it the end-to-end test that proves a
read-only grant cannot write. Phase 9 rides the browser session and depends on neither. What is
left is one manual run of the retagging job over the Claude Code runbook.

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
  generation and the audience check. Divergent normalization produces audience
  failures that look like random connection breakage. Redirect URIs are the exception: they
  are compared as strings, and DCR dedup keys on that string (Decision 44).
- One Zod-to-`ValidationError` helper, `validationErrorFromZod`
  (`libs/services/src/validation/zod-error.ts`). Routes translate that to RFC 6749 codes, not
  the service.
- Rate limiting is `RateLimiter` (`middleware/rate-limiter.ts`) plus `rateLimitByIp()`
  (`middleware/rate-limit.ts`), applied inside the route file to the routes it guards, never `'*'`
  in a sub-app that mounts at a shared prefix. `getClientIp`
  honours forwarding headers only when `TRUST_PROXY` is set and the socket peer is a trusted proxy;
  production sets it.
- `/mcp` builds an `McpServer` and a `StreamableHTTPTransport` per request and closes both
  afterwards. Do not reintroduce a shared transport: it caps the process at one MCP session and
  maps responses back to requests by JSON-RPC id across every caller.
- Mount order in `apps/hono/src/app.tsx` is load-bearing: `.well-known`, `/oauth/token`,
  `/oauth/register` and `/mcp` mount before `sessionMiddleware()` and `csrf()`, because a
  bearer-authenticated or unauthenticated machine endpoint must not mint a session or demand a
  CSRF token; `/oauth/authorize` and `/profile` mount after, because they are pages.

---

## Search (before Phase 8)

Searching for `jesse elder` returned one pin when five were relevant. The search in
`DrizzlePinRepository.buildConditions` is one `LIKE '%<whole query>%'` over `url`, `title` and
`description`: `jesseelder.com` does not contain the spaced phrase, and the `jesseelder` tag is
not a searched column at all.

- [x] Split the query on whitespace into terms. Every term must match, each in any field: `AND`
      over terms of `OR` over `url`, `title`, `description` and tag name. Tag name is an
      `EXISTS` over `pins_tags` joined to `tags`, not a join on the outer query, so a pin with
      three tags is one row. `countByUserId` builds from the same `buildConditions`, so the
      total follows. `escapeLikePattern` applies per term
- [x] `TagRepository.searchByName(userId, terms)`: tags whose name contains any term, or the
      terms concatenated — `jesse elder` finds `jesseelder`. Exposed as `TagService.searchTags`,
      gated on `AccessControl` like every other user-scoped operation
- [x] On `/pins?search=`, a "Matching tags" row above the pin list: one chip per tag, linking
      to `/pins?tag=<name>`, rendered only when there is at least one. Comes back with the HTMX
      partial as well as the full page, since the search box refreshes the list without a
      navigation

---

## Phase 8: Write scopes, enforced

Two scopes, `pins:write` and `tags:write`, at the same granularity as the reads. Tags on a pin
are pin data and travel under `pins:write`; `tags:write` is for operations on the tag itself
(merge, delete). An MCP client doing retagging asks for both; the extension asks for neither,
because its pin flow runs on the browser session (Phase 9).

- [x] Add both to `SUPPORTED_SCOPES` in `libs/services/src/services/oauth.ts` and to
      `OAUTH_RESOURCE_SCOPES` in `apps/hono/src/lib/config.ts`, so both protected-resource
      documents and both `WWW-Authenticate` challenges advertise them. `DEFAULT_SCOPES` stays
      read-only: a client that names no scope gets no write, and a request for `pins:write` is a
      request the user sees on the consent screen
- [x] Describe them in `SCOPE_DESCRIPTIONS` (`apps/hono/src/views/pages/oauth-consent.tsx`) in
      the user's words — "Add, edit and delete your bookmarks", "Merge and delete your tags". An
      undescribed scope is one a user approves without being told what it does
- [x] Enforce. A `requireScope(scope)` next to `oauthAuth` in
      `apps/hono/src/middleware/oauth-auth.ts` that answers `403` with
      `WWW-Authenticate: Bearer error="insufficient_scope", scope="pins:write"` (RFC 6750 §3.1).
      `bearerChallenge()` (`middleware/www-authenticate.ts`) took an optional `error` and `scope`
      so both resources say it the same way; it keeps `resource_metadata` in the challenge, so a
      client can find its way back to the authorization server from a 403 and not only from a
      401 response. The principal carries the resource that accepted the token, so the refusal
      names that resource's metadata document, not the other one's. Applied per route, never
      globally, so the reads stay reachable on a read-only token — with Phase 9 no longer adding
      v1 write routes the REST half has no consumer, so the middleware is tested but mounted
      nowhere, and the MCP guard is the one that matters. Decision 43 later mounted it on the
      v1 reads.
      For MCP, `requireScope(extra, scope)` in `mcp/scopes.ts` — beside the tools rather than
      inside `server.ts`, so it is testable without building an `McpServer` — throwing
      `InsufficientScopeError`, which `mapDomainErrorToMcp()` maps to a tool error naming the
      scope and saying that reconnecting is the fix. It reads the scopes already on `AuthInfo`
      and fails closed when there are none. A token minted before these scopes existed carries
      neither and is refused by both, which is the point
- [x] Test the negative in `oauth-e2e.test.ts`: a token granted `pins:read tags:read` gets a
      scope refusal from a write surface, and a token granted `pins:write` gets through. Landed
      with Phase 10's `update_pin`, as a `write scopes` describe: the read-only grant made at the
      top of that file is refused by name, then a second connection asking for both write scopes
      creates a pin, retags it, reads the new tags back and deletes it. It is the one test that
      proves the scope is load-bearing rather than decorative — the unit tests either side of it
      (`middleware/oauth-auth.test.ts`, `mcp/scopes.test.ts`, `routes/mcp-write-tools.test.ts`)
      all hold the token as a fixture, so none of them can show that the scope a real grant
      carries is the one the guard reads

Step-up is re-consent, nothing more, so there is nothing here to build. A client holding a
read-only grant that wants to write sends the user back through `/oauth/authorize` naming the
wider scope; the server issues a new token family and `listGrants` already shows the union per
client (Decision 19). No server-side "upgrade" path: the `insufficient_scope` challenge is the
signal, and the client's job is to re-authorize. The old family stays valid until it expires or
is revoked — revoking it on step-up would break a second device holding the same client.

---

## Phase 9: Pin the current page from the extension

The bookmarklet opens `/pins/new?url&title&description` in a new tab, and the route already
handles dedup: `findByUrl` redirects to the existing pin's edit page. The extension keeps that
flow and that form. It opens the same pages in a small popup window instead of replicating the
form in extension UI, so a field added to the pin form is in the extension the day it ships on
the site. An `embed=1` presentation trims the page to the card so the window reads as a dialog.

Why a popup window and not the site framed inside the action popup: `secureHeaders()` sends
`X-Frame-Options: SAMEORIGIN`, and the session cookie is `SameSite=Lax`
(`apps/hono/src/middleware/session.ts`), so a request from a frame on a `chrome-extension://`
page is cross-site and arrives logged out — fixing that means `SameSite=None` on every session
to serve one embed. A popup window (`chrome.windows.create({ type: 'popup' })`) is a top-level
first-party navigation: the cookie flows, nothing about the site's headers changes, and the
window survives losing focus, which the action popup does not. It also keeps OAuth out of the
flow entirely — no `pins:write` grant, no step-up, and a signed-out user gets the site's own
login page, the same as the bookmarklet.

### 9a. Site: embed mode

- [x] `embed=1` on `/pins/new` and `/pins/:id/edit` renders the same content in a minimal
      layout — the card and the flash, no header, nav or footer. Any other value, or none, is
      the full page: nothing changes for the site's own users
- [x] The flag must survive the round trips. A hidden field carries it through the POST so a
      validation error re-renders in embed mode, and the `findByUrl` dedup redirect in
      `routes/pin-routes.tsx` appends it — which is how "already pinned" becomes the site's
      real edit form in the same window instead of a link out
- [x] Success in embed mode redirects to a stable confirmation page — `/pins/embed/saved`,
      embed layout, "Pin saved" — instead of to `/pins`. Stable URL because the extension
      worker matches on it to close the window (9b); the page only says so, since a page that
      was not script-opened cannot reliably `window.close()` itself. The edit form's save
      redirects the same way when the flag rides along, so no path inside the dialog
      dead-ends on the full site. Delete stays out of embed mode: the edit form has no delete
      path, so nothing inside the dialog can reach one

### 9b. Extension

- [x] Manifest: drop `default_popup` from the action, add `options_page`, add `activeTab`.
      `chrome.action.onClicked` only fires when the action has no popup, and the click is the
      gesture that grants `activeTab`, which is enough to read the current tab's URL and
      title. Not `tabs`, which is a standing permission over every tab. No `scripting`: the
      meta-description and selection prefill stay bookmarklet features until they are missed
- [x] Options page: the current popup UI (connect, tag list, Sync Now, disconnect) moves to
      the options page nearly unchanged — `popup.html` and `src/popup/*` relocate, reached by
      right-clicking the acorn → Options or from `chrome://extensions`. Settings are visited
      rarely once tags are chosen; pinning is the everyday action and gets the single click
- [x] Worker: on `action.onClicked` (the event carries the tab, no query needed), build
      `${baseUrl}/pins/new?url&title&embed=1`, open it with
      `chrome.windows.create({ type: 'popup', width, height })`, and remember the window id. A
      `tabs.onUpdated` listener watches that window for the saved page's URL, closes the window
      with `chrome.windows.remove`, and triggers a bookmark sync, so a pin tagged with a
      selected tag reaches the bookmarks bar without waiting for the hour. The window id goes
      to `chrome.storage.local`, not to a variable in the worker: MV3 unloads the worker after
      about thirty seconds idle, and the save comes whenever the user is done with the form
- [x] `commands`: a pin-this-page command with `suggested_key` Alt+D — the convention the
      Delicious extension set and the Pinboard shortcut extensions kept, chosen because Chrome
      reserves Ctrl/Cmd+D for its own bookmark (a user who wants it anyway can rebind at
      `chrome://extensions/shortcuts`). A command grants `activeTab` like an action click, and
      the handler is the same worker path
- [x] Tests, the same way as before: the options page driven in happy-dom (the popup tests,
      relocated), the worker with `stubChrome`. `chrome-mock.ts` grows `action.onClicked`,
      `tabs.onUpdated`, `windows.create` and `windows.remove`

This phase previously added `POST /api/v1/pins` and a `url` filter on `GET /api/v1/pins`.
Neither has a caller now, so neither is built: Decision 6 (read-only API until something needs
it) stands, and nothing requests `pins:write` until Phase 10.

---

## Phase 10: MCP write tools for retagging

The job: an agent reads the tag list with counts, finds the tags with one or two pins and the
pins with none, proposes a consolidation, and applies it. `list_tags` with counts and
`list_pins` with `noTags` already exist, so the read half is done; what is missing is a way to
change a pin's tags and to fold tags together.

- [x] `update_pin` — id plus any of `updatePinDataSchema` bar `isPrivate` — over
      `PinService.updatePublicPin()`. This is the retagging tool: `tagNames` replaces the pin's
      tags. Requires `pins:write`. Annotations: `idempotentHint: true`, no `destructiveHint`
- [x] `create_pin` and `delete_pin` over `createPin()` / `deletePublicPin()`, because a write
      scope that can edit but not create or delete is a strange one to explain. `delete_pin`
      carries `destructiveHint: true` so a client can confirm before calling. Requires
      `pins:write`
- [x] `merge_tags` over `TagService.mergeTags(sourceTagIds, targetTagId)`, which is the
      consolidation primitive: every pin under the sources gets the target and the sources go.
      Requires `tags:write`. `delete_tag` over `deleteTag()` alongside it, `destructiveHint`.
      Both descriptions say so: `updatePin` already collects tags left with no pins
      (`collectOrphanedTags`), so retagging a pin away from a singleton tag deletes the tag —
      the agent does not need a delete call for that case
- [x] Every write tool calls `requireScope(extra, …)` from `mcp/scopes.ts` before touching a
      service and inside the same `try`, so the refusal comes back through
      `mapDomainErrorToMcp()` as a tool error rather than a transport failure. `ValidationError`,
      `PinNotFound`, `TagNotFound`, `InsufficientScopeError` and the unauthorized errors had
      mappings already; `DuplicatePinError` did not, and collapsed to "Internal server error",
      which teaches an agent to retry a call that can never succeed (Decision 24). Phase 8's open
      `oauth-e2e.test.ts` negative landed here
- [x] Tool descriptions written for the agent doing this job: `tagNames` replaces rather than
      appends, `merge_tags` takes the ids `list_tags` returns, `list_pins { noTags: true }` is
      where a retagging pass starts, and `list_tags { withCounts: true }` is how to find the
      one- and two-pin tags. The description is the only documentation the model reads
- [x] Bulk is the agent looping. `update_pin` one pin at a time is correct for a few hundred
      pins, and `mcpLimiter` is what bounds an agent that loops badly. Raised to 1200 per five
      minutes per IP — four a second — rather than keyed by client, which is not available in
      front of the auth middleware (Decision 24). `apiV1Limiter` stays at 300
- [ ] Drive it with Claude Code over the runbook: reconnect (the step-up), ask it to find tags
      with one pin and propose merges, approve a few, and confirm `/tags` on the site agrees.
      **Still open**: this is a manual run against a real client and a real library, and nothing
      in the suite substitutes for it

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
   back to `127.0.0.1` or `localhost`, and list the scopes the client asked for — `pins:read`,
   `tags:read` and `offline_access` by default. A client that will retag asks for
   `pins:write` and `tags:write` on top, and the screen must describe them as adding, editing
   and deleting bookmarks and as merging and deleting tags: an undescribed scope is one you
   approve without being told what it does. Approve it. The browser lands on a loopback port
   Claude Code is listening on.
5. Back in Claude Code the server reads as connected. Ask it to list your bookmarks.
6. Check the registration took the CIMD path rather than the DCR fallback:
   `select client_id, registration_type from oauth_clients` should show
   `https://claude.ai/oauth/claude-code-client-metadata` and `cimd`. A `dcr_` row instead means
   the metadata document was not selected, and the authorization-server document is where to
   look (`client_id_metadata_document_supported` and `"none"` both have to be advertised).
7. Open `/profile`. The Connected Applications card should name Claude Code, say MCP, list the
   scopes that grant actually carries, and carry today's date. Revoke it and confirm the client
   has to ask again.

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
2. Right-click the acorn → **Options** and type `http://localhost:8100`: an origin, no path,
   which is all `parseBaseUrl` accepts. Connect opens the consent screen in a new tab; approve
   it there, and the tab closes itself. Watch the flow in the service worker's DevTools, not
   the page's — the worker is what runs it, in two halves around the tab.
3. The redirect URI is `http://localhost:8100/oauth/extension/callback`, a page on the server
   that needs no session. The DCR `client_id` is derived from the metadata, so one extension
   dedups to one `oauth_clients` row, and the manifest's `key` fixes the ID, so a second
   checkout is the same row. `/oauth/register` allows ten per IP (or IPv6 /64) per hour, and
   thirty per IPv6 /48.
4. Tick tags, Sync Now, and check the bookmarks bar for a "PinSquirrel" folder. Revoke from
   `/profile` and confirm the options page comes back on Connect with a notice rather than
   failing silently.
5. Click the acorn on any page — or press Alt+D — and check that the pin form opens in a small
   window, that saving closes it, and that a pin on a selected tag turns up in the bookmarks
   bar without a Sync Now.

---

## Key technical decisions

1. **API versioning**: `/api/v1/` path prefix for future compatibility.
2. **Pagination**: page-based, not cursor-based, to match the `Pagination` class in
   `libs/domain/src/entities/pagination.ts`, which carries `totalCount` so an API response can be
   built directly from it.
3. **Existing API separation**: the session-authenticated, frontend-only endpoints live under
   `/api/internal/*`, separate from the public API.
4. **Bookmark sync is one-way**: the sync never writes to PinSquirrel, and a locally deleted
   bookmark comes back on the next run. The extension writing a pin the user asked for (Phase 9)
   is a different thing from the sync inferring one from a bookmark, and the second stays out.
5. **Chrome extension is standalone**: no workspace dependency on other packages; it talks only
   over the HTTP API. Build uses esbuild on its own, outside the Turbo pipeline.
6. **Read-only API until there is a use case**: v1 shipped with GET only. Phase 9 was going to
   add `POST /api/v1/pins` for the extension, but the extension pins over the site's own form
   in a popup window instead (Decision 22), so the API stays read-only until a real API client
   needs a write.
7. **MCP transport**: Streamable HTTP via `@hono/mcp` (`@modelcontextprotocol/hono` does not
   exist as a published package), mounted at `/mcp`, authenticated with OAuth `pso_` tokens
   bound to its own resource identifier (Decision 16). The route builds an `McpServer` and a
   transport per request; a shared transport caps the process at one MCP session and mixes
   responses between concurrent callers by JSON-RPC id.
8. **The MCP tools read and write; the v1 REST API still only reads.** Three reads —
   `list_pins`, `get_pin`, `list_tags` — and five writes: `update_pin`, `create_pin`,
   `delete_pin` behind `pins:write`, `merge_tags` and `delete_tag` behind `tags:write`. The
   writes exist because retagging a library is a concrete agent use case (Phase 10); the REST
   API has no such caller, so Decision 6 stands there. The two surfaces are no longer symmetric,
   and that asymmetry is a use case rather than an oversight.
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
    `offline_access` advertised by the authorization server only. `pins:write` and `tags:write`
    arrive in Phase 8, requested explicitly and never by default. Adding a scope later is easy.
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

17. **The Chrome extension authenticates with authorization code + PKCE, as a public client.**
    Originally through `chrome.identity.launchWebAuthFlow` and its extension-owned callback;
    superseded by decision 26, which moves the consent screen to an ordinary tab. What stands:
    no loopback-port matching, no secret in the extension, `offline_access` so the service
    worker can refresh unattended, and tokens in `chrome.storage.local`. Never
    `chrome.storage.sync`, which replicates across machines and is not a secret store.
18. **The issuer comes from `BASE_URL`.** The `issuer`, the `resource`
    identifiers, the `iss` parameter and the audience check all have to agree on one string that
    a request cannot influence, or a spoofed `Host` header becomes a way to confuse audiences.
    `BASE_URL` is a deployment fact, read once in `apps/hono/src/lib/config.ts` and passed in,
    the way `MailgunEmailService` gets its config. `routes/seo.ts` still derives its origin from
    the request URL, which is fine for a sitemap and must not be copied for anything OAuth
    touches.
19. **A connection is a client, not a client and a resource.** The profile page lists one row
    per client naming every audience it holds, and its Revoke runs by user and client, so it
    takes both. No client uses both audiences. Revocation by token is narrower and follows the
    grant (Decision 39).
20. **Scopes are enforced at the operation, not at the resource.** `requireScope` sits on the
    write routes and inside the write tools, so a read-only token still reads everything
    (narrowed by Decision 43: each read now needs its own read scope). A
    resource-level check would either lock reads behind write or make the scope decorative,
    which is what it is today. The challenge is RFC 6750's `insufficient_scope`, and step-up is
    the client re-authorizing with the wider scope: no server-side upgrade, and the old family
    is left alone because another device may hold it.
21. **Two write scopes, matching the reads.** `pins:write` covers a pin including its tags;
    `tags:write` covers merge and delete of the tag itself. The extension only ever needs the
    first, and a consent screen that asks it to approve "merge and delete your tags" for a
    Save button is asking for more than it uses.
22. **The extension opens the site's pin form; it does not replicate it.** A form rebuilt in
    extension UI is a second implementation that falls behind the first every time the site
    grows a field. Framing the site inside the action popup is off the table — `X-Frame-Options:
SAMEORIGIN`, and a `SameSite=Lax` session cookie is not sent from a `chrome-extension://`
    frame, where relaxing either would weaken the whole site to serve one embed — so the
    extension opens `/pins/new?embed=1` in a popup window: top-level, first-party,
    session-authenticated, no OAuth in the flow. `embed=1` is presentation only; dedup stays
    the route's own `findByUrl` redirect, which in embed mode delivers the site's real edit
    form in the same window.

23. **The MCP write surface is public pins only, and the rule lives in the service.**
    `pinFilterFromInput` forces `isPrivate: false` and `get_pin` goes through `getPublicPin`, so
    an MCP client never sees a private pin. It must not be able to change or delete one either,
    or create one it could not then read back. `PinService.updatePublicPin()` and
    `deletePublicPin()` resolve a pin through the same check the read uses — private, foreign
    and missing all come back as `PinNotFoundError` before anything is written — and neither
    `update_pin` nor `create_pin` has an `isPrivate` field to send. The check sits in the
    service rather than in the tool for the reason CLAUDE.md gives: a transport re-deciding a
    rule is how the REST API once listed private pins, and how the internal check-url endpoint
    ran with no `AccessControl` at all. A private pin stays a thing only the browser session
    can touch.

24. **`/mcp` gets four requests a second per IP, and a duplicate URL names the pin it collided
    with.** Two decisions the write tools forced, both about an agent that cannot ask a person
    what went wrong. `mcpLimiter` went from 300 per five minutes to 1200: bulk here is the agent
    looping, one `update_pin` per pin plus the reads around it, and one request a second stalls
    a few-hundred-pin retag halfway through. Keying by client instead was the alternative and is
    not available — `rateLimitByIp(mcpLimiter)` runs in front of the auth middleware, so there
    is no client id yet, and moving it behind auth would make an unauthenticated flood free. One
    IP here is one user's agent. `apiV1Limiter` stays at 300. Separately, `DuplicatePinError`
    now maps to a tool error pointing at `update_pin` instead of collapsing to "internal server
    error", which an agent answers by retrying a call that can never succeed. It names the
    existing pin's id only when that pin is public. The duplicate lookup is scoped to the user
    but not to what this surface may see, so the collision can be a private pin — one that
    `get_pin`, `update_pin` and `delete_pin` all report as missing — and naming it would hand
    back an identifier for a pin the caller is told everywhere else does not exist. That is why
    `DuplicatePinError.existingPin` carries `isPrivate`, and why an absent flag is read as
    unnameable. The collision itself is still reported on the private path: the URL was the
    caller's own input, and a silent failure or a fake success sends the agent round in circles.
    Existence is disclosed there and the id is not, deliberately.

25. **The Chrome extension is versioned on its own.** It is its own release-please package
    (`apps/chrome-extension`, tagged `chrome-extension-vX.Y.Z`, own `CHANGELOG.md`), and the
    root package excludes that path, so a commit that only touches the extension does not cut
    a site release and a site release does not bump the extension. This reverses the earlier
    choice to bump the manifest with every release: the manifest version is what the Chrome
    Web Store shows and what a new upload is judged against, so a version that moved without
    the code moving was noise for users and a review for nothing. The extension's first solo
    release is 1.0.0, which is what the store sees first, set with a `Release-As` footer on
    the commit that reset its version; the site carries on from 3.6.0. `pnpm extension:package`
    names the zip after the manifest, so the store upload and the tag agree. Distribution is
    the GitHub release itself: the `extension-zip` job attaches the zip to each
    `chrome-extension-v*` release, and users drop it on `chrome://extensions` in developer
    mode. The Chrome Web Store is not part of the plan — a store review is a gate that can
    stay shut indefinitely, and the site's waitlist already decides who can use the thing.
    The manifest's `key` pins the extension ID so every install is one OAuth client.

26. **The extension's consent screen is an ordinary tab, and the redirect URI is a page on the
    server.** `chrome.identity.launchWebAuthFlow` opens a window no other extension may touch,
    so 1Password showed its icon there and could not fill anything, and the user had to type a
    password to connect a bookmarking extension. The worker now opens `/oauth/authorize` with
    `chrome.tabs.create`, the redirect URI is `<baseUrl>/oauth/extension/callback` (the server
    only accepts `https` redirect URIs, so a `chrome-extension://` one was never an option),
    and the worker reads the code off the tab's URL through `tabs.onUpdated` — the same
    mechanism, and the same `host_permissions` dependency, as closing the pin window. A user
    already signed in on the site goes straight to consent, which is most of the point. The
    flow is two calls with storage between them (`startConnect`, `completeConnect`), because
    the worker that opens the tab is unloaded before the user has read the screen. The
    `identity` permission is gone from the manifest. Security is unchanged: PKCE and `state`
    bind the answer to the question, not the window it arrived in.

27. **Sign-in is limited per username as well as per address, and the username limit can lock
    its owner out.** `signinUsernameLimiter` allows 50 failures per 15 minutes per username and
    refuses before the password is checked, so anyone who knows a username can keep its owner
    from signing in, from any address, until the window passes. Existing sessions, the private
    unlock and change-password are unaffected. It was accepted because it bounds password
    guessing spread across many addresses, which the per-address limit cannot see. The known
    mitigation not taken yet is a device cookie set at successful sign-in that exempts that
    browser from the username-wide bucket. Revisit it if lockouts show up in practice.

28. **An email change asks for the current address as well as the password.** The change is
    confirmed by a link sent to the new address, and the old address gets a notice. The
    server cannot read the old address: it keeps a hash and a copy sealed to a key only the
    admin console holds. So the form asks for the current address, checks it against the
    hash, and sends the notice there. An account with no address skips the field. The cost
    is one more field and a refusal for anyone who has forgotten which address they used.
    The alternative was no notice at all.

29. **The stored email hash is keyed when `EMAIL_HASH_KEY` is set, and old rows are re-keyed
    only when used.** A lookup that misses under the keyed hash tries the plain SHA-256 and
    rewrites the row. Only sign-up, password reset and email change look addresses up, so an
    account that never uses them keeps its plain hash. A bulk re-key from the admin console,
    which can open the sealed copies, is the follow-up that closes that gap.

30. **Sign-up and reset requests return once the input is valid.** Lookups, writes and mail
    run afterwards in deferred work that the composition root logs. A registered and an
    unknown address then take the same time and get the same answer, whatever the mail
    provider does. The cost is that a database failure during sign-up is logged instead of
    shown, and the user sees the usual "check your email".
31. **An IP-keyed limit counts an IPv6 caller by its /64.** One subscriber usually holds a
    whole /64, so keying on the full address gave each address its own budget. A provider
    that puts several customers in one /64 makes them share a budget; the per-IP limits are
    loose enough that this should not trip for real users. An IPv4-mapped address counts
    as its IPv4 address.
32. **Revoking a connected application is addressed by the client, not by one token.** The
    profile form posts the client id and the service revokes every live token the user
    holds for it. A token id in the form went stale once the client refreshed and the
    sweep removed that row.
33. **The token endpoint is limited per address only, not per `client_id`.** A `client_id` is
    public and every user of a client shares it, so a budget keyed on it would be one budget
    for all of them. Authorization codes and refresh tokens are 32 random bytes, so a
    per-/64 budget is all each caller needs.
34. **Dynamic client registration is also counted per IPv6 /48, and its metadata is bounded.**
    One site is usually assigned a /48, so `/register` allows ten an hour per /64 and thirty
    an hour per /48, and a registration has to fit both. A registration
    carries at most ten redirect URIs of at most 512 characters each, the width of the
    column an authorization code stores its redirect URI in.
35. **Every client is held to one set of rules, and its identifier is an exact string.** DCR,
    CIMD and static clients all pass `requireClientRules` before a row is written: public
    (`none`) only, the implemented grant types only, and redirect URIs that are https or
    loopback http with no fragment, so a client is held to the same rules whichever way it
    registered. `client_id` is `utf8mb4_bin`
    on `oauth_clients` and on the codes and tokens that reference it, the service ignores a
    row whose id is not exactly the one asked for, and a CIMD `client_id` must be the
    spelling `URL` parsing produces. Client ids are compared byte for byte because two that
    differ only in case or accents can name different documents. The token endpoint never
    fetches a document: a client with no row has no code or token to exchange, so it gets
    `invalid_client` at once. The incomplete-client sweep takes `cimd` rows as well as `dcr`
    ones, since the consent page creates a `cimd` row before anyone approves; a swept client
    is fetched again on its next authorization request.
36. **OAuth follows the same admission rule as the web app.** `isAdmitted` (active, with the
    User role) is checked by `authorize`, by both token exchanges and by `verifyAccessToken`,
    so a token stops working the moment its account stops being admitted. An exchange for an
    account that is not admitted also revokes the account's tokens for that client.
    Revoking the User role ends the account's sessions and tokens, as a password reset does,
    so a suspension also clears what the checks would refuse anyway.
37. **A rotated refresh token is kept until its own expiry.** Presenting a retired token again
    is how a copied refresh chain is noticed, and that needs the row, so the sweep removes
    only expired and revoked tokens. The cost is one row per refresh for up to thirty days.
    A refresh whose retired row is gone or revoked by the time it is rotated issues nothing
    (Decision 41).
38. **An authorization code is written only while the session that approved it exists.** The
    insert runs in a transaction that first reads the session row `FOR SHARE`. A revocation
    that deleted the session first leaves nothing to read, and `authorize` answers
    `access_denied`; one that starts after the read waits for the insert and then deletes the
    new code with the user's other unspent codes. The check is on the approving session rather
    than the user, so a password change, which keeps the changer's own session, still lets
    them authorize afterwards. No schema change was needed. The code exchange is covered
    separately by Decision 41.
39. **A grant has an id, and revocation by token follows it.** A grant is one approval of the
    consent screen. `authorize` makes a `grant_id` when it writes the code, the exchange copies
    it to the access and refresh tokens, and each rotation copies it to the successors. Handing
    a refresh token to `/oauth/revoke`, presenting a refresh token after its rotation, and
    presenting a code a second time as the client it was issued to all revoke that grant
    and no other, so the same application
    on another device, which shares the `client_id`, keeps working. The profile page still
    revokes every grant of a client at once (Decision 19). A grant has no table of its own: a
    column is enough to revoke by, and a table would put a join on every bearer check. Rows
    from before the column have no id. Revoking the grant of such a row takes everything the
    user holds for that client, which is what happened before, and a refresh token without an
    id is given one, with its successors, when it rotates.
40. **A refresh token presented again within 30 seconds of its rotation is refused and nothing
    else happens.** A client that refreshes from two processes, or retries a refresh whose
    response it never received, presents one token twice within moments. The duplicate gets
    `invalid_grant`; the request that rotated the token keeps its new pair. After 30 seconds a
    second presentation revokes the grant, as before. Answering the duplicate with a second
    pair of tokens was rejected: it would leave two live chains from one token. A client whose
    response was lost therefore re-authorizes on that device.
41. **Tokens are written in the transaction that spends the code or retires the refresh token,
    and issuing and revoking take turns on the user's row.** `exchange` and `rotate` each make
    the conditional mark and the inserts one transaction, so a failure partway leaves the
    client a code or a token that still works. Both read the user's row `FOR SHARE` first, and
    every revocation of a user's tokens reads it `FOR UPDATE` before it touches a token. A
    revocation therefore finishes before an issuance, which then finds its code deleted or its
    token revoked, or starts after the issuance commits and takes the new tokens with the rest.
    This closes the window Decision 38 left in the code exchange and replaces the read-back
    after a refresh. A revocation of everything a user holds takes the lock after it deletes
    the sessions, the order in which a code being written takes the two rows.
    A revocation locks only the tokens it changes. It reads the user's token ids through
    `oauth_tokens_user_client_idx` with `FOR UPDATE` and stamps them by primary key, 500 at a
    time. A single `UPDATE ... WHERE user_id = ?` was rejected: once one user holds about a
    fifth of the table MySQL runs it as a scan of the whole table, and the gaps that scan
    locks are the ones another user's refresh inserts its successors into. The index read
    still locks the gap on either side of the user's entries, so the user next in id order
    can wait for the revocation to commit. That wait cannot become a deadlock, because the
    revocation's token statements never wait on another user's rows. The hourly sweep finds
    dead tokens with a read that locks nothing and deletes them by primary key in the same
    batches.
    A transaction that issues (`rotate`, `exchange`, and the code's `create`) and is rolled
    back by InnoDB to break a deadlock runs once more from the start, so it reads the
    session, the code or the token again and still refuses one that was revoked meanwhile.
    Rolled back a second time, it is an error and nothing was written (Decision 46 gives
    the answer the client gets). A revocation also runs once more, and a second deadlock
    there is an error too: a revocation is never reported as done when it was not.
42. **A refresh can narrow the access token, never the grant.** A `scope` on a refresh request
    applies to the access token in that response. The refresh token that replaces the old one
    keeps the scopes the user approved (RFC 6749 section 6) and is always issued, including
    when the request leaves out `offline_access`. A client no longer registered for
    `refresh_token` is refused with `unauthorized_client` before the token is retired.
43. **Each read needs the read scope the consent screen lists.** This narrows Decision 20.
    `list_pins`, `get_pin` and the v1 pin routes need `pins:read`; `list_tags` and
    `GET /api/v1/tags` need `tags:read`. A missing scope gets the same tool error, or the same
    403 `insufficient_scope` response, as a missing write scope. The alternative was to add
    both reads to every grant and list them on the consent screen, which takes the choice
    away from the user. The known clients already ask for both reads: the extension names
    them, and Claude asks for `scopes_supported` or names nothing and gets the default. A
    token granted without a read scope cannot use that read after deploy, and its client has
    to re-authorize with the scope.
44. **A redirect URI is compared as a string, except for a loopback port.** The request's
    `redirect_uri` must be byte-equal to a registered one; on an `http` loopback redirect
    (`localhost`, `127.x.x.x`, `[::1]`) the port may differ, per RFC 8252, though it has to be a
    real port (1-65535). A trailing slash, userinfo, a fragment, a dot segment, an upper-case
    host or an explicit default port no longer matches, so a client has to send what it
    registered. The token exchange requires the exact `redirect_uri` the code was issued to. The
    DCR dedup key is the same string with only a loopback port removed, so two registrations
    share a client only when their redirect URIs would match each other. Registration also
    refuses a redirect URI with userinfo, as it refuses a fragment. Once the redirect URI has
    matched, every later authorization failure, including an ended approving session, is
    redirected to the client as an RFC 6749 error with `state` and `iss`; only a bad
    `client_id`, `redirect_uri` or `state` is shown as a page.
45. **The remaining OAuth review items are settled this way.** A request parameter sent twice
    is `invalid_request`, and a repeated `resource` is `invalid_target`, since a token is bound
    to one resource. `/oauth/revoke` answers `invalid_request` without a token and
    `invalid_grant` for a token issued to a client other than the `client_id` sent; an
    unknown, expired or already revoked token still answers 200, and only a live or rotated
    refresh token takes its grant with it. `client_id` stays optional there, as RFC 6749 lets
    a public client leave it out. A lone `offline_access` is granted with the default read
    scopes, and `offline_access` is dropped for a client not registered for `refresh_token`.
    A token records when its grant was approved (`granted_at`) and the profile shows that
    date. A DCR client registering again restarts the incomplete-client clock, and
    `authorize` marks a client completed before it writes the code. `BASE_URL` must be an
    origin, https in production unless loopback. Static clients cannot be retired from the
    config: dropping one needs its row deleted by hand, which revokes its grants, and a
    `disabled` flag waits for a need.
46. **A token, revocation or approval request whose write was undone answers
    `temporarily_unavailable`.** A write is undone when it loses two deadlocks or when its
    wait for a row lock times out (`ER_LOCK_WAIT_TIMEOUT`). Nothing changed, so the answer
    must be one a client sends again without discarding its code or token. The token
    endpoint answers `503` with `Retry-After: 1` and the body
    `{"error":"temporarily_unavailable"}`; `authorize` redirects with the same code, which
    RFC 6749 4.1.2.1 defines for it. RFC 6749 5.2 has no retryable code for the token
    endpoint, so the choice follows what the clients do. The MCP TypeScript SDK (1.32.2,
    `client/auth.js`) reads the `error` field whatever the status: `invalid_grant` makes it
    drop the stored tokens, `server_error`, an unknown code or a body that is not JSON
    makes it start a new authorization, and any other known code, `temporarily_unavailable`
    among them, is thrown to the caller with the tokens kept. The Chrome extension drops
    its tokens on `invalid_grant` only. A client that reads the status alone sees a `503`.
    `invalid_grant`, the earlier answer, was rejected because it ends a working connection,
    and a plain `500` because the SDK answers it with a new consent.
    The rule covers every write of those requests, the revocations among them. An exchange
    or refresh revokes a grant when a spent code or a rotated token is sent again, or when
    the user is no longer admitted. If that revocation is undone the grant is still live,
    and the request answers `503` and not `invalid_grant`: the client sends the same
    request again, the server finds the same condition, and the revocation runs again.
    `/oauth/revoke` answers the same `503`, on which RFC 7009 2.2.1 has the client assume
    the token still exists and retry.
    A deadlock is run again once, because the rival that won has moved on and the second
    run usually commits at once. A lock wait that timed out is not run again. It has already
    waited `innodb_lock_wait_timeout` (50 seconds by default) behind a lock that is probably
    still held, a second run could double a wait that is already longer than most clients
    allow a request, and the client is told to try again in any case. InnoDB undoes only the
    statement that timed out; the rest of the transaction is rolled back when the error
    leaves Drizzle's transaction callback.
    The repository reports the undone write as a `WriteConflictError` that says which of the
    two it was, `OAuthService` names the code at its token, revocation and approval entry
    points, and the routes log the cause at `warn`, since a `503` does not reach the error
    handler's log. The hourly sweep reads dead tokens 500 at a time, each read starting
    after the last id of the one before, so it holds one batch whatever the backlog.
47. **A password change, a password reset and the removal of the User role commit with the
    revocation they call for, or not at all.** Each used to write the password or remove the
    role and then revoke the sessions and tokens as a second step. A revocation that was
    undone (Decision 46) then left the new password or the suspension in place beside
    sessions, tokens and unused codes that still worked, and a second attempt at a password
    change was refused because the "current password" had already changed. The user
    repository now has `setPasswordAndRevoke` and `removeRoleAndRevoke`, each one
    transaction, and no revocation of a whole account outside them. The order inside is
    that of Decision 41: the sessions, then the lock on the user's row, the tokens, the
    unused codes and the pending email change, and last the password or the role, written
    under that lock. A deadlock runs the whole transaction again once.
    A password reset spends its link in the same transaction, so a reset that does not
    commit leaves the link working and the form can be sent again. Spending the link first
    was rejected: the user would have to ask for a new email after a failure that changed
    nothing. The link is still spent once, since of two requests with one link the second
    waits for the user's row, finds the link gone and is undone.
    An undone change is a `WriteConflictError` to the caller. The profile and reset pages
    answer `503` with `Retry-After: 1` and say that the password was not changed and to try
    again; the admin console says that the role was not revoked, beside any role change the
    same form had already made. Removing the Admin role revokes nothing and stays one
    statement.

## Reference

- [MCP spec: Authorization](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP spec: Client Registration (CIMD vs DCR)](https://modelcontextprotocol.io/specification/draft/basic/authorization/client-registration)
- [Anthropic: Authentication for connectors](https://claude.com/docs/connectors/building/authentication), the Anthropic-specific requirements beyond the spec (callback URLs, latency budgets, CIMD selection rules)
- [Claude Code CIMD redirect_uri port issue #37747](https://github.com/anthropics/claude-code/issues/37747), closed 2026-05-24. Evidence that portless-CIMD loopback matching is easy to get wrong on both sides
