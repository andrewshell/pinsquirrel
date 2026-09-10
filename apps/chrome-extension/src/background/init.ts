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
   * This runs here rather than in the page that asked for it because
   * `chrome.identity.launchWebAuthFlow` opens a window, and Chrome destroyed
   * the action popup - which is what that UI was - the moment that window took
   * focus. The flow died mid-exchange: the server had issued the tokens and
   * nothing was left alive to store them, so the user got a grant on their
   * profile and a popup that still asked them to connect. The UI is an options
   * tab now and survives that, but the worker outliving it is still what makes
   * this safe: it does not matter here whether the page is gone before this
   * returns.
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
 * - the options page only ever offers one at a time, and its button is disabled for
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

/** The keyboard shortcut's name, as `commands` in the manifest declares it. */
const PIN_COMMAND = 'pin-page'

/** How large the pin window opens, in CSS pixels. */
const PIN_WINDOW_WIDTH = 520
const PIN_WINDOW_HEIGHT = 680

/**
 * The pin form for a tab, as a URL on the connected server.
 *
 * `embed=1` is what trims the page to the card, so the window reads as a
 * dialog rather than as the site in miniature (9a). `url` and `title` prefill
 * the form the way the bookmarklet does; either is left out when the tab has
 * no answer for it, because `?title=undefined` would prefill the word.
 */
function pinFormUrl(baseUrl: string, tab: chrome.tabs.Tab): string {
  const params = new URLSearchParams()
  if (tab.url !== undefined) params.set('url', tab.url)
  if (tab.title !== undefined) params.set('title', tab.title)
  params.set('embed', '1')
  return `${baseUrl}/pins/new?${params.toString()}`
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
   * it rethrows, and the options page reads that on its next open, so there is
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

  /** A sync the options page is waiting on, with its outcome as a value. */
  async function syncForOptions(): Promise<SyncResponse> {
    try {
      await sync()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: messageOf(error) }
    }
  }

  /**
   * A connect the options page asked for, with its outcome as a value.
   *
   * It may well be that nobody is left to hear it: as the action popup, the
   * consent window took focus, Chrome tore the page down, and `sendResponse`
   * landed nowhere. That was fine - `connect` has written the tokens to
   * storage by then, and the page reads them on its next open - and it stays
   * fine now that an options tab usually does survive to hear the answer.
   */
  async function connectForOptions(baseUrl: string): Promise<ConnectResponse> {
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

  /**
   * Open the site's own pin form on `tab`, in a window of its own.
   *
   * A popup window rather than the site framed in extension UI: the session
   * cookie is `SameSite=Lax` and the site sends `X-Frame-Options: SAMEORIGIN`,
   * so a frame on a `chrome-extension://` page arrives logged out. A popup
   * window is a top-level first-party navigation, so the cookie flows and
   * nothing about the site's headers has to change (Decision 22).
   *
   * With no server stored there is nothing to pin to, so the click goes to the
   * options page instead of opening a window on nowhere.
   */
  async function pinTab(tab: chrome.tabs.Tab): Promise<void> {
    const baseUrl = await storage.get('baseUrl')
    if (baseUrl === undefined) {
      await chrome.runtime.openOptionsPage()
      return
    }

    const window = await chrome.windows.create({
      url: pinFormUrl(baseUrl, tab),
      type: 'popup',
      width: PIN_WINDOW_WIDTH,
      height: PIN_WINDOW_HEIGHT,
    })
    // A second click while a pin window is open opens a second window and
    // remembers the newer one. The older window is then no longer watched -
    // it stays open on its own form, which is what a user who asked for two
    // pin windows asked for.
    if (window?.id !== undefined) {
      await storage.set({ pinWindowId: window.id })
    }
  }

  /**
   * The pin window a close is already running for.
   *
   * Chrome reports one navigation twice - `{ status: 'loading', url }` and
   * then `{ status: 'complete' }` with the URL on the tab - and the saved page
   * is small enough that the second arrives while the first is still awaiting
   * storage. Both are past their read of `pinWindowId` by then, so clearing
   * the key cannot stop the one already in flight; this can.
   */
  let closingWindowId: number | undefined

  /**
   * Shut the pin window, forget it, and sync - once per window.
   *
   * The order matters: `pinWindowId` is cleared *before* the window goes, so
   * an update whose storage read lands after this point finds no pin window
   * and stops. That and `closingWindowId` cover the two halves of the same
   * race - the update that has not read yet, and the one that already has.
   */
  async function closePinWindow(windowId: number): Promise<void> {
    if (closingWindowId === windowId) return
    closingWindowId = windowId
    try {
      await storage.remove(['pinWindowId'])
      try {
        await chrome.windows.remove(windowId)
      } catch {
        // The window is already gone - closed by hand, or by a duplicate that
        // got past both guards. Gone is the outcome this was asking for, and
        // rethrowing would only be an unhandled rejection in the worker.
      }
      await syncQuietly('pin')
    } finally {
      closingWindowId = undefined
    }
  }

  /**
   * The pin window has navigated: close it if the pin has been saved.
   *
   * `/pins/embed/saved` is the stable confirmation the embed form redirects to
   * (9a), and matching on it is why that URL is stable. The page cannot close
   * itself - a page that was not script-opened may not - so the worker does
   * it, and the sync afterwards is what puts a pin tagged with a selected tag
   * on the bookmarks bar without waiting for the hour.
   *
   * Every other update is somebody else's tab: another window entirely, or the
   * form still being filled in.
   */
  async function onPinWindowUpdated(
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab
  ): Promise<void> {
    const stored = await storage.getMany(['baseUrl', 'pinWindowId'])
    if (stored.pinWindowId === undefined || stored.baseUrl === undefined) return
    if (tab.windowId !== stored.pinWindowId) return

    // `changeInfo.url` is only there on the update that changed it; the
    // `status: 'complete'` that follows carries the URL on the tab instead.
    const url = changeInfo.url ?? tab.url
    if (url === undefined) return
    if (!url.startsWith(`${stored.baseUrl}/pins/embed/saved`)) return

    await closePinWindow(stored.pinWindowId)
  }

  chrome.runtime.onInstalled.addListener(() => {
    void ensureAlarm()
  })

  chrome.action.onClicked.addListener(tab => {
    void pinTab(tab)
  })

  chrome.commands.onCommand.addListener((command, tab) => {
    // A command grants `activeTab` exactly as a click on the action does, so
    // the tab arrives with its URL and title readable and the path is the
    // same one. Chrome sends no tab for a command fired with no active tab.
    if (command !== PIN_COMMAND || tab === undefined) return
    void pinTab(tab)
  })

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    void onPinWindowUpdated(changeInfo, tab)
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
      void syncForOptions().then(sendResponse)
      return true
    }

    if (isConnectRequest(message)) {
      void connectForOptions(message.baseUrl).then(sendResponse)
      return true
    }

    return false
  })
}
