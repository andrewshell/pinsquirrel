import { afterEach, describe, expect, it, vi } from 'vitest'
import * as storage from './storage.ts'
import { stubChrome } from './test/chrome-mock.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('storage', () => {
  it('reads back what it wrote', async () => {
    stubChrome()

    await storage.set({ baseUrl: 'https://pinsquirrel.com', expiresAt: 1234 })

    expect(await storage.get('baseUrl')).toBe('https://pinsquirrel.com')
    expect(await storage.get('expiresAt')).toBe(1234)
  })

  it('answers undefined for a key that was never written', async () => {
    stubChrome()

    expect(await storage.get('accessToken')).toBeUndefined()
  })

  // Decision 17: sync replicates across a user's machines and is not a secret
  // store, so no write may land there.
  it('writes to local and never to sync', async () => {
    const chrome = stubChrome()

    await storage.set({ accessToken: 'pso_secret' })

    expect(chrome.local.items).toEqual({ accessToken: 'pso_secret' })
    expect(chrome.sync.items).toEqual({})
  })
})
