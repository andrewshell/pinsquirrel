import { ReauthorizationRequiredError } from '../auth.ts'
import {
  isConnectRequest,
  isSyncRequest,
  type ConnectResponse,
  type SyncResponse,
} from '../messages.ts'
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
  /**
   * The whole OAuth flow against `baseUrl`, ending with tokens in storage.
   *
   * This runs here rather than in the popup that asked for it because
   * `chrome.identity.launchWebAuthFlow` opens a window, and Chrome destroys
   * the action popup the moment that window takes focus. The flow died
   * mid-exchange: the server had issued the tokens and nothing was left alive
   * to store them, so the user got a grant on their profile and a popup that
   * still asked them to connect. The worker outlives the popup, so it does not
   * matter here that the popup is gone before this returns.
   */
  connect(baseUrl: string): Promise<void>
  logger: BackgroundLogger
}

/**
 * Wrap `work` so that only one run of it exists at a time.
 *
 * Two syncs at once means two runs reconciling the same bookmark folders
 * against two reads of the same tags; two connects means two consent windows
 * for one server. Everything that asks for one while it is running joins the
 * run already in flight instead, including a connect naming a different server
 * - the popup only ever offers one at a time, and its button is disabled for
 * the duration. Every caller has to attach its own handler: the shared promise
 * rejects once and is handed to each of them.
 */
function singleFlight<Args extends unknown[]>(
  work: (...args: Args) => Promise<void>
): (...args: Args) => Promise<void> {
  let inFlight: Promise<void> | null = null
  return (...args) => {
    inFlight ??= work(...args).finally(() => {
      inFlight = null
    })
    return inFlight
  }
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
  const sync = singleFlight(() => deps.runSync())
  const connect = singleFlight((baseUrl: string) => deps.connect(baseUrl))

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
   * A connect the popup asked for, with its outcome as a value.
   *
   * Usually nobody is left to hear it: the consent window takes focus, Chrome
   * tears the popup down, and `sendResponse` lands nowhere. That is fine -
   * `connect` has written the tokens to storage by then, and the popup reads
   * them on its next open. The answer only matters when the popup survived.
   */
  async function connectForPopup(baseUrl: string): Promise<ConnectResponse> {
    try {
      await connect(baseUrl)
      return { ok: true }
    } catch (error) {
      const failure = { ok: false as const, error: messageOf(error) }
      return error instanceof ReauthorizationRequiredError
        ? { ...failure, reauthorizationRequired: true }
        : failure
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
    // Both answers come later, so Chrome has to keep the channel open.
    if (isSyncRequest(message)) {
      void syncForPopup().then(sendResponse)
      return true
    }

    if (isConnectRequest(message)) {
      void connectForPopup(message.baseUrl).then(sendResponse)
      return true
    }

    return false
  })
}
