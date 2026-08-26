import { ReauthorizationRequiredError } from '../auth.ts'
import type { ConnectResponse, SyncResponse } from '../messages.ts'
import * as storage from '../storage.ts'
import type { TagWithCount } from '../types.ts'
import { formatLastSync, parseBaseUrl } from './format.ts'
import { renderTagList, selectedTagIdsIn } from './render.ts'

/**
 * The slice of `PinSquirrelApiClient` the popup uses.
 *
 * Narrower than the class on purpose: the popup only lists tags, and a test
 * handing over the whole client would have to stub methods nothing here calls.
 */
export interface PopupApiClient {
  getTags(withCounts: true): Promise<TagWithCount[]>
}

/**
 * Everything the popup does that is not the DOM.
 *
 * Injected rather than imported so the wiring tests can drive it without
 * mocking modules: the two `request*` calls wake a service worker, and `now`
 * is a clock. What is *not* here is storage - it is already behind
 * `chrome.storage.local`, which the tests stub at the `chrome` global.
 */
export interface PopupDeps {
  document: Document
  /**
   * Ask the service worker to run the OAuth flow; it does not run here.
   *
   * `chrome.identity.launchWebAuthFlow` opens a window, and Chrome destroys
   * this popup the moment that window takes focus - so a flow started here
   * died half-finished, after the server had issued the tokens and before
   * anything could store them. What the user saw was a grant on their profile
   * and a popup that still asked them to connect.
   */
  requestConnect(baseUrl: string): Promise<ConnectResponse>
  disconnect(): Promise<void>
  createApiClient(baseUrl: string): PopupApiClient
  requestSync(): Promise<SyncResponse>
  now(): number
}

function elements(doc: Document) {
  const find = <T extends HTMLElement>(selector: string): T => {
    const element = doc.querySelector<T>(selector)
    if (!element) throw new Error(`popup.html is missing ${selector}`)
    return element
  }

  return {
    settingsView: find('#settings-view'),
    mainView: find('#main-view'),
    reconnectNotice: find('#reconnect-notice'),
    baseUrlInput: find<HTMLInputElement>('#base-url'),
    connectButton: find<HTMLButtonElement>('#connect'),
    connectedTo: find('#connected-to'),
    tagList: find('#tag-list'),
    lastSync: find('#last-sync'),
    syncError: find('#sync-error'),
    syncButton: find<HTMLButtonElement>('#sync-now'),
    disconnectButton: find<HTMLButtonElement>('#disconnect'),
    status: find('#status'),
  }
}

/**
 * Run `work` with the button that started it disabled.
 *
 * Every one of these buttons starts something slow and none of them is safe to
 * start twice: a second Connect opens a second consent tab, and a second sync
 * has two runs writing the same bookmark folders.
 */
async function whileBusy(
  button: HTMLButtonElement,
  work: () => Promise<void>
): Promise<void> {
  button.disabled = true
  try {
    await work()
  } finally {
    button.disabled = false
  }
}

/**
 * Wire the popup up and show whichever view the stored state calls for.
 *
 * Called once, when the popup opens. Listeners go on elements that live for as
 * long as the document, so switching views never has to add or remove one.
 */
export async function initPopup(deps: PopupDeps): Promise<void> {
  const ui = elements(deps.document)

  /** The server the popup is talking to, kept so a reconnect can prefill it. */
  let baseUrl: string | undefined

  const setStatus = (text: string): void => {
    ui.status.textContent = text
  }

  function showSettings({ reconnect = false } = {}): void {
    ui.settingsView.hidden = false
    ui.mainView.hidden = true
    ui.reconnectNotice.hidden = !reconnect
    if (baseUrl) ui.baseUrlInput.value = baseUrl
  }

  async function showMain(): Promise<void> {
    ui.settingsView.hidden = true
    ui.mainView.hidden = false
    ui.reconnectNotice.hidden = true
    ui.connectedTo.textContent = `Connected to ${baseUrl ?? ''}`
    await refreshSyncStatus()
    await loadTags()
  }

  /**
   * Re-read what the last sync left behind.
   *
   * The popup does not run the sync - the service worker does, and it can run
   * one while the popup is closed - so these two keys are read from storage
   * every time rather than tracked here.
   */
  async function refreshSyncStatus(): Promise<void> {
    const stored = await storage.getMany(['lastSyncAt', 'lastSyncError'])
    ui.lastSync.textContent = formatLastSync(stored.lastSyncAt, deps.now())
    ui.syncError.textContent = stored.lastSyncError ?? ''
    ui.syncError.hidden = stored.lastSyncError === undefined
  }

  /**
   * A failure the user has to see.
   *
   * `ReauthorizationRequiredError` is the one that changes the view: the grant
   * is gone and no retry will bring it back, so the popup goes to Connect with
   * the server it was talking to already filled in.
   */
  function report(error: unknown): void {
    if (error instanceof ReauthorizationRequiredError) {
      askToReconnect()
      return
    }
    setStatus(error instanceof Error ? error.message : String(error))
  }

  /** Back to Connect, because only the user can bring the grant back. */
  function askToReconnect(): void {
    setStatus('')
    showSettings({ reconnect: true })
  }

  async function loadTags(): Promise<void> {
    if (baseUrl === undefined) return
    try {
      const [tags, selected] = await Promise.all([
        deps.createApiClient(baseUrl).getTags(true),
        storage.get('selectedTagIds'),
      ])
      renderTagList(ui.tagList, tags, selected ?? [])
    } catch (error) {
      report(error)
    }
  }

  async function onConnect(): Promise<void> {
    const origin = parseBaseUrl(ui.baseUrlInput.value)
    if (origin === null) {
      setStatus(
        'Enter the address of a PinSquirrel server, like https://pinsquirrel.com'
      )
      return
    }

    setStatus('Waiting for you to approve the extension...')
    await whileBusy(ui.connectButton, async () => {
      try {
        // Usually this never returns: the consent window takes focus and
        // Chrome destroys the popup mid-await. The flow carries on in the
        // worker, and what the user sees is the popup they open next - which
        // finds the tokens in storage and opens on the main view. Everything
        // below is the case where the popup happened to survive.
        const response = await deps.requestConnect(origin)
        if (!response.ok) {
          if (response.reauthorizationRequired) askToReconnect()
          else setStatus(response.error)
          return
        }
        baseUrl = origin
        setStatus('')
        await showMain()
      } catch (error) {
        report(error)
      }
    })
  }

  /**
   * The selection, written the moment a box moves.
   *
   * No Save button: the popup closes the instant it loses focus, and a
   * selection the user made but did not save would be gone.
   */
  async function onTagToggled(): Promise<void> {
    try {
      await storage.set({ selectedTagIds: selectedTagIdsIn(ui.tagList) })
    } catch (error) {
      report(error)
    }
  }

  async function onSyncNow(): Promise<void> {
    setStatus('Syncing...')
    await whileBusy(ui.syncButton, async () => {
      try {
        const response = await deps.requestSync()
        setStatus(response.ok ? '' : `Sync failed: ${response.error}`)
        await refreshSyncStatus()
      } catch (error) {
        report(error)
      }
    })
  }

  async function onDisconnect(): Promise<void> {
    await whileBusy(ui.disconnectButton, async () => {
      try {
        await deps.disconnect()
        setStatus('')
        showSettings()
      } catch (error) {
        report(error)
      }
    })
  }

  ui.connectButton.addEventListener('click', () => void onConnect())
  ui.syncButton.addEventListener('click', () => void onSyncNow())
  ui.disconnectButton.addEventListener('click', () => void onDisconnect())
  // One delegated listener, because the boxes themselves are replaced on
  // every render and per-box listeners would have to be re-attached each time.
  ui.tagList.addEventListener('change', () => void onTagToggled())

  const stored = await storage.getMany([
    'baseUrl',
    'accessToken',
    'refreshToken',
  ])
  baseUrl = stored.baseUrl

  if (stored.baseUrl && stored.accessToken && stored.refreshToken) {
    await showMain()
  } else {
    showSettings()
  }
}
