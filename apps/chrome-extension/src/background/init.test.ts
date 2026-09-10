import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReauthorizationRequiredError } from '../auth.ts'
import { SYNC_REQUEST } from '../messages.ts'
import { stubChrome, type ChromeStub } from '../test/chrome-mock.ts'
import { initBackground, type BackgroundDeps } from './init.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

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
    connect: vi.fn(() => Promise.resolve()),
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

describe("initBackground: the options page's connect request", () => {
  it('runs the OAuth flow against the server the options page named', async () => {
    const chrome = stubChrome()
    const connect = vi.fn(() => Promise.resolve())
    initBackground(deps({ connect }))

    const { kept, sendResponse } = deliver(chrome, CONNECT_REQUEST)

    expect(kept).toEqual([true])
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })
    expect(connect).toHaveBeenCalledWith('https://pinsquirrel.com')
  })

  it('answers a failed flow with the reason, rather than rejecting', async () => {
    const chrome = stubChrome()
    const connect = vi.fn(() =>
      Promise.reject(new Error('The user closed the window'))
    )
    initBackground(deps({ connect }))

    const { sendResponse } = deliver(chrome, CONNECT_REQUEST)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        error: 'The user closed the window',
      })
    })
  })

  it('flags a dead grant, which does not survive the channel as a class', async () => {
    const chrome = stubChrome()
    const connect = vi.fn(() =>
      Promise.reject(new ReauthorizationRequiredError('invalid_grant'))
    )
    initBackground(deps({ connect }))

    const { sendResponse } = deliver(chrome, CONNECT_REQUEST)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        error: 'invalid_grant',
        reauthorizationRequired: true,
      })
    })
  })

  it('does not sync when the options page asked to connect', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    deliver(chrome, CONNECT_REQUEST)
    await flush()

    expect(runSync).not.toHaveBeenCalled()
  })
})

describe('initBackground: one connect at a time', () => {
  it('joins the flow already running instead of opening a second window', async () => {
    const chrome = stubChrome()
    const running = deferred()
    const connect = vi.fn(() => running.promise)
    initBackground(deps({ connect }))

    const first = deliver(chrome, CONNECT_REQUEST)
    const second = deliver(chrome, CONNECT_REQUEST)

    expect(connect).toHaveBeenCalledTimes(1)
    running.resolve()
    await vi.waitFor(() => {
      expect(first.sendResponse).toHaveBeenCalledWith({ ok: true })
      expect(second.sendResponse).toHaveBeenCalledWith({ ok: true })
    })
  })

  it('starts a fresh flow once the last one has finished', async () => {
    const chrome = stubChrome()
    const connect = vi.fn(() => Promise.resolve())
    initBackground(deps({ connect }))

    const first = deliver(chrome, CONNECT_REQUEST)
    await vi.waitFor(() => {
      expect(first.sendResponse).toHaveBeenCalledWith({ ok: true })
    })
    deliver(chrome, CONNECT_REQUEST)

    expect(connect).toHaveBeenCalledTimes(2)
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
