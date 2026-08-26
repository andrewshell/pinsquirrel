import { vi } from 'vitest'

/**
 * A stand-in for the `chrome` global, for the extension code that talks to it.
 *
 * Only the surface this extension actually uses is here: `storage.local`,
 * `storage.sync` (present so a test can prove nothing writes to it), and the
 * two `identity` calls the OAuth flow makes. Anything else is left off on
 * purpose - a test that reaches for it should fail loudly rather than get an
 * empty object back.
 *
 * `vi.unstubAllGlobals()` in an `afterEach` is what undoes it.
 */

/** `chrome.identity.launchWebAuthFlow`, in its promise form. */
export type LaunchWebAuthFlowMock = ReturnType<
  typeof vi.fn<
    (details: chrome.identity.WebAuthFlowDetails) => Promise<string | undefined>
  >
>

/** An in-memory `chrome.storage` area, and the record a test can read. */
export interface StubbedStorageArea {
  /** What the area holds right now, readable and writable from a test. */
  items: Record<string, unknown>
}

/** `chrome.runtime.sendMessage`, in its promise form. */
export type SendMessageMock = ReturnType<
  typeof vi.fn<(message: unknown) => Promise<unknown>>
>

export interface ChromeStub {
  local: StubbedStorageArea
  sync: StubbedStorageArea
  /** Resolves to the redirect URL Chrome would land on. Set per flow. */
  launchWebAuthFlow: LaunchWebAuthFlowMock
  getRedirectURL: ReturnType<typeof vi.fn<() => string>>
  /** What the service worker answers the popup with. Set per test. */
  sendMessage: SendMessageMock
}

/** The callback-free half of `chrome.storage.StorageArea`, backed by an object. */
function storageArea(area: StubbedStorageArea) {
  return {
    get: (keys?: string | string[] | null) => {
      if (keys === undefined || keys === null) {
        return Promise.resolve({ ...area.items })
      }
      const wanted = typeof keys === 'string' ? [keys] : keys
      const found: Record<string, unknown> = {}
      for (const key of wanted) {
        if (key in area.items) found[key] = area.items[key]
      }
      return Promise.resolve(found)
    },
    set: (items: Record<string, unknown>) => {
      Object.assign(area.items, items)
      return Promise.resolve()
    },
    remove: (keys: string | string[]) => {
      for (const key of typeof keys === 'string' ? [keys] : keys) {
        delete area.items[key]
      }
      return Promise.resolve()
    },
    clear: () => {
      for (const key of Object.keys(area.items)) delete area.items[key]
      return Promise.resolve()
    },
  }
}

/**
 * The extension's own callback URL, as Chrome mints it. Tests that assert a
 * `redirect_uri` compare against this.
 */
export const STUB_REDIRECT_URL = 'https://extensionid.chromiumapp.org/'

/** Install the stub on `globalThis.chrome` and hand back its innards. */
export function stubChrome(
  initialLocal: Record<string, unknown> = {}
): ChromeStub {
  const stub: ChromeStub = {
    local: { items: { ...initialLocal } },
    sync: { items: {} },
    launchWebAuthFlow:
      vi.fn<
        (
          details: chrome.identity.WebAuthFlowDetails
        ) => Promise<string | undefined>
      >(),
    getRedirectURL: vi.fn<() => string>(() => STUB_REDIRECT_URL),
    sendMessage: vi.fn<(message: unknown) => Promise<unknown>>(),
  }

  vi.stubGlobal('chrome', {
    storage: {
      local: storageArea(stub.local),
      sync: storageArea(stub.sync),
    },
    identity: {
      launchWebAuthFlow: stub.launchWebAuthFlow,
      getRedirectURL: stub.getRedirectURL,
    },
    runtime: {
      sendMessage: stub.sendMessage,
    },
  })

  return stub
}
