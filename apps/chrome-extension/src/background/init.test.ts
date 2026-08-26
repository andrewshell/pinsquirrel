import { afterEach, describe, expect, it, vi } from 'vitest'
import { SYNC_REQUEST } from '../messages.ts'
import { stubChrome, type ChromeStub } from '../test/chrome-mock.ts'
import { initBackground } from './init.ts'

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
    initBackground({ runSync, logger: recordingLogger() })

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
    initBackground({ runSync, logger: recordingLogger() })

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
    initBackground({ runSync, logger: recordingLogger() })

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
    initBackground({ runSync, logger: recordingLogger() })

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
    initBackground({ runSync, logger: recordingLogger() })

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
    initBackground({ runSync, logger: recordingLogger() })

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
    initBackground({ runSync, logger: recordingLogger() })

    chrome.runtime.onStartup.fire()

    await vi.waitFor(() => {
      expect(runSync).toHaveBeenCalledTimes(1)
    })
  })

  it('does nothing when the extension was never connected', async () => {
    const chrome = stubChrome()
    const runSync = vi.fn(() => Promise.resolve())
    const logger = recordingLogger()
    initBackground({ runSync, logger })

    chrome.runtime.onStartup.fire()
    await flush()

    expect(runSync).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('does nothing when the grant is gone but the server is remembered', async () => {
    const chrome = stubChrome({ baseUrl: 'https://pinsquirrel.com' })
    const runSync = vi.fn(() => Promise.resolve())
    initBackground({ runSync, logger: recordingLogger() })

    chrome.runtime.onStartup.fire()
    await flush()

    expect(runSync).not.toHaveBeenCalled()
  })

  it('swallows a failure the sync has already recorded, and says so', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.reject(new Error('The server is down')))
    const logger = recordingLogger()
    initBackground({ runSync, logger })

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
    initBackground({
      runSync: vi.fn(() => Promise.resolve()),
      logger: recordingLogger(),
    })

    chrome.runtime.onInstalled.fire({ reason: 'install' })
    await flush()

    expect(chrome.alarms.created).toEqual([
      { name: 'sync', info: { periodInMinutes: 60 } },
    ])
  })

  it('recreates an alarm that has gone missing, on startup', async () => {
    const chrome = stubChrome(CONNECTED)
    initBackground({
      runSync: vi.fn(() => Promise.resolve()),
      logger: recordingLogger(),
    })

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
    initBackground({
      runSync: vi.fn(() => Promise.resolve()),
      logger: recordingLogger(),
    })

    chrome.runtime.onStartup.fire()
    await flush()

    expect(chrome.alarms.created).toEqual([])
  })

  it('syncs when the alarm fires', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground({ runSync, logger: recordingLogger() })

    chrome.alarms.onAlarm.fire({ name: 'sync', scheduledTime: Date.now() })

    await vi.waitFor(() => {
      expect(runSync).toHaveBeenCalledTimes(1)
    })
  })

  it('ignores an alarm that is not this one', async () => {
    const chrome = stubChrome(CONNECTED)
    const runSync = vi.fn(() => Promise.resolve())
    initBackground({ runSync, logger: recordingLogger() })

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
    initBackground({ runSync, logger: recordingLogger() })

    chrome.alarms.onAlarm.fire({ name: 'sync', scheduledTime: Date.now() })
    await flush()

    expect(runSync).not.toHaveBeenCalled()
  })
})
