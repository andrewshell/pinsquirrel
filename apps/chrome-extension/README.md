# @pinsquirrel/chrome-extension

Chrome extension that mirrors selected PinSquirrel tags into Chrome bookmark
folders. Sync is one-way: the extension reads `/api/v1` and never writes back,
so a bookmark deleted locally reappears on the next sync.

The extension is **standalone** — it has no `workspace:*` dependency on any
other package in this monorepo and talks to PinSquirrel only over HTTP. Keep it
that way; bundling shared code into a browser extension is what would force a
release of the extension every time a library moves.

## Where the OAuth flow runs

In the service worker, not the popup — even though the popup is what has the Connect
button.

`chrome.identity.launchWebAuthFlow` opens a window, and Chrome destroys the action
popup the moment that window takes focus. A flow started in the popup therefore died
mid-exchange: the server issued the tokens and there was nothing left alive to store
them, so `chrome.storage.local` held only `registeredClients`, the user had a live
grant on their profile, and the popup reopened on Connect every time.

So the popup sends a `ConnectRequest` and the worker runs `connect()`. Nothing is
usually listening when the flow finishes — the popup that asked is gone, and its
`ConnectResponse` lands nowhere — which is fine, because the tokens are in storage by
then and `initPopup` opens on the main view the next time it is opened. The response
is still handled, for the case where the popup happened to survive.

Disconnect stays in the popup: it opens no window, so nothing tears the popup down
part-way through.

## When it syncs

The service worker runs a sync in three situations:

| Trigger                    | When                                              |
| -------------------------- | ------------------------------------------------- |
| `chrome.runtime.onStartup` | Chrome starts and the profile loads the extension |
| `chrome.alarms` — `sync`   | Every 60 minutes, from a repeating alarm          |
| **Sync Now** in the popup  | Whenever the user asks                            |

It also runs the OAuth flow on **Connect**, for the reason above.

The alarm is created on `chrome.runtime.onInstalled` and checked again on
startup — `alarms.get` first, `alarms.create` only if it is missing, because
creating an alarm that already exists restarts its period and would push the
next sync forever forwards. Chrome drops alarms in some profile-reset cases, so
the startup check is what brings one back.

A scheduled sync only runs once the extension is connected — a stored `baseUrl`
_and_ a stored refresh token. Before that there is nothing to sync with, and
running one anyway would write a failure to the popup's status line for a user
who has not connected yet. **Sync Now** always runs, so a broken connection
answers the popup with a reason instead of doing nothing.

Only one sync runs at a time: whichever trigger comes second joins the run
already in flight rather than starting a second pass over the same bookmark
folders. Failures are recorded by `runSync` itself (`lastSyncError` in storage,
shown next time the popup opens); a scheduled sync additionally logs to the
worker's DevTools console, and a manual one comes back to the popup as
`{ ok: false, error }`. A connect is single-flighted the same way, so a second request
cannot open a second consent window.

## Build

```bash
pnpm --filter @pinsquirrel/chrome-extension build
```

esbuild bundles `src/background.ts` and `src/popup.ts` into `dist/`, then
copies `manifest.json`, `popup.html` and the icons alongside them. The copy list
is derived from the manifest (`scripts/manifest-assets.ts`), so an icon added to
`manifest.json` ships without touching the build script.

Set `NODE_ENV=production` to minify and drop the source maps.

## Tests

```bash
pnpm --filter @pinsquirrel/chrome-extension test
```

Vitest runs on the `node` environment. The popup's tests opt into a DOM one
file at a time with `// @vitest-environment happy-dom` at the top, rather than
paying for a DOM in every test in the package. They load the real `popup.html`
through `src/test/popup-dom.ts`, so markup and code cannot drift apart
unnoticed, and stub `chrome` with `src/test/chrome-mock.ts`.

`chrome-mock.ts` carries an in-memory bookmark tree as well as the storage
areas, with a bookmarks bar seeded where Chrome puts one. The sync's tests run
against that rather than against a mock per call, so a reconciliation is judged
by the tree it leaves behind — and by `bookmarks.calls`, which is how "a folder
already in step costs one read and no writes" is asserted.

It also carries the `runtime` and `alarms` events, as stubs holding the
listeners the code registered and a `fire()` that calls them, plus an in-memory
alarm registry. That is how the service worker is driven without a browser to
wake it: the test is the browser.

## Load unpacked

1. Build, so `dist/` exists.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. **Load unpacked**, and pick `apps/chrome-extension/dist` — not the package
   root. The package root has no `background.js`.
4. After a rebuild, hit the reload arrow on the extension's card. Chrome does
   not watch `dist/`.

Note the extension ID Chrome assigns: the OAuth redirect URI is
`https://<extension-id>.chromiumapp.org/`, and it changes if the extension is
removed and re-added.

## Layout

| Path                         | What it is                                                                |
| ---------------------------- | ------------------------------------------------------------------------- |
| `manifest.json`              | Manifest V3: permissions, service worker, popup                           |
| `popup.html`                 | Popup markup and styles; no inline scripts (extension CSP)                |
| `src/background.ts`          | Service worker entry point: hands `initBackground` its real dependencies  |
| `src/background/init.ts`     | The worker itself: startup, the alarm, and the popup's two requests       |
| `src/popup.ts`               | Popup entry point: hands `initPopup` its real dependencies                |
| `src/popup/`                 | The popup itself — `init.ts` wiring, `render.ts` and `format.ts` pure     |
| `src/messages.ts`            | The popup ↔ service worker message contract                               |
| `src/auth.ts`                | OAuth client: connect, refresh, `authorizedFetch`, disconnect             |
| `src/api-client.ts`          | `/api/v1` reads over `authorizedFetch`                                    |
| `src/bookmark-sync.ts`       | Tags to bookmark folders: `syncAll`, and `runSync` for the worker         |
| `src/storage.ts`             | The only module that names `chrome.storage.local`                         |
| `scripts/build.ts`           | esbuild bundle + asset copy                                               |
| `scripts/manifest-assets.ts` | Derives the copy list from the manifest                                   |
| `icons/`                     | The acorn favicon at 16/48/128; 48 and 128 are upscaled from the 32px PNG |

`tsconfig.json` covers `src` and `scripts` as one project. `types` carries
`chrome` (the extension APIs), `node` (for the build script) and
`vitest/globals`; nothing under `src` imports a Node builtin.
