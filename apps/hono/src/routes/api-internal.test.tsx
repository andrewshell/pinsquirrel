/**
 * Characterization tests for the internal check-url endpoint.
 *
 * The endpoint answers the pin form's "have I already saved this?" probe, in
 * two shapes: an HTMX fragment for the live form and JSON for anything else.
 * Nothing verified either. These assert what it does today, before the lookup
 * moves behind PinService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { Pin, PinRepository, TagRepository } from '@pinsquirrel/domain'
import { MetadataService, PinService } from '@pinsquirrel/services'
import {
  FetchTimeoutError,
  HttpError,
  InvalidUrlError,
} from '@pinsquirrel/domain'
import { testUser } from '../test-support/pin-routes'

const svc = {
  findByUserIdAndUrl: vi.fn(),
  fetchMetadata: vi.fn(),
}

// A real PinService over a mocked repository, so the assertions below still
// prove which query runs — not merely that one mock called another.
vi.mock('../lib/services', () => ({
  metadataService: {
    fetchMetadata: (...a: unknown[]) => svc.fetchMetadata(...a) as unknown,
  },
  // The real mappers, so the assertions below prove the endpoint reports the
  // status the domain error actually carries.
  metadataErrorUtils: {
    getHttpStatusForError: (error: Error) =>
      MetadataService.getHttpStatusForError(error),
    getUserFriendlyMessage: (error: Error) =>
      MetadataService.getUserFriendlyMessage(error),
  },
  // The tag repository is unreachable from check-url: it only ever reads.
  pinService: new PinService(
    {
      findByUserIdAndUrl: (...a: unknown[]) =>
        svc.findByUserIdAndUrl(...a) as unknown,
    } as unknown as PinRepository,
    {} as unknown as TagRepository
  ),
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

async function get(query: string, htmx = false): Promise<Response> {
  return await app.request(`/api/internal/check-url${query}`, {
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
      // The marker the static JS reads to outline the URL input. A script in
      // the fragment would need a CSP exception.
      expect(body).toContain('data-url-duplicate')
    })

    it('clears the warning when the URL is free', async () => {
      const body = await (
        await get('?url=https://example.test/new', true)
      ).text()

      expect(body).toBe('')
    })

    it('clears the warning for the excluded pin', async () => {
      svc.findByUserIdAndUrl.mockResolvedValue(makePin({ id: 'pin-9' }))

      const body = await (
        await get('?url=https://example.test/a&exclude=pin-9', true)
      ).text()

      expect(body).toBe('')
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

describe('GET /api/internal/metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a url parameter', async () => {
    const res = await app.request('/api/internal/metadata')

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing url parameter' })
  })

  it('returns the fetched title and description', async () => {
    svc.fetchMetadata.mockResolvedValue({
      title: 'Example',
      description: 'A description',
    })

    const res = await app.request(
      '/api/internal/metadata?url=https://example.test/a'
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      title: 'Example',
      description: 'A description',
    })
  })

  // The failure status is the whole point: the client should be able to tell a
  // failure from a success without inspecting the body for an `error` key.
  it.each([
    ['a remote 404', new HttpError(404, 'https://example.test/a'), 422],
    ['a remote 500', new HttpError(500, 'https://example.test/a'), 502],
    ['a timeout', new FetchTimeoutError('https://example.test/a'), 408],
    ['a bad URL', new InvalidUrlError('nope'), 400],
  ])('reports %s with its own status', async (_label, error, status) => {
    svc.fetchMetadata.mockRejectedValue(error)

    const res = await app.request(
      '/api/internal/metadata?url=https://example.test/a'
    )

    expect(res.status).toBe(status)
    expect(res.ok).toBe(false)
  })

  it('explains the failure in the body', async () => {
    svc.fetchMetadata.mockRejectedValue(
      new HttpError(404, 'https://example.test/a')
    )

    const res = await app.request(
      '/api/internal/metadata?url=https://example.test/a'
    )

    expect(await res.json()).toEqual({ error: 'Page not found at this URL' })
  })
})

describe('GET /api/internal/check-url — baseUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.findByUserIdAndUrl.mockResolvedValue(makePin({ id: 'pin-9' }))
  })

  async function duplicateFragment(query: string): Promise<string> {
    const res = await app.request(`/api/internal/check-url${query}`, {
      headers: { 'HX-Request': 'true' },
    })
    return res.text()
  }

  it('links to the public edit form by default', async () => {
    const body = await duplicateFragment('?url=https://example.test/a')

    expect(body).toContain('href="/pins/pin-9/edit"')
  })

  // A duplicate spotted from /private/pins/new must not link the user out of
  // private mode.
  it('links to the caller‘s own edit form when given a baseUrl', async () => {
    const body = await duplicateFragment(
      '?url=https://example.test/a&baseUrl=%2Fprivate%2Fpins'
    )

    expect(body).toContain('href="/private/pins/pin-9/edit"')
  })

  // The value lands in an href in a raw HTML string, so it is an allowlisted
  // path shape or nothing.
  it.each([
    ['javascript:alert(1)'],
    ['https://evil.test/pins'],
    ['/pins" onclick="alert(1)'],
    ['//evil.test'],
  ])('falls back to /pins for a %s baseUrl', async baseUrl => {
    const body = await duplicateFragment(
      `?url=https://example.test/a&baseUrl=${encodeURIComponent(baseUrl)}`
    )

    expect(body).toContain('href="/pins/pin-9/edit"')
  })
})
