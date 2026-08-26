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

describe("initBackground: the popup's sync request", () => {
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

    chrome.alarms.onAlarm.fire({ name: 'sync', scheduledTime: Date.now() })

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
    })
    await flush()

    expect(runSync).not.toHaveBeenCalled()
  })

  it('does not sync on the alarm while the extension is unconnected', async () => {
    const chrome = stubChrome()
    const runSync = vi.fn(() => Promise.resolve())
    initBackground(deps({ runSync }))

    chrome.alarms.onAlarm.fire({ name: 'sync', scheduledTime: Date.now() })
    await flush()

    expect(runSync).not.toHaveBeenCalled()
  })
})

/** The connect request, as the popup sends it. */
const CONNECT_REQUEST = { type: 'connect', baseUrl: 'https://pinsquirrel.com' }

describe("initBackground: the popup's connect request", () => {
  it('runs the OAuth flow against the server the popup named', async () => {
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

  it('does not sync when the popup asked to connect', async () => {
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
