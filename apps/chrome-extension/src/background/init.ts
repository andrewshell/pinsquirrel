import { ReauthorizationRequiredError, type ConnectOutcome } from '../auth.ts'
import {
  isConnectRequest,
  isSyncRequest,
  notifyConnectFinished,
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
   * The first half of connecting to `baseUrl`: discover, register, and hand
   * back the consent URL for the worker to open in a tab.
   *
   * The flow lives here rather than in the page that asked for it because it
   * ends in a tab the worker watches, and the answer can come minutes later -
   * after the page is closed, and after the worker that opened the tab has
   * been unloaded. `startConnect` leaves everything the second half needs in
   * storage, which is what makes that survivable.
   */
  startConnect(baseUrl: string): Promise<string>
  /**
   * The second half: the consent tab has landed on the callback URL, so spend
   * the code and store the tokens. A `restart` means the registration was
   * stale and a fresh consent URL is to be opened in the same tab.
   */
  completeConnect(redirectUrl: string): Promise<ConnectOutcome>
  /** Forget a flow whose tab was closed before it answered. */
  cancelConnect(): Promise<void>
  logger: BackgroundLogger
}

/**
 * Wrap `work` so that only one run of it exists at a time.
 *
 * Two syncs at once means two runs reconciling the same bookmark folders
 * against two reads of the same tags. Everything that asks for one while it
 * is running joins the run already in flight instead. Every caller has to
 * attach its own handler: the shared promise rejects once and is handed to
 * each of them.
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

  /** A failure, in the shape that crosses the message channel. */
  function failureOf(error: unknown): ConnectResponse {
    const failure = { ok: false as const, error: messageOf(error) }
    return error instanceof ReauthorizationRequiredError
      ? { ...failure, reauthorizationRequired: true }
      : failure
  }

  /**
   * Open the consent screen for `baseUrl` in a tab, and say that it is open.
   *
   * An ordinary tab rather than `chrome.identity.launchWebAuthFlow`: that API
   * opens a window no other extension may touch, so a password manager could
   * not fill the sign-in form inside it. In a tab the user's own tools work,
   * and a user already signed in on the site goes straight to consent.
   *
   * A second Connect while a tab is open opens a second tab and remembers the
   * newer one, as a second pin click does. The older tab is then no longer
   * watched; its flow has been overwritten in storage, so an answer from it
   * would carry the wrong state and be refused.
   */
  async function openConsentTab(baseUrl: string): Promise<ConnectResponse> {
    try {
      const url = await deps.startConnect(baseUrl)
      const tab = await chrome.tabs.create({ url })
      if (tab.id !== undefined) {
        await storage.set({ connectTabId: tab.id })
      }
      return { ok: true }
    } catch (error) {
      return failureOf(error)
    }
  }

  /**
   * The consent tab an answer is already being handled for.
   *
   * The same double report as the pin window: Chrome sends `{ status:
   * 'loading', url }` and then `{ status: 'complete' }` with the URL on the
   * tab, and both can be past their storage read before either clears
   * `connectTabId`. The code is single-use, so the second must not spend it.
   */
  let finishingTabId: number | undefined

  /**
   * The consent tab has landed on the callback: finish the flow.
   *
   * On success the tab is closed and the options page told; the tokens are in
   * storage before either, so a page that is not open loses nothing. On
   * failure the tab stays open - the callback page is saying what went wrong,
   * and closing it would take the explanation with it. A `restart` sends the
   * same tab to the fresh consent URL and keeps watching it.
   */
  async function finishConnect(tabId: number, url: string): Promise<void> {
    if (finishingTabId === tabId) return
    finishingTabId = tabId
    try {
      let outcome: ConnectOutcome
      try {
        outcome = await deps.completeConnect(url)
      } catch (error) {
        await storage.remove(['connectTabId'])
        await notifyConnectFinished(failureOf(error))
        return
      }

      if (outcome.status === 'restart') {
        await chrome.tabs.update(tabId, { url: outcome.url })
        return
      }

      await storage.remove(['connectTabId'])
      try {
        await chrome.tabs.remove(tabId)
      } catch {
        // Already closed, by the user or by a duplicate. Closed is the point.
      }
      await notifyConnectFinished({ ok: true })
    } finally {
      finishingTabId = undefined
    }
  }

  /**
   * A tab has navigated: is it the consent tab, and has it reached the
   * callback?
   *
   * Same caveat as the pin window below: the URL is only there because the
   * manifest holds a host permission for the server. Against a server outside
   * that list the consent screen opens and the answer is never seen.
   */
  async function onConsentTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab
  ): Promise<void> {
    const stored = await storage.getMany(['connectTabId', 'pendingConnect'])
    if (
      stored.connectTabId === undefined ||
      stored.pendingConnect === undefined
    )
      return
    if (tabId !== stored.connectTabId) return

    const url = changeInfo.url ?? tab.url
    if (url === undefined) return
    if (!url.startsWith(stored.pendingConnect.redirectUri)) return

    await finishConnect(tabId, url)
  }

  /** The consent tab was closed before it answered: the flow is abandoned. */
  async function onConsentTabClosed(tabId: number): Promise<void> {
    if ((await storage.get('connectTabId')) !== tabId) return
    await storage.remove(['connectTabId'])
    await deps.cancelConnect()
    await notifyConnectFinished({
      ok: false,
      error: 'The sign-in tab was closed before connecting',
    })
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

  /** Drop the remembered window id, if `windowId` is the one remembered. */
  async function forgetPinWindow(windowId: number): Promise<void> {
    if ((await storage.get('pinWindowId')) !== windowId) return
    await storage.remove(['pinWindowId'])
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
   *
   * This reads a URL out of `tabs.onUpdated`, which Chrome redacts unless the
   * extension holds a host permission for that page or the `tabs` permission.
   * `activeTab` does not cover it: that is granted for the tab the user
   * clicked on, and this is the pin window's own tab. So closing the window
   * rests on `host_permissions` in the manifest - a server outside that list
   * opens the form and is never heard from again, leaving the window open and
   * the post-pin sync unrun. The mock hands the URL over unconditionally, so
   * no test in this package can catch that; the manifest is the only guard.
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

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    void onPinWindowUpdated(changeInfo, tab)
    void onConsentTabUpdated(tabId, changeInfo, tab)
  })

  chrome.tabs.onRemoved.addListener(tabId => {
    void onConsentTabClosed(tabId)
  })

  chrome.windows.onRemoved.addListener(windowId => {
    // A window closed with the form still on screen: the user changed their
    // mind, or saved and Chrome beat the worker to it. Either way the id in
    // storage now names a window that is gone, and `pinWindowId` outlives the
    // browser - so without this a stale id would sit there until the next pin,
    // and the first update in a window Chrome happened to number the same
    // would be read as that pin being saved. Nothing to sync: a window shut
    // this way saved nothing, and one that did save has already synced.
    void forgetPinWindow(windowId)
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
      void openConsentTab(message.baseUrl).then(sendResponse)
      return true
    }

    return false
  })
}
