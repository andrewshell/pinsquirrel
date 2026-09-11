import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReauthorizationRequiredError } from '../auth.ts'
import { SYNC_REQUEST } from '../messages.ts'
import { stubChrome, type ChromeStub } from '../test/chrome-mock.ts'
import { initBackground, type BackgroundDeps } from './init.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Where `startConnect` sends the user to consent. */
const CONSENT_URL = 'https://pinsquirrel.com/oauth/authorize?client_id=dcr_1'

/** The flow `startConnect` leaves in storage while the tab is open. */
const PENDING = {
  baseUrl: 'https://pinsquirrel.com',
  clientId: 'dcr_1',
  redirectUri: 'https://pinsquirrel.com/oauth/extension/callback',
  state: 's1',
  verifier: 'v1',
  endpoints: {
    resource: 'https://pinsquirrel.com/api/v1',
    issuer: 'https://pinsquirrel.com',
    authorizationEndpoint: 'https://pinsquirrel.com/oauth/authorize',
    tokenEndpoint: 'https://pinsquirrel.com/oauth/token',
    registrationEndpoint: 'https://pinsquirrel.com/oauth/register',
    revocationEndpoint: 'https://pinsquirrel.com/oauth/revoke',
  },
}

/** The URL the consent tab lands on once the user approves. */
const CALLBACK_URL = `${PENDING.redirectUri}?code=c1&state=s1`

/** Storage as it looks once the user has connected. */
const CONNECTED = {
  baseUrl: 'https://pinsquirrel.com',
  clientId: 'client-1',
  accessToken: 'pso_access',
  refreshToken: 'pso_refresh',
  expiresAt: Date.now() + 3_600_000,
}

/** A logger that records instead of writing to the console. */
function recordingLogger() {
  return { warn: vi.fn<(message: string) => void>() }
}

/**
 * The worker's dependencies, with only the ones a test cares about named.
 *
 * Every one of them is something the worker cannot do for real under test, so
 * a test that says nothing about a dependency still has to be handed one that
 * succeeds quietly.
 */
function deps(overrides: Partial<BackgroundDeps> = {}): BackgroundDeps {
  return {
    runSync: vi.fn(() => Promise.resolve()),
    startConnect: vi.fn(() => Promise.resolve(CONSENT_URL)),
    completeConnect: vi.fn(() =>
      Promise.resolve({ status: 'connected' as const })
    ),
    cancelConnect: vi.fn(() => Promise.resolve()),
    logger: recordingLogger(),
    ...overrides,
  }
}

/**
 * Deliver a message the way Chrome does, and hand back both halves of the
 * answer: what the listener returned - `true` keeps the channel open - and the
 * `sendResponse` it will eventually call.
 */
function deliver(chrome: ChromeStub, message: unknown = SYNC_REQUEST) {
  const sendResponse = vi.fn<(response?: unknown) => void>()
  const kept = chrome.runtime.onMessage.fire(message, {}, sendResponse)
  return { kept, sendResponse }
}

describe("initBackground: the options page's sync request", () => {
  it('runs a sync and answers that it worked', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    const { kept, sendResponse } = deliver(chrome)

    expect(kept).toEqual([true])
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })
    expect(runSync).toHaveBeenCalledTimes(1)
  })

  it('answers a failed sync with the reason, rather than rejecting', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.reject(new Error('Tag not found')))
    initBackground(deps({ runSync }))

    const { sendResponse } = deliver(chrome)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        error: 'Tag not found',
      })
    })
  })

  it('leaves a message it does not recognise alone', () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    const { kept, sendResponse } = deliver(chrome, { type: 'something-else' })

    expect(kept).toEqual([false])
    expect(sendResponse).not.toHaveBeenCalled()
    expect(runSync).not.toHaveBeenCalled()
  })
})

/** A promise a test settles when it wants to, standing for a slow sync. */
function deferred() {
  let settle!: (outcome: PromiseLike<void> | void) => void
  const promise = new Promise<void>(resolve => {
    settle = resolve
  })
  return {
    promise,
    resolve: () => {
      settle()
    },
    reject: (error: Error) => {
      settle(Promise.reject(error))
    },
  }
}

describe('initBackground: one sync at a time', () => {
  it('joins the sync already running instead of starting a second', async () => {
    const chrome = stubChrome(CONNECTED)
    const running = deferred()
    const runSync = vi.fn(() => running.promise)
    initBackground(deps({ runSync }))

    const first = deliver(chrome)
    const second = deliver(chrome)

    expect(runSync).toHaveBeenCalledTimes(1)
    running.resolve()
    await vi.waitFor(() => {
      expect(first.sendResponse).toHaveBeenCalledWith({ ok: true })
      expect(second.sendResponse).toHaveBeenCalledWith({ ok: true })
    })
  })

  it('hands every joiner the same failure', async () => {
    const chrome = stubChrome(CONNECTED)
    const running = deferred()
    const runSync = vi.fn(() => running.promise)
    initBackground(deps({ runSync }))

    const first = deliver(chrome)
    const second = deliver(chrome)
    running.reject(new Error('The server is down'))

    const failure = { ok: false, error: 'The server is down' }
    await vi.waitFor(() => {
      expect(first.sendResponse).toHaveBeenCalledWith(failure)
      expect(second.sendResponse).toHaveBeenCalledWith(failure)
    })
  })

  it('starts a fresh sync once the last one has finished', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    const first = deliver(chrome)
    await vi.waitFor(() => {
      expect(first.sendResponse).toHaveBeenCalledWith({ ok: true })
    })
    deliver(chrome)

    expect(runSync).toHaveBeenCalledTimes(2)
  })
})

/** Let every pending microtask and timer-zero callback run. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('initBackground: sync on browser startup', () => {
  it('syncs when the extension is connected', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.runtime.onStartup.fire()

    await vi.waitFor(() => {
      expect(runSync).toHaveBeenCalledTimes(1)
    })
  })

  it('does nothing when the extension was never connected', async () => {
    const chrome = stubChrome()
    const runSync = vi.fn(() => Promise.resolve())
    const logger = recordingLogger()
    initBackground(deps({ runSync, logger }))

    chrome.runtime.onStartup.fire()
    await flush()

    expect(runSync).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('does nothing when the grant is gone but the server is remembered', async () => {
    const chrome = stubChrome({ baseUrl: 'https://pinsquirrel.com' })
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.runtime.onStartup.fire()
    await flush()

    expect(runSync).not.toHaveBeenCalled()
  })

  it('swallows a failure the sync has already recorded, and says so', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.reject(new Error('The server is down')))
    const logger = recordingLogger()
    initBackground(deps({ runSync, logger }))

    chrome.runtime.onStartup.fire()

    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('The server is down')
      )
    })
  })
})

describe('initBackground: the periodic sync alarm', () => {
  it('creates the alarm when the extension is installed', async () => {
    const chrome = stubChrome(CONNECTED)
    initBackground(deps())

    chrome.runtime.onInstalled.fire({ reason: 'install' })
    await flush()

    expect(chrome.alarms.created).toEqual([
      { name: 'sync', info: { periodInMinutes: 60 } },
    ])
  })

  it('recreates an alarm that has gone missing, on startup', async () => {
    const chrome = stubChrome(CONNECTED)
    initBackground(deps())

    chrome.runtime.onStartup.fire()
    await flush()

    expect(chrome.alarms.created.map(alarm => alarm.name)).toEqual(['sync'])
  })

  it('leaves an alarm that is already scheduled alone', async () => {
    const chrome = stubChrome(CONNECTED)
    chrome.alarms.existing.set('sync', {
      name: 'sync',
      scheduledTime: Date.now(),
      periodInMinutes: 60,
      persistAcrossSessions: true,
    })
    initBackground(deps())

    chrome.runtime.onStartup.fire()
    await flush()

    expect(chrome.alarms.created).toEqual([])
  })

  it('syncs when the alarm fires', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.alarms.onAlarm.fire({
      name: 'sync',
      scheduledTime: Date.now(),
      persistAcrossSessions: true,
    })

    await vi.waitFor(() => {
      expect(runSync).toHaveBeenCalledTimes(1)
    })
  })

  it('ignores an alarm that is not this one', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.alarms.onAlarm.fire({
      name: 'something-else',
      scheduledTime: Date.now(),
      persistAcrossSessions: true,
    })
    await flush()

    expect(runSync).not.toHaveBeenCalled()
  })

  it('does not sync on the alarm while the extension is unconnected', async () => {
    const chrome = stubChrome()
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.alarms.onAlarm.fire({
      name: 'sync',
      scheduledTime: Date.now(),
      persistAcrossSessions: true,
    })
    await flush()

    expect(runSync).not.toHaveBeenCalled()
  })
})

/** The connect request, as the options page sends it. */
const CONNECT_REQUEST = { type: 'connect', baseUrl: 'https://pinsquirrel.com' }

/** The id the mock hands the first tab the worker creates. */
const CONSENT_TAB_ID = 500

/** The consent tab has navigated to `url`, as Chrome reports it. */
function consentTabNavigated(
  url: string,
  tabId = CONSENT_TAB_ID
): [number, chrome.tabs.OnUpdatedInfo, chrome.tabs.Tab] {
  return [tabId, { status: 'loading', url }, tab({ id: tabId, url })]
}

/** Every `connect-finished` the worker sent to the options page. */
function finished(chrome: ChromeStub): unknown[] {
  return chrome.sendMessage.mock.calls
    .map(([message]) => message)
    .filter(
      message =>
        typeof message === 'object' &&
        message !== null &&
        (message as { type?: unknown }).type === 'connect-finished'
    )
}

describe("initBackground: the options page's connect request", () => {
  it('opens the consent screen in a tab and answers once it is open', async () => {
    const chrome = stubChrome()
    const startConnect = vi.fn(() => Promise.resolve(CONSENT_URL))
    initBackground(deps({ startConnect }))

    const { kept, sendResponse } = deliver(chrome, CONNECT_REQUEST)

    expect(kept).toEqual([true])
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })
    expect(startConnect).toHaveBeenCalledWith('https://pinsquirrel.com')
    // An ordinary tab, not `launchWebAuthFlow`'s window: that window forbids
    // other extensions, so a password manager could not sign the user in.
    expect(chrome.tabs.created).toEqual([{ url: CONSENT_URL }])
    expect(chrome.local.items.connectTabId).toBe(CONSENT_TAB_ID)
  })

  it('answers a flow that could not start with the reason, rather than rejecting', async () => {
    const chrome = stubChrome()
    const startConnect = vi.fn(() =>
      Promise.reject(new Error('Discovery failed'))
    )
    initBackground(deps({ startConnect }))

    const { sendResponse } = deliver(chrome, CONNECT_REQUEST)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        error: 'Discovery failed',
      })
    })
    expect(chrome.tabs.created).toEqual([])
  })

  it('does not sync when the options page asked to connect', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    deliver(chrome, CONNECT_REQUEST)
    await flush()

    expect(runSync).not.toHaveBeenCalled()
  })

  it('opens a second tab for a second Connect and watches the newer one', async () => {
    const chrome = stubChrome()
    initBackground(deps())

    deliver(chrome, CONNECT_REQUEST)
    deliver(chrome, CONNECT_REQUEST)
    await flush()

    expect(chrome.tabs.created).toHaveLength(2)
    expect(chrome.local.items.connectTabId).toBe(CONSENT_TAB_ID + 1)
  })
})

describe('initBackground: the consent tab answering', () => {
  /** Storage as the worker that opened the tab left it - possibly long gone. */
  const WAITING = { pendingConnect: PENDING, connectTabId: CONSENT_TAB_ID }

  it('finishes the flow, closes the tab, and tells the options page', async () => {
    const chrome = stubChrome(WAITING)
    const completeConnect = vi.fn(() =>
      Promise.resolve({ status: 'connected' as const })
    )
    initBackground(deps({ completeConnect }))

    chrome.tabs.onUpdated.fire(...consentTabNavigated(CALLBACK_URL))
    await flush()

    expect(completeConnect).toHaveBeenCalledWith(CALLBACK_URL)
    expect(chrome.tabs.removed).toEqual([CONSENT_TAB_ID])
    expect(chrome.local.items.connectTabId).toBeUndefined()
    expect(finished(chrome)).toEqual([
      { type: 'connect-finished', result: { ok: true } },
    ])
  })

  it('ignores navigation in a tab that is not the consent tab', async () => {
    const chrome = stubChrome(WAITING)
    const completeConnect = vi.fn(() =>
      Promise.resolve({ status: 'connected' as const })
    )
    initBackground(deps({ completeConnect }))

    chrome.tabs.onUpdated.fire(...consentTabNavigated(CALLBACK_URL, 999))
    await flush()

    expect(completeConnect).not.toHaveBeenCalled()
    expect(chrome.tabs.removed).toEqual([])
  })

  it('ignores the consent tab until it reaches the callback', async () => {
    const chrome = stubChrome(WAITING)
    const completeConnect = vi.fn(() =>
      Promise.resolve({ status: 'connected' as const })
    )
    initBackground(deps({ completeConnect }))

    chrome.tabs.onUpdated.fire(...consentTabNavigated(CONSENT_URL))
    chrome.tabs.onUpdated.fire(
      ...consentTabNavigated('https://pinsquirrel.com/signin?redirectTo=x')
    )
    await flush()

    expect(completeConnect).not.toHaveBeenCalled()
  })

  it('does nothing when no flow is waiting', async () => {
    const chrome = stubChrome()
    const completeConnect = vi.fn(() =>
      Promise.resolve({ status: 'connected' as const })
    )
    initBackground(deps({ completeConnect }))

    chrome.tabs.onUpdated.fire(...consentTabNavigated(CALLBACK_URL))
    await flush()

    expect(completeConnect).not.toHaveBeenCalled()
  })

  it('finishes once, though Chrome reports one navigation twice', async () => {
    const chrome = stubChrome(WAITING)
    const completeConnect = vi.fn(() =>
      Promise.resolve({ status: 'connected' as const })
    )
    initBackground(deps({ completeConnect }))

    chrome.tabs.onUpdated.fire(...consentTabNavigated(CALLBACK_URL))
    chrome.tabs.onUpdated.fire(
      CONSENT_TAB_ID,
      { status: 'complete' },
      tab({ id: CONSENT_TAB_ID, url: CALLBACK_URL })
    )
    await flush()

    expect(completeConnect).toHaveBeenCalledTimes(1)
    expect(chrome.tabs.removed).toEqual([CONSENT_TAB_ID])
  })

  it('sends the same tab to a fresh consent when the registration was stale', async () => {
    const chrome = stubChrome(WAITING)
    const again = `${CONSENT_URL}&attempt=2`
    const completeConnect = vi.fn(() =>
      Promise.resolve({ status: 'restart' as const, url: again })
    )
    initBackground(deps({ completeConnect }))

    chrome.tabs.onUpdated.fire(...consentTabNavigated(CALLBACK_URL))
    await flush()

    expect(chrome.tabs.updated).toEqual([
      { tabId: CONSENT_TAB_ID, properties: { url: again } },
    ])
    expect(chrome.tabs.removed).toEqual([])
    expect(chrome.local.items.connectTabId).toBe(CONSENT_TAB_ID)
    expect(finished(chrome)).toEqual([])
  })

  it('leaves the tab open, showing the reason, when the flow fails', async () => {
    const chrome = stubChrome(WAITING)
    const completeConnect = vi.fn(() =>
      Promise.reject(new Error('stubbed access_denied'))
    )
    initBackground(deps({ completeConnect }))

    chrome.tabs.onUpdated.fire(...consentTabNavigated(CALLBACK_URL))
    await flush()

    expect(chrome.tabs.removed).toEqual([])
    expect(chrome.local.items.connectTabId).toBeUndefined()
    expect(finished(chrome)).toEqual([
      {
        type: 'connect-finished',
        result: { ok: false, error: 'stubbed access_denied' },
      },
    ])
  })

  it('flags a dead grant, which does not survive the channel as a class', async () => {
    const chrome = stubChrome(WAITING)
    const completeConnect = vi.fn(() =>
      Promise.reject(new ReauthorizationRequiredError('invalid_grant'))
    )
    initBackground(deps({ completeConnect }))

    chrome.tabs.onUpdated.fire(...consentTabNavigated(CALLBACK_URL))
    await flush()

    expect(finished(chrome)).toEqual([
      {
        type: 'connect-finished',
        result: {
          ok: false,
          error: 'invalid_grant',
          reauthorizationRequired: true,
        },
      },
    ])
  })

  it('still finishes when nobody is listening for the answer', async () => {
    const chrome = stubChrome(WAITING)
    chrome.sendMessage.mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.')
    )
    initBackground(deps())

    chrome.tabs.onUpdated.fire(...consentTabNavigated(CALLBACK_URL))
    await flush()

    expect(chrome.tabs.removed).toEqual([CONSENT_TAB_ID])
    expect(chrome.local.items.connectTabId).toBeUndefined()
  })

  it('forgets the flow when the consent tab is closed unanswered', async () => {
    const chrome = stubChrome(WAITING)
    const cancelConnect = vi.fn(() => Promise.resolve())
    initBackground(deps({ cancelConnect }))

    chrome.tabs.onRemoved.fire(CONSENT_TAB_ID, {
      windowId: 1,
      isWindowClosing: false,
    })
    await flush()

    expect(cancelConnect).toHaveBeenCalledTimes(1)
    expect(chrome.local.items.connectTabId).toBeUndefined()
    expect(finished(chrome)).toEqual([
      {
        type: 'connect-finished',
        result: {
          ok: false,
          error: 'The sign-in tab was closed before connecting',
        },
      },
    ])
  })

  it('leaves the flow alone when some other tab is closed', async () => {
    const chrome = stubChrome(WAITING)
    const cancelConnect = vi.fn(() => Promise.resolve())
    initBackground(deps({ cancelConnect }))

    chrome.tabs.onRemoved.fire(999, { windowId: 1, isWindowClosing: false })
    await flush()

    expect(cancelConnect).not.toHaveBeenCalled()
    expect(chrome.local.items.connectTabId).toBe(CONSENT_TAB_ID)
  })
})

/**
 * A tab as the click and the command events hand one over.
 *
 * Only `url`, `title` and `windowId` are ever read; the rest is what
 * `chrome.tabs.Tab` insists on and stands for nothing.
 */
function tab(overrides: Partial<chrome.tabs.Tab> = {}): chrome.tabs.Tab {
  return {
    id: 7,
    index: 0,
    windowId: 1,
    url: 'https://example.com/article',
    title: 'An article',
    active: true,
    pinned: false,
    highlighted: true,
    selected: true,
    incognito: false,
    discarded: false,
    frozen: false,
    autoDiscardable: true,
    groupId: -1,
    lastAccessed: 0,
    ...overrides,
  }
}

describe('initBackground: pinning the current page', () => {
  it("opens the site's own pin form, prefilled, as a popup window", async () => {
    const chrome = stubChrome(CONNECTED)
    initBackground(deps())

    chrome.action.onClicked.fire(tab())
    await flush()

    expect(chrome.windows.created).toEqual([
      {
        url:
          'https://pinsquirrel.com/pins/new' +
          '?url=https%3A%2F%2Fexample.com%2Farticle&title=An+article&embed=1',
        type: 'popup',
        width: 520,
        height: 680,
      },
    ])
  })

  it('leaves out a field the tab does not have', async () => {
    const chrome = stubChrome(CONNECTED)
    initBackground(deps())

    chrome.action.onClicked.fire(tab({ title: undefined }))
    await flush()

    expect(chrome.windows.created[0]?.url).toBe(
      'https://pinsquirrel.com/pins/new' +
        '?url=https%3A%2F%2Fexample.com%2Farticle&embed=1'
    )
  })

  it('remembers the window in storage, which outlives the worker', async () => {
    const chrome = stubChrome(CONNECTED)
    initBackground(deps())

    chrome.action.onClicked.fire(tab())
    await flush()

    expect(chrome.local.items.pinWindowId).toBe(100)
  })
})

describe('initBackground: pinning with nowhere to pin to', () => {
  it('sends the user to the options page instead of opening a window', async () => {
    const chrome = stubChrome()
    initBackground(deps())

    chrome.action.onClicked.fire(tab())
    await flush()

    expect(chrome.openOptionsPage).toHaveBeenCalledTimes(1)
    expect(chrome.windows.created).toEqual([])
    expect(chrome.local.items.pinWindowId).toBeUndefined()
  })
})

/** The window the pin form was opened in, as storage remembers it. */
const PIN_WINDOW_ID = 100

/** Storage as it looks with a pin window open. */
const PINNING = { ...CONNECTED, pinWindowId: PIN_WINDOW_ID }

/** The saved page, as the pin form redirects to it in embed mode (9a). */
const SAVED_URL = 'https://pinsquirrel.com/pins/embed/saved'

/** A navigation in the pin window, the way Chrome reports one. */
function navigated(
  url: string | undefined,
  windowId = PIN_WINDOW_ID
): [number, chrome.tabs.OnUpdatedInfo, chrome.tabs.Tab] {
  return [
    7,
    url === undefined ? { status: 'complete' } : { url },
    tab({ windowId, url }),
  ]
}

describe('initBackground: the pin window reaching the saved page', () => {
  it('closes the window and forgets it', async () => {
    const chrome = stubChrome(PINNING)
    initBackground(deps())

    chrome.tabs.onUpdated.fire(...navigated(SAVED_URL))
    await flush()

    expect(chrome.windows.removed).toEqual([PIN_WINDOW_ID])
    expect(chrome.local.items.pinWindowId).toBeUndefined()
  })

  it('syncs, so a pin on a selected tag reaches the bookmarks bar', async () => {
    const chrome = stubChrome(PINNING)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.tabs.onUpdated.fire(...navigated(SAVED_URL))

    await vi.waitFor(() => {
      expect(runSync).toHaveBeenCalledTimes(1)
    })
  })

  it('does not sync when there is no grant to sync over', async () => {
    const chrome = stubChrome({
      baseUrl: 'https://pinsquirrel.com',
      pinWindowId: PIN_WINDOW_ID,
    })
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.tabs.onUpdated.fire(...navigated(SAVED_URL))
    await flush()

    expect(chrome.windows.removed).toEqual([PIN_WINDOW_ID])
    expect(runSync).not.toHaveBeenCalled()
  })

  it('reads the URL off the tab when the change did not carry one', async () => {
    const chrome = stubChrome(PINNING)
    initBackground(deps())

    chrome.tabs.onUpdated.fire(
      7,
      { status: 'complete' },
      tab({
        windowId: PIN_WINDOW_ID,
        url: SAVED_URL,
      })
    )
    await flush()

    expect(chrome.windows.removed).toEqual([PIN_WINDOW_ID])
  })

  it('leaves the window alone while the form is still open', async () => {
    const chrome = stubChrome(PINNING)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.tabs.onUpdated.fire(
      ...navigated('https://pinsquirrel.com/pins/new?embed=1')
    )
    await flush()

    expect(chrome.windows.removed).toEqual([])
    expect(chrome.local.items.pinWindowId).toBe(PIN_WINDOW_ID)
    expect(runSync).not.toHaveBeenCalled()
  })

  it('ignores the saved page reached in a window it is not watching', async () => {
    const chrome = stubChrome(PINNING)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.tabs.onUpdated.fire(...navigated(SAVED_URL, 42))
    await flush()

    expect(chrome.windows.removed).toEqual([])
    expect(chrome.local.items.pinWindowId).toBe(PIN_WINDOW_ID)
    expect(runSync).not.toHaveBeenCalled()
  })

  it('ignores an update with no pin window open at all', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.tabs.onUpdated.fire(...navigated(SAVED_URL))
    await flush()

    expect(chrome.windows.removed).toEqual([])
    expect(runSync).not.toHaveBeenCalled()
  })
})

/**
 * Collect the unhandled rejections raised while `work` runs.
 *
 * A `void somePromise()` that rejects is invisible to an assertion on what the
 * worker did - the worker carries on and the test passes - so the rejection
 * itself has to be what is asserted on.
 */
async function unhandledRejectionsDuring(
  work: () => Promise<void>
): Promise<unknown[]> {
  const caught: unknown[] = []
  const onUnhandled = (reason: unknown) => caught.push(reason)
  process.on('unhandledRejection', onUnhandled)
  try {
    await work()
    // An unhandled rejection is reported a turn after it is raised.
    await flush()
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }
  return caught
}

describe('initBackground: one navigation, two tab updates', () => {
  /**
   * Chrome reports a navigation twice: `{ status: 'loading', url }` when it
   * starts and `{ status: 'complete' }` with the URL on the tab when it
   * finishes. `onPinWindowUpdated` matches both by design - either one alone
   * has to be enough - so the saved page, which is tiny, can deliver the
   * second before the first has finished its storage and window round trips.
   */
  it('closes the window once and syncs once', async () => {
    const chrome = stubChrome(PINNING)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    const unhandled = await unhandledRejectionsDuring(async () => {
      chrome.tabs.onUpdated.fire(
        7,
        { status: 'loading', url: SAVED_URL },
        tab({ windowId: PIN_WINDOW_ID, url: SAVED_URL })
      )
      chrome.tabs.onUpdated.fire(
        7,
        { status: 'complete' },
        tab({ windowId: PIN_WINDOW_ID, url: SAVED_URL })
      )
      await flush()
    })

    expect(chrome.windows.removed).toEqual([PIN_WINDOW_ID])
    expect(runSync).toHaveBeenCalledTimes(1)
    expect(unhandled).toEqual([])
    expect(chrome.local.items.pinWindowId).toBeUndefined()
  })
})

describe('initBackground: the pin-page keyboard shortcut', () => {
  it('takes the same path as a click on the acorn', async () => {
    const chrome = stubChrome(CONNECTED)
    initBackground(deps())

    chrome.commands.onCommand.fire('pin-page', tab())
    await flush()

    expect(chrome.windows.created.map(window => window.url)).toEqual([
      'https://pinsquirrel.com/pins/new' +
        '?url=https%3A%2F%2Fexample.com%2Farticle&title=An+article&embed=1',
    ])
  })

  it('ignores a command that is not this one', async () => {
    const chrome = stubChrome(CONNECTED)
    initBackground(deps())

    chrome.commands.onCommand.fire('something-else', tab())
    await flush()

    expect(chrome.windows.created).toEqual([])
  })

  it('does nothing when Chrome sends no tab with the command', async () => {
    const chrome = stubChrome(CONNECTED)
    initBackground(deps())

    chrome.commands.onCommand.fire('pin-page', undefined)
    await flush()

    expect(chrome.windows.created).toEqual([])
  })
})

describe('initBackground: the pin window closed without saving', () => {
  it('forgets a window the user shut on their way past', async () => {
    const chrome = stubChrome(PINNING)
    initBackground(deps())

    chrome.windows.onRemoved.fire(PIN_WINDOW_ID)
    await flush()

    expect(chrome.local.items.pinWindowId).toBeUndefined()
  })

  it('does not sync, because nothing was pinned', async () => {
    const chrome = stubChrome(PINNING)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.windows.onRemoved.fire(PIN_WINDOW_ID)
    await flush()

    expect(runSync).not.toHaveBeenCalled()
  })

  it('leaves the pin window alone when some other window closes', async () => {
    const chrome = stubChrome(PINNING)
    initBackground(deps())

    chrome.windows.onRemoved.fire(42)
    await flush()

    expect(chrome.local.items.pinWindowId).toBe(PIN_WINDOW_ID)
  })
})
