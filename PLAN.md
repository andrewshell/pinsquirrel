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

Everything this plan once tracked as read-only has shipped; the reasoning that outlived the
checklists is in the decision log below. What is open is the write side, driven by two use cases:

1. **Pin the current page from the extension**, so the bookmarklet is no longer the only way to
   create a pin from a browser. Phase 9, by opening the site's own pin form in a popup window —
   no API in the flow.
2. **Let an LLM help retag a library** — the account has many tags holding one or two pins and
   many pins holding no tags, and that is a job for an agent that can read and write over MCP.
   Phase 10.

The second needs a write scope that the server actually enforces, which today it does not:
`oauthAuth` puts the granted scopes on the principal and `mcpAuth` forwards them, and nothing
reads them. That is Phase 8. Phase 9 rides the browser session and depends on neither phase.

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

- [ ] Add both to `SUPPORTED_SCOPES` in `libs/services/src/services/oauth.ts` and to
      `OAUTH_RESOURCE_SCOPES` in `apps/hono/src/lib/config.ts`, so both protected-resource
      documents and both `WWW-Authenticate` challenges advertise them. `DEFAULT_SCOPES` stays
      read-only: a client that names no scope gets no write, and a request for `pins:write` is a
      request the user sees on the consent screen
- [ ] Describe them in `SCOPE_DESCRIPTIONS` (`apps/hono/src/views/pages/oauth-consent.tsx`) in
      the user's words — "Add, edit and delete your bookmarks", "Merge and delete your tags". An
      undescribed scope is one a user approves without being told what it does
- [ ] Enforce. A `requireScope(scope)` next to `oauthAuth` in
      `apps/hono/src/middleware/oauth-auth.ts` that answers `403` with
      `WWW-Authenticate: Bearer error="insufficient_scope", scope="pins:write"` (RFC 6750 §3.1).
      `bearerChallenge()` (`middleware/www-authenticate.ts`) only knows the resource today; give
      it an optional `error` and `scope` so both resources say it the same way. Applied
      per route, never globally, so the reads stay reachable on a read-only token — though with
      Phase 9 no longer adding v1 write routes, the REST half has no consumer yet and the MCP
      guard is the one that matters.
      For MCP, a `requireScope` guard inside the tool handler in `mcp/server.ts`, mapped by
      `mapDomainErrorToMcp()` to a tool error the model can read; the scopes are already on
      `AuthInfo`. A token minted before these scopes existed carries neither and is refused by
      both, which is the point
- [ ] Test the negative in `oauth-e2e.test.ts`: a token granted `pins:read tags:read` gets a
      scope refusal from a write surface, and a token granted `pins:write` gets through. The
      first write surface is now Phase 10's `update_pin` tool, so this test lands alongside it.
      It is the one test that proves the scope is load-bearing rather than decorative
- [ ] Step-up is re-consent, nothing more. A client holding a read-only grant that wants to write
      sends the user back through `/oauth/authorize` naming the wider scope; the server issues a
      new token family and `listGrants` already shows the union per client (Decision 19). No
      server-side "upgrade" path: the `insufficient_scope` challenge is the signal, and the
      client's job is to re-authorize. The old family stays valid until it expires or is
      revoked — revoking it on step-up would break a second device holding the same client

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

- [ ] `embed=1` on `/pins/new` and `/pins/:id/edit` renders the same content in a minimal
      layout — the card and the flash, no header, nav or footer. Any other value, or none, is
      the full page: nothing changes for the site's own users
- [ ] The flag must survive the round trips. A hidden field carries it through the POST so a
      validation error re-renders in embed mode, and the `findByUrl` dedup redirect in
      `routes/pin-routes.tsx` appends it — which is how "already pinned" becomes the site's
      real edit form in the same window instead of a link out
- [ ] Success in embed mode redirects to a stable confirmation page — `/pins/embed/saved`,
      embed layout, "Pin saved" — instead of to `/pins`. Stable URL because the extension
      worker matches on it to close the window (9b); the page only says so, since a page that
      was not script-opened cannot reliably `window.close()` itself. The edit form's save (and
      its delete) redirect the same way when the flag rides along, so no path inside the
      dialog dead-ends on the full site

### 9b. Extension

- [ ] Manifest: drop `default_popup` from the action, add `options_page`, add `activeTab`.
      `chrome.action.onClicked` only fires when the action has no popup, and the click is the
      gesture that grants `activeTab`, which is enough to read the current tab's URL and
      title. Not `tabs`, which is a standing permission over every tab. No `scripting`: the
      meta-description and selection prefill stay bookmarklet features until they are missed
- [ ] Options page: the current popup UI (connect, tag list, Sync Now, disconnect) moves to
      the options page nearly unchanged — `popup.html` and `src/popup/*` relocate, reached by
      right-clicking the acorn → Options or from `chrome://extensions`. Settings are visited
      rarely once tags are chosen; pinning is the everyday action and gets the single click
- [ ] Worker: on `action.onClicked` (the event carries the tab, no query needed), build
      `${baseUrl}/pins/new?url&title&embed=1`, open it with
      `chrome.windows.create({ type: 'popup', width, height })`, and remember the window id. A
      `tabs.onUpdated` listener watches that window for the saved page's URL, closes the window
      with `chrome.windows.remove`, and triggers a bookmark sync, so a pin tagged with a
      selected tag reaches the bookmarks bar without waiting for the hour
- [ ] `commands`: a pin-this-page command with `suggested_key` Alt+D — the convention the
      Delicious extension set and the Pinboard shortcut extensions kept, chosen because Chrome
      reserves Ctrl/Cmd+D for its own bookmark (a user who wants it anyway can rebind at
      `chrome://extensions/shortcuts`). A command grants `activeTab` like an action click, and
      the handler is the same worker path
- [ ] Tests, the same way as before: the options page driven in happy-dom (the popup tests,
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

- [ ] `update_pin` — id plus any of `updatePinDataSchema` — over `PinService.updatePin()`. This
      is the retagging tool: `tagNames` replaces the pin's tags. Requires `pins:write`.
      Annotations: `idempotentHint: true`, no `destructiveHint`
- [ ] `create_pin` and `delete_pin` over `createPin()` / `deletePin()`, because a write scope
      that can edit but not create or delete is a strange one to explain. `delete_pin` carries
      `destructiveHint: true` so a client can confirm before calling. Requires `pins:write`
- [ ] `merge_tags` over `TagService.mergeTags(sourceTagIds, targetTagId)`, which is the
      consolidation primitive: every pin under the sources gets the target and the sources go.
      Requires `tags:write`. `delete_tag` over `deleteTag()` alongside it, `destructiveHint`.
      Note for the tool description: `updatePin` already collects tags left with no pins
      (`collectOrphanedTags`), so retagging a pin away from a singleton tag deletes the tag —
      the agent does not need a delete call for that case
- [ ] Every write tool checks its scope through the Phase 8 guard before touching a service,
      and every error goes through `mapDomainErrorToMcp()` — `ValidationError`, `PinNotFound`,
      `TagNotFound` and the unauthorized errors all have mappings already
- [ ] Tool descriptions written for the agent doing this job: say that `tagNames` replaces, not
      appends; say that `merge_tags` takes ids, which `list_tags` returns; say what
      `list_pins { noTags: true }` is for. The description is the only documentation the model
      reads
- [ ] Bulk is the agent looping. `update_pin` one pin at a time is correct for a few hundred
      pins, and the `/mcp` rate limiter — `mcpLimiter`, 300 requests per five minutes per IP —
      is what bounds an agent that loops badly. That is roughly one pin a second, which a retag
      session over a few hundred pins will hit; either raise it or key it by client, and decide
      before shipping rather than when the first session stalls
- [ ] Drive it with Claude Code over the runbook: reconnect (the step-up), ask it to find tags
      with one pin and propose merges, approve a few, and confirm `/tags` on the site agrees

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
20. **Scopes are enforced at the operation, not at the resource.** `requireScope` sits on the
    write routes and inside the write tools, so a read-only token still reads everything. A
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

## Reference

- [MCP spec: Authorization](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP spec: Client Registration (CIMD vs DCR)](https://modelcontextprotocol.io/specification/draft/basic/authorization/client-registration)
- [Anthropic: Authentication for connectors](https://claude.com/docs/connectors/building/authentication), the Anthropic-specific requirements beyond the spec (callback URLs, latency budgets, CIMD selection rules)
- [Claude Code CIMD redirect_uri port issue #37747](https://github.com/anthropics/claude-code/issues/37747), closed 2026-05-24. Evidence that portless-CIMD loopback matching is easy to get wrong on both sides
