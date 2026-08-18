/**
 * Characterization tests for the internal check-url endpoint.
 *
 * The endpoint answers the pin form's "have I already saved this?" probe, in
 * two shapes: an HTMX fragment for the live form and JSON for anything else.
 * Nothing verified either. These assert what it does today, before the lookup
 * moves behind PinService.
 *
 * The sibling /metadata endpoint in this file remains untested — it is not in
 * the blast radius of this change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { Pin } from '@pinsquirrel/domain'
import { testUser } from '../test-support/pin-routes'

const svc = {
  findByUserIdAndUrl: vi.fn(),
}

vi.mock('../lib/services', () => ({
  metadataService: { fetchMetadata: vi.fn() },
  metadataErrorUtils: { getUserFriendlyMessage: () => 'nope' },
  pinRepository: {
    findByUserIdAndUrl: (...a: unknown[]) =>
      svc.findByUserIdAndUrl(...a) as unknown,
  },
}))

vi.mock('../middleware/session', () => ({
  requireAuth: (): MiddlewareHandler => async (_c, next) => {
    await next()
  },
  getAuthUser: () => testUser,
}))

import { apiInternalRoutes } from './api-internal'

function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'pin-1',
    userId: testUser.id,
    url: 'https://example.test/a',
    title: 'Example',
    description: null,
    readLater: false,
    isPrivate: false,
    tagNames: [],
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

const app = new Hono()
app.route('/api/internal', apiInternalRoutes)

function get(query: string, htmx = false): Promise<Response> {
  return app.request(`/api/internal/check-url${query}`, {
    headers: htmx ? { 'HX-Request': 'true' } : {},
  })
}

describe('GET /api/internal/check-url', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.findByUserIdAndUrl.mockResolvedValue(null)
  })

  it('requires a url parameter', async () => {
    const res = await get('')

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing url parameter' })
    expect(svc.findByUserIdAndUrl).not.toHaveBeenCalled()
  })

  it('looks the URL up against the signed-in user', async () => {
    await get('?url=https://example.test/a')

    expect(svc.findByUserIdAndUrl).toHaveBeenCalledWith(
      testUser.id,
      'https://example.test/a'
    )
  })

  describe('JSON shape', () => {
    it('reports a saved URL with its pin id', async () => {
      svc.findByUserIdAndUrl.mockResolvedValue(makePin({ id: 'pin-9' }))

      const res = await get('?url=https://example.test/a')

      expect(await res.json()).toEqual({ exists: true, pinId: 'pin-9' })
    })

    it('reports an unsaved URL', async () => {
      const res = await get('?url=https://example.test/new')

      expect(await res.json()).toEqual({ exists: false })
    })

    // The edit form probes its own URL; without this it would report the pin
    // being edited as a duplicate of itself.
    it('does not count the excluded pin as a duplicate', async () => {
      svc.findByUserIdAndUrl.mockResolvedValue(makePin({ id: 'pin-9' }))

      const res = await get('?url=https://example.test/a&exclude=pin-9')

      expect(await res.json()).toEqual({ exists: false })
    })

    it('still reports a different pin when excluding one', async () => {
      svc.findByUserIdAndUrl.mockResolvedValue(makePin({ id: 'pin-9' }))

      const res = await get('?url=https://example.test/a&exclude=pin-1')

      expect(await res.json()).toEqual({ exists: true, pinId: 'pin-9' })
    })
  })

  describe('HTMX shape', () => {
    it('returns a warning fragment linking to the existing pin', async () => {
      svc.findByUserIdAndUrl.mockResolvedValue(makePin({ id: 'pin-9' }))

      const body = await (await get('?url=https://example.test/a', true)).text()

      expect(body).toContain('This URL is already saved')
      expect(body).toContain('/pins/pin-9/edit')
      expect(body).toContain("classList.add('border-red-500')")
    })

    it('clears the warning when the URL is free', async () => {
      const body = await (
        await get('?url=https://example.test/new', true)
      ).text()

      expect(body).toContain("classList.remove('border-red-500')")
      expect(body).not.toContain('already saved')
    })

    it('clears the warning for the excluded pin', async () => {
      svc.findByUserIdAndUrl.mockResolvedValue(makePin({ id: 'pin-9' }))

      const body = await (
        await get('?url=https://example.test/a&exclude=pin-9', true)
      ).text()

      expect(body).toContain("classList.remove('border-red-500')")
    })

    // Only the literal string 'true' selects the fragment; any other value
    // falls through to JSON.
    it('falls back to JSON for a non-true HX-Request header', async () => {
      const res = await app.request(
        '/api/internal/check-url?url=https://example.test/new',
        { headers: { 'HX-Request': 'false' } }
      )

      expect(await res.json()).toEqual({ exists: false })
    })
  })
})
