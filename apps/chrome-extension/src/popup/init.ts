import { ReauthorizationRequiredError } from '../auth.ts'
import type { SyncResponse } from '../messages.ts'
import * as storage from '../storage.ts'
import type { TagWithCount } from '../types.ts'
import { parseBaseUrl } from './format.ts'
import { renderTagList } from './render.ts'

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
 * mocking modules: `connect` opens a browser tab, `requestSync` wakes a service
 * worker, and `now` is a clock. What is *not* here is storage - it is already
 * behind `chrome.storage.local`, which the tests stub at the `chrome` global.
 */
export interface PopupDeps {
  document: Document
  connect(baseUrl: string): Promise<void>
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
    tagList: find('#tag-list'),
    status: find('#status'),
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
    await loadTags()
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
      setStatus('')
      showSettings({ reconnect: true })
      return
    }
    setStatus(error instanceof Error ? error.message : String(error))
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
    try {
      await deps.connect(origin)
      baseUrl = origin
      setStatus('')
      await showMain()
    } catch (error) {
      report(error)
    }
  }

  ui.connectButton.addEventListener('click', () => void onConnect())

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
