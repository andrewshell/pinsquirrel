import { isSyncRequest, type SyncResponse } from '../messages.ts'
import * as storage from '../storage.ts'

/**
 * Where a scheduled sync's failure goes.
 *
 * Injected rather than imported so the tests can read what was said, and so
 * nothing below the entry point names `console` - the service worker's only
 * output is DevTools, and that is a fact about the entry point.
 */
export interface BackgroundLogger {
  warn(message: string): void
}

/** The name of the repeating alarm that drives the background sync. */
const SYNC_ALARM = 'sync'

/**
 * How often the background sync runs, in minutes.
 *
 * An hour, because a sync is a full read of every selected tag and the
 * bookmarks it mirrors do not go stale quickly. Anything under 0.5 is refused
 * by Chrome outright.
 */
const SYNC_PERIOD_MINUTES = 60

/** Everything the worker does that a test cannot run for real. */
export interface BackgroundDeps {
  /** A full sync of stored selection over the stored connection. */
  runSync(): Promise<void>
  logger: BackgroundLogger
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Whether there is a connection for a sync to run over.
 *
 * A sync the user did not ask for only makes sense once they have connected:
 * before that `runSync` would raise `ReauthorizationRequiredError` on every
 * browser startup and every alarm, and nobody would be looking. The refresh
 * token is the half that matters - an expired access token is refreshed, a
 * missing refresh token is a grant that is gone.
 */
async function isConnected(): Promise<boolean> {
  const stored = await storage.getMany(['baseUrl', 'refreshToken'])
  return stored.baseUrl !== undefined && stored.refreshToken !== undefined
}

/**
 * Wire the service worker up to the events that start a sync.
 *
 * Called once, on every wake of the worker: MV3 tears the worker down between
 * events and re-runs this module to deliver the next one, so registration has
 * to happen at the top level and cannot wait on anything asynchronous.
 */
export function initBackground(deps: BackgroundDeps): void {
  /**
   * The sync in progress, if there is one.
   *
   * Two syncs at once means two runs reconciling the same bookmark folders
   * against two reads of the same tags, so everything that wants a sync joins
   * this one instead. Every caller has to attach its own handler: the shared
   * promise rejects once and is handed to each of them.
   */
  let inFlight: Promise<void> | null = null

  function sync(): Promise<void> {
    inFlight ??= deps.runSync().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  /**
   * A sync nobody is watching: on browser startup, or on the alarm.
   *
   * `runSync` has already written the failure to `lastSyncError` by the time
   * it rethrows, and the popup reads that on its next open, so there is
   * nothing left to do with the rejection but say it out loud. Letting it
   * escape would only be an unhandled rejection in the worker.
   */
  async function syncQuietly(reason: string): Promise<void> {
    if (!(await isConnected())) return
    try {
      await sync()
    } catch (error) {
      deps.logger.warn(
        `PinSquirrel: ${reason} sync failed: ${messageOf(error)}`
      )
    }
  }

  /** A sync the popup is waiting on, with its outcome as a value. */
  async function syncForPopup(): Promise<SyncResponse> {
    try {
      await sync()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: messageOf(error) }
    }
  }

  /**
   * Make sure the periodic alarm exists, without disturbing one that does.
   *
   * `chrome.alarms.create` on a name that is already scheduled replaces it,
   * and the new one starts its period from now - so calling it on every wake
   * of the worker would push the next sync forever into the future. The check
   * first is what makes this safe to run on both install and startup, and
   * running it on startup is what recovers an alarm Chrome dropped.
   */
  async function ensureAlarm(): Promise<void> {
    if (await chrome.alarms.get(SYNC_ALARM)) return
    await chrome.alarms.create(SYNC_ALARM, {
      periodInMinutes: SYNC_PERIOD_MINUTES,
    })
  }

  chrome.runtime.onInstalled.addListener(() => {
    void ensureAlarm()
  })

  chrome.runtime.onStartup.addListener(() => {
    void ensureAlarm()
    void syncQuietly('startup')
  })

  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== SYNC_ALARM) return
    void syncQuietly('scheduled')
  })

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isSyncRequest(message)) return false

    void syncForPopup().then(sendResponse)

    // The answer comes later, so Chrome has to keep the channel open.
    return true
  })
}
