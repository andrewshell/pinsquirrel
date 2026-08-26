// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  getTags: ReturnType<typeof vi.fn>
  requestSync: ReturnType<typeof vi.fn>
}

function harness(overrides: Partial<PopupDeps> = {}): Harness {
  const connect = vi.fn(() => Promise.resolve())
  const disconnect = vi.fn(() => Promise.resolve())
  const getTags = vi.fn(() => Promise.resolve(TAGS))
  const requestSync = vi.fn(() => Promise.resolve({ ok: true as const }))

  const deps: PopupDeps = {
    document: doc,
    connect,
    disconnect,
    createApiClient: () => ({ getTags }),
    requestSync,
    now: () => NOW,
    ...overrides,
  }

  return { deps, connect, disconnect, getTags, requestSync }
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
    const { deps, connect } = harness()
    await initPopup(deps)

    element<HTMLInputElement>('#base-url').value = 'pinsquirrel.com'
    await click('#connect')

    expect(connect).not.toHaveBeenCalled()
    expect(status()).toMatch(/address/i)
    expect(settingsShown()).toBe(true)
  })

  it('connects to the normalized origin and shows the tag list', async () => {
    const { deps, connect } = harness()
    await initPopup(deps)

    element<HTMLInputElement>('#base-url').value = 'https://pinsquirrel.com/'
    await click('#connect')

    expect(connect).toHaveBeenCalledWith('https://pinsquirrel.com')
    expect(mainShown()).toBe(true)
    expect(settingsShown()).toBe(false)
    expect(checkboxes().map(box => box.value)).toEqual(['t1', 't2'])
  })

  it('stays on the settings view when the flow fails', async () => {
    const { deps } = harness({
      connect: vi.fn(() =>
        Promise.reject(new Error('The user closed the tab'))
      ),
    })
    await initPopup(deps)
    await click('#connect')

    expect(settingsShown()).toBe(true)
    expect(status()).toContain('The user closed the tab')
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
})
