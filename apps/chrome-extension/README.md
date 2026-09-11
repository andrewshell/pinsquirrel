# @pinsquirrel/chrome-extension

Chrome extension that mirrors selected PinSquirrel tags into Chrome bookmark
folders. Sync is one-way: the extension reads `/api/v1` and never writes back,
so a bookmark deleted locally reappears on the next sync.

The extension is **standalone** — it has no `workspace:*` dependency on any
other package in this monorepo and talks to PinSquirrel only over HTTP. Keep it
that way; bundling shared code into a browser extension is what would force a
release of the extension every time a library moves.

## Pin this page

Clicking the acorn pins the tab you are on; so does **Alt+D**. There is no
extension form to fill in — the worker opens the site's own
`/pins/new?url&title&embed=1` in a small window, and `embed=1` trims that page to
the card so it reads as a dialog. A field the pin form grows is in the extension
the day it ships on the site, and a page you have already pinned lands on its real
edit form, because that is the route's own dedup redirect.

Not the site framed in extension UI: `X-Frame-Options: SAMEORIGIN` and a
`SameSite=Lax` session cookie mean a frame on a `chrome-extension://` page arrives
logged out, and relaxing either would weaken the whole site to serve one embed. A
popup window is a top-level first-party navigation, so the cookie flows untouched —
and no OAuth is in the flow at all, so pinning needs no grant and a signed-out user
gets the site's own login page.

Saving redirects to `/pins/embed/saved`, which is a stable URL so that the worker
can match on it: it closes the window and runs a sync, so a pin tagged with a
selected tag reaches the bookmarks bar without waiting for the hour. The page cannot
close itself — a page that was not script-opened may not — so it only says the pin
was saved.

Closing the window needs the server to be covered by `host_permissions` in
`manifest.json`. Chrome redacts the URL in `tabs.onUpdated` unless the extension has
a host permission for that page, and `activeTab` does not help — it is granted for
the tab the user clicked on, not for the pin window's own tab. Against a server
outside that list the form opens and pins fine, but the window stays open and no
sync follows the pin. Adding a self-hosted origin means adding it to
`host_permissions`.

The window id lives in `chrome.storage.local`, not in a variable in the worker: MV3
unloads the worker after about thirty seconds idle, and the save comes whenever the
user is done. Clicking again while a window is open opens a second one and watches
the newer.

## Where the OAuth flow runs

In the service worker, not the options page — even though the options page is what
has the Connect button.

`chrome.identity.launchWebAuthFlow` opens a window, and Chrome destroys the action
popup the moment that window takes focus. This UI _was_ the action popup, so a flow
started in it died mid-exchange: the server issued the tokens and there was nothing
left alive to store them, so `chrome.storage.local` held only `registeredClients`,
the user had a live grant on their profile, and the popup reopened on Connect every
time.

So the page sends a `ConnectRequest` and the worker runs `connect()`. An options tab
survives losing focus and usually does hear the `ConnectResponse`, but nothing rests
on that: the tokens are in storage by the time the flow finishes, and `initOptions`
opens on the main view next time the page is opened. That is what made the flow
survivable when nothing was listening at all, and it is why the worker still owns it.

Disconnect stays in the page: it opens no window, so there was never anything to
tear the page down part-way through.

## When it syncs

The service worker runs a sync in four situations:

| Trigger                          | When                                              |
| -------------------------------- | ------------------------------------------------- |
| `chrome.runtime.onStartup`       | Chrome starts and the profile loads the extension |
| `chrome.alarms` — `sync`         | Every 60 minutes, from a repeating alarm          |
| **Sync Now** on the options page | Whenever the user asks                            |
| A pin saved in the pin window    | `/pins/embed/saved` closes the window             |

It also runs the OAuth flow on **Connect**, for the reason above.

The alarm is created on `chrome.runtime.onInstalled` and checked again on
startup — `alarms.get` first, `alarms.create` only if it is missing, because
creating an alarm that already exists restarts its period and would push the
next sync forever forwards. Chrome drops alarms in some profile-reset cases, so
the startup check is what brings one back.

A scheduled sync only runs once the extension is connected — a stored `baseUrl`
_and_ a stored refresh token. Before that there is nothing to sync with, and
running one anyway would write a failure to the options page's status line for a
user who has not connected yet. The sync after a pin takes the same path and skips
for the same reason, which is right: pinning rides the browser session and needs no
grant. **Sync Now** always runs, so a broken connection answers the page with a
reason instead of doing nothing.

Only one sync runs at a time: whichever trigger comes second joins the run
already in flight rather than starting a second pass over the same bookmark
folders. Failures are recorded by `runSync` itself (`lastSyncError` in storage,
shown next time the options page opens); a scheduled sync additionally logs to the
worker's DevTools console, and a manual one comes back to the page as
`{ ok: false, error }`. A connect is single-flighted the same way, so a second request
cannot open a second consent window.

## Build

```bash
pnpm --filter @pinsquirrel/chrome-extension build
```

esbuild bundles `src/background.ts` and `src/options.ts` into `dist/`, then
copies `manifest.json`, `options.html` and the icons alongside them. The copy list
is derived from the manifest (`scripts/manifest-assets.ts`), so an icon added to
`manifest.json` ships without touching the build script.

Set `NODE_ENV=production` to minify, drop the source maps, and write the
release manifest: `scripts/manifest-release.ts` strips every `http://` host
permission, so the dev server's `http://localhost:8100/*` never reaches a user's
install prompt. The checked-in `manifest.json` keeps it for load-unpacked work.

## Package for the Chrome Web Store

```bash
pnpm extension:package
```

Runs a production build and zips the contents of `dist/` into
`release/pinsquirrel-chrome-extension-<version>.zip`, which is the file the
developer dashboard takes. The archive is made from inside `dist/` so that
`manifest.json` sits at its root, which is where the store looks for it. The
version comes from the manifest. The extension is its own release-please
package: only commits under `apps/chrome-extension` bump it, its tags are
`chrome-extension-vX.Y.Z`, and it keeps its own `CHANGELOG.md`, so a site
release leaves the store version alone. Its versions start at 1.0.0, the first
store release. `release/` is git-ignored.

## Tests

```bash
pnpm --filter @pinsquirrel/chrome-extension test
```

Vitest runs on the `node` environment. The options page's tests opt into a DOM one
file at a time with `// @vitest-environment happy-dom` at the top, rather than
paying for a DOM in every test in the package. They load the real `options.html`
through `src/test/options-dom.ts`, so markup and code cannot drift apart
unnoticed, and stub `chrome` with `src/test/chrome-mock.ts`.

`chrome-mock.ts` carries an in-memory bookmark tree as well as the storage
areas, with a bookmarks bar seeded where Chrome puts one. The sync's tests run
against that rather than against a mock per call, so a reconciliation is judged
by the tree it leaves behind — and by `bookmarks.calls`, which is how "a folder
already in step costs one read and no writes" is asserted.

It also carries the `runtime`, `alarms`, `action`, `commands` and `tabs` events, as
stubs holding the listeners the code registered and a `fire()` that calls them, plus
an in-memory alarm registry and a `windows` that records what was opened and closed.
That is how the service worker is driven without a browser to wake it: the test is
the browser.

## Load unpacked

1. Build, so `dist/` exists.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. **Load unpacked**, and pick `apps/chrome-extension/dist` — not the package
   root. The package root has no `background.js`.
4. Right-click the acorn → **Options** to connect and pick tags. The acorn
   itself pins the current page and opens no menu.
5. **Alt+D** does the same as the click, and `chrome://extensions/shortcuts` is
   where it is rebound. Chrome will not give the shortcut away if another
   extension already holds it.
6. After a rebuild, hit the reload arrow on the extension's card. Chrome does
   not watch `dist/`.

Note the extension ID Chrome assigns: the OAuth redirect URI is
`https://<extension-id>.chromiumapp.org/`, and it changes if the extension is
removed and re-added.

## Layout

| Path                          | What it is                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `manifest.json`               | Manifest V3: permissions, service worker, options page, `pin-page`            |
| `options.html`                | Options markup and styles; no inline scripts (extension CSP)                  |
| `src/background.ts`           | Service worker entry point: hands `initBackground` its real dependencies      |
| `src/background/init.ts`      | The worker itself: startup, the alarm, pinning, and the page's requests       |
| `src/options.ts`              | Options entry point: hands `initOptions` its real dependencies                |
| `src/options/`                | The page itself — `init.ts` wiring, `render.ts` and `format.ts` pure          |
| `src/messages.ts`             | The options page ↔ service worker message contract                            |
| `src/auth.ts`                 | OAuth client: connect, refresh, `authorizedFetch`, disconnect                 |
| `src/api-client.ts`           | `/api/v1` reads over `authorizedFetch`                                        |
| `src/bookmark-sync.ts`        | Tags to bookmark folders: `syncAll`, and `runSync` for the worker             |
| `src/storage.ts`              | The only module that names `chrome.storage.local`                             |
| `scripts/build.ts`            | esbuild bundle + asset copy                                                   |
| `scripts/package.ts`          | Zips `dist/` into `release/` for the store                                    |
| `scripts/manifest-assets.ts`  | Derives the copy list from the manifest                                       |
| `scripts/manifest-release.ts` | The shipped manifest and the zip's name                                       |
| `icons/`                      | `acorn.svg` is the source; 48 and 128 are rendered from it, 16 is the favicon |
| `scripts/render-icons.swift`  | Renders the SVG to the 48 and 128 PNGs: `swift scripts/render-icons.swift`    |

`tsconfig.json` covers `src` and `scripts` as one project. `types` carries
`chrome` (the extension APIs), `node` (for the build script) and
`vitest/globals`; nothing under `src` imports a Node builtin.
