// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReauthorizationRequiredError } from '../auth.ts'
import { stubChrome, type ChromeStub } from '../test/chrome-mock.ts'
import { loadPopupDocument } from '../test/popup-dom.ts'
import type { TagWithCount } from '../types.ts'
import { initPopup, type PopupDeps } from './init.ts'

const NOW = Date.parse('2026-08-26T12:00:00Z')

function tag(id: string, name: string, pinCount: number): TagWithCount {
  return {
    id,
    userId: 'user-1',
    name,
    pinCount,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

const TAGS = [tag('t1', 'reading', 12), tag('t2', 'rust', 3)]

/** A connection, as 5b would have left it in storage. */
const CONNECTED = {
  baseUrl: 'https://pinsquirrel.com',
  clientId: 'dcr_1',
  accessToken: 'pso_token',
  refreshToken: 'psr_token',
  expiresAt: NOW + 3_600_000,
}

let chrome: ChromeStub
let doc: Document

interface Harness {
  deps: PopupDeps
  requestConnect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  getTags: ReturnType<typeof vi.fn>
  requestSync: ReturnType<typeof vi.fn>
}

function harness(overrides: Partial<PopupDeps> = {}): Harness {
  const requestConnect = vi.fn(() => Promise.resolve({ ok: true as const }))
  const disconnect = vi.fn(() => Promise.resolve())
  const getTags = vi.fn(() => Promise.resolve(TAGS))
  const requestSync = vi.fn(() => Promise.resolve({ ok: true as const }))

  const deps: PopupDeps = {
    document: doc,
    requestConnect,
    disconnect,
    createApiClient: () => ({ getTags }),
    requestSync,
    now: () => NOW,
    ...overrides,
  }

  return { deps, requestConnect, disconnect, getTags, requestSync }
}

/** Let the click handlers' promises settle. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function element<T extends HTMLElement>(selector: string): T {
  const found = doc.querySelector<T>(selector)
  if (!found) throw new Error(`popup.html has no ${selector}`)
  return found
}

function click(selector: string): Promise<void> {
  element<HTMLButtonElement>(selector).click()
  return flush()
}

const settingsShown = () => !element('#settings-view').hidden
const mainShown = () => !element('#main-view').hidden
const status = () => element('#status').textContent
const checkboxes = () => [
  ...doc.querySelectorAll<HTMLInputElement>('#tag-list input[type=checkbox]'),
]

beforeEach(() => {
  doc = loadPopupDocument()
  chrome = stubChrome()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('initPopup, with no connection stored', () => {
  it('opens on the settings view with pinsquirrel.com offered', async () => {
    await initPopup(harness().deps)

    expect(settingsShown()).toBe(true)
    expect(mainShown()).toBe(false)
    expect(element<HTMLInputElement>('#base-url').value).toBe(
      'https://pinsquirrel.com'
    )
  })

  it('refuses to start a flow against an address that is not an origin', async () => {
    const { deps, requestConnect } = harness()
    await initPopup(deps)

    element<HTMLInputElement>('#base-url').value = 'pinsquirrel.com'
    await click('#connect')

    expect(requestConnect).not.toHaveBeenCalled()
    expect(status()).toMatch(/address/i)
    expect(settingsShown()).toBe(true)
  })

  it('asks the worker to connect, and shows the tag list if it survives', async () => {
    const { deps, requestConnect } = harness()
    await initPopup(deps)

    element<HTMLInputElement>('#base-url').value = 'https://pinsquirrel.com/'
    await click('#connect')

    expect(requestConnect).toHaveBeenCalledWith('https://pinsquirrel.com')
    expect(mainShown()).toBe(true)
    expect(settingsShown()).toBe(false)
    expect(checkboxes().map(box => box.value)).toEqual(['t1', 't2'])
  })

  it('stays on the settings view when the worker reports a failed flow', async () => {
    const { deps } = harness({
      requestConnect: vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          error: 'The user closed the window',
        })
      ),
    })
    await initPopup(deps)
    await click('#connect')

    expect(settingsShown()).toBe(true)
    expect(status()).toContain('The user closed the window')
  })

  it('asks to reconnect when the worker says the grant is gone', async () => {
    const { deps } = harness({
      requestConnect: vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          error: 'invalid_grant',
          reauthorizationRequired: true,
        })
      ),
    })
    await initPopup(deps)
    await click('#connect')

    expect(settingsShown()).toBe(true)
    expect(element('#reconnect-notice').hidden).toBe(false)
  })

  /**
   * The bug this arrangement exists for: Chrome destroys the popup when the
   * consent window takes focus, so the flow finishes with nobody listening.
   * What the user sees is the popup they open next.
   */
  it('opens on the main view when the worker connected after it closed', async () => {
    const torndown = harness({
      requestConnect: vi.fn(() => {
        Object.assign(chrome.local.items, CONNECTED)
        // Never answers - the popup that asked is gone.
        return new Promise<never>(() => {})
      }),
    })
    await initPopup(torndown.deps)
    await click('#connect')

    doc = loadPopupDocument()
    await initPopup(harness().deps)

    expect(mainShown()).toBe(true)
    expect(settingsShown()).toBe(false)
  })
})

describe('initPopup, with a connection stored', () => {
  beforeEach(() => {
    Object.assign(chrome.local.items, CONNECTED, { selectedTagIds: ['t2'] })
  })

  it('opens on the main view with the stored selection ticked', async () => {
    const { deps, getTags } = harness()
    await initPopup(deps)

    expect(mainShown()).toBe(true)
    expect(settingsShown()).toBe(false)
    expect(getTags).toHaveBeenCalledWith(true)
    expect(checkboxes().map(box => box.checked)).toEqual([false, true])
  })

  it('builds the API client against the stored server', async () => {
    const createApiClient = vi.fn(() => ({
      getTags: () => Promise.resolve(TAGS),
    }))
    await initPopup(harness({ createApiClient }).deps)

    expect(createApiClient).toHaveBeenCalledWith('https://pinsquirrel.com')
  })

  it('names the server it is connected to', async () => {
    await initPopup(harness().deps)

    expect(element('#connected-to').textContent).toContain(
      'https://pinsquirrel.com'
    )
  })

  it('stores a tag the moment its box is ticked', async () => {
    await initPopup(harness().deps)

    checkboxes()[0].click()
    await flush()

    expect(chrome.local.items.selectedTagIds).toEqual(['t1', 't2'])
  })

  it('stores the shorter list the moment a box is unticked', async () => {
    await initPopup(harness().deps)

    checkboxes()[1].click()
    await flush()

    expect(chrome.local.items.selectedTagIds).toEqual([])
  })

  it('shows how long ago the last sync ran', async () => {
    chrome.local.items.lastSyncAt = NOW - 5 * 60_000
    await initPopup(harness().deps)

    expect(element('#last-sync').textContent).toBe('Last synced 5 minutes ago')
    expect(element('#sync-error').hidden).toBe(true)
  })

  it('shows why the last sync failed', async () => {
    chrome.local.items.lastSyncError = 'Bookmarks permission denied'
    await initPopup(harness().deps)

    expect(element('#sync-error').hidden).toBe(false)
    expect(element('#sync-error').textContent).toContain(
      'Bookmarks permission denied'
    )
  })

  it('asks the worker to sync and re-reads what the worker wrote', async () => {
    const requestSync = vi.fn(() => {
      // The worker records the sync; the popup has to notice.
      chrome.local.items.lastSyncAt = NOW
      return Promise.resolve({ ok: true as const })
    })
    chrome.local.items.lastSyncAt = NOW - 3 * 24 * 60 * 60_000
    await initPopup(harness({ requestSync }).deps)

    await click('#sync-now')

    expect(requestSync).toHaveBeenCalled()
    expect(element('#last-sync').textContent).toBe('Last synced just now')
  })

  it('reports a sync the worker refused', async () => {
    const requestSync = vi.fn(() =>
      Promise.resolve({ ok: false as const, error: 'No bookmarks permission' })
    )
    await initPopup(harness({ requestSync }).deps)

    await click('#sync-now')

    expect(status()).toContain('No bookmarks permission')
  })

  it('will not start a second sync while one is running', async () => {
    let finish = (): void => {}
    const requestSync = vi.fn(
      () =>
        new Promise<{ ok: true }>(resolve => {
          finish = () => resolve({ ok: true })
        })
    )
    await initPopup(harness({ requestSync }).deps)

    element<HTMLButtonElement>('#sync-now').click()
    await flush()
    expect(element<HTMLButtonElement>('#sync-now').disabled).toBe(true)

    finish()
    await flush()
    expect(element<HTMLButtonElement>('#sync-now').disabled).toBe(false)
  })

  it('goes back to the settings view on disconnect, server prefilled', async () => {
    const { deps, disconnect } = harness()
    await initPopup(deps)

    await click('#disconnect')

    expect(disconnect).toHaveBeenCalled()
    expect(settingsShown()).toBe(true)
    expect(mainShown()).toBe(false)
    expect(element<HTMLInputElement>('#base-url').value).toBe(
      'https://pinsquirrel.com'
    )
    expect(element('#reconnect-notice').hidden).toBe(true)
  })
})

describe('initPopup, when the grant is gone', () => {
  beforeEach(() => {
    Object.assign(chrome.local.items, CONNECTED)
  })

  it('asks to reconnect when listing tags says the grant is gone', async () => {
    const getTags = vi.fn(() =>
      Promise.reject(new ReauthorizationRequiredError('invalid_grant'))
    )
    await initPopup(harness({ createApiClient: () => ({ getTags }) }).deps)

    expect(settingsShown()).toBe(true)
    expect(element('#reconnect-notice').hidden).toBe(false)
    expect(element<HTMLInputElement>('#base-url').value).toBe(
      'https://pinsquirrel.com'
    )
  })

  it('asks to reconnect when a sync says the grant is gone', async () => {
    const requestSync = vi.fn(() =>
      Promise.reject(new ReauthorizationRequiredError('invalid_grant'))
    )
    await initPopup(harness({ requestSync }).deps)

    await click('#sync-now')

    expect(settingsShown()).toBe(true)
    expect(element('#reconnect-notice').hidden).toBe(false)
  })
})
