# @pinsquirrel/chrome-extension

Chrome extension that mirrors selected PinSquirrel tags into Chrome bookmark
folders. Sync is one-way: the extension reads `/api/v1` and never writes back,
so a bookmark deleted locally reappears on the next sync.

The extension is **standalone** — it has no `workspace:*` dependency on any
other package in this monorepo and talks to PinSquirrel only over HTTP. Keep it
that way; bundling shared code into a browser extension is what would force a
release of the extension every time a library moves.

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

| Path                         | What it is                                                            |
| ---------------------------- | --------------------------------------------------------------------- |
| `manifest.json`              | Manifest V3: permissions, service worker, popup                       |
| `popup.html`                 | Popup markup and styles; no inline scripts (extension CSP)            |
| `src/background.ts`          | Service worker entry point                                            |
| `src/popup.ts`               | Popup entry point: hands `initPopup` its real dependencies            |
| `src/popup/`                 | The popup itself — `init.ts` wiring, `render.ts` and `format.ts` pure |
| `src/messages.ts`            | The popup ↔ service worker message contract                           |
| `src/auth.ts`                | OAuth client: connect, refresh, `authorizedFetch`, disconnect         |
| `src/api-client.ts`          | `/api/v1` reads over `authorizedFetch`                                |
| `src/bookmark-sync.ts`       | Tags to bookmark folders: `syncAll`, and `runSync` for the worker     |
| `src/storage.ts`             | The only module that names `chrome.storage.local`                     |
| `scripts/build.ts`           | esbuild bundle + asset copy                                           |
| `scripts/manifest-assets.ts` | Derives the copy list from the manifest                               |
| `icons/`                     | Placeholder artwork at 16/48/128, pending real icons                  |

`tsconfig.json` covers `src` and `scripts` as one project. `types` carries
`chrome` (the extension APIs), `node` (for the build script) and
`vitest/globals`; nothing under `src` imports a Node builtin.
