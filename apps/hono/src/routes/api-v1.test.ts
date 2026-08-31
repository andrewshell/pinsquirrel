import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { Pin, Tag, TagWithCount, User } from '@pinsquirrel/domain'
import {
  Pagination,
  PinNotFoundError,
  TagNotFoundError,
  UnauthorizedPinAccessError,
  UnauthorizedTagAccessError,
} from '@pinsquirrel/domain'

const mockVerifyAccessToken = vi.fn()
const mockGetPin = vi.fn()
const mockGetPublicPin = vi.fn()
const mockGetUserPinsWithPagination = vi.fn()
const mockGetUserTags = vi.fn()
const mockGetUserTagsWithCount = vi.fn()
const mockGetUserTagById = vi.fn()

vi.mock('../lib/services', () => ({
  oauthService: {
    verifyAccessToken: (...args: unknown[]) =>
      mockVerifyAccessToken(...args) as unknown,
  },
  pinService: {
    getPin: (...args: unknown[]) => mockGetPin(...args) as unknown,
    getPublicPin: (...args: unknown[]) => mockGetPublicPin(...args) as unknown,
    getUserPinsWithPagination: (...args: unknown[]) =>
      mockGetUserPinsWithPagination(...args) as unknown,
  },
  tagService: {
    getUserTags: (...args: unknown[]) => mockGetUserTags(...args) as unknown,
    getUserTagsWithCount: (...args: unknown[]) =>
      mockGetUserTagsWithCount(...args) as unknown,
    getUserTagById: (...args: unknown[]) =>
      mockGetUserTagById(...args) as unknown,
  },
}))

import { apiV1Limiter } from '../middleware/rate-limit'
import { TEST_CLIENT_IP, exhaust } from '../test-support/rate-limit'
import { apiV1Routes } from './api-v1'

const testUser: User = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  emailVerified: true,
  passwordHash: 'x',
  roles: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
} as unknown as User

function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'pin-1',
    userId: 'user-1',
    url: 'https://example.com',
    title: 'Example',
    description: null,
    readLater: false,
    isPrivate: false,
    tagNames: ['foo'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1',
    userId: 'user-1',
    name: 'foo',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

const REST_RESOURCE = 'http://localhost:8100/api/v1'

/**
 * A token that is only good for one resource, which is what the audience
 * check in `verifyAccessToken` decides. Mocking it this way is what makes the
 * cross-resource cases real: the route passes its own resource in, or the
 * token opens both doors.
 */
function tokenFor(resource: string) {
  return (_raw: unknown, expectedResource: unknown) =>
    expectedResource === resource
      ? {
          token: { id: 'token-1' },
          user: testUser,
          clientId: 'client-1',
          scopes: ['pins:read', 'tags:read'],
        }
      : null
}

describe('api-v1 routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    // A module-level limiter outlives a single test, so each case starts with
    // its own budget rather than inheriting whatever the last one spent.
    apiV1Limiter.reset(TEST_CLIENT_IP)
    app = new Hono()
    app.route('/api/v1', apiV1Routes)
  })

  describe('auth middleware', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await app.request('/api/v1/pins')
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({
        error: 'invalid_token',
        error_description: 'An OAuth bearer token is required',
      })
    })

    // The REST API is an OAuth protected resource too, with its own identifier
    // (Decision 16). Point it at the /mcp document and the Chrome extension
    // asks for the wrong audience, so every token it obtains is rejected.
    it('challenges with the REST resource metadata, not the MCP one', async () => {
      const res = await app.request('/api/v1/pins')

      expect(res.status).toBe(401)
      expect(res.headers.get('WWW-Authenticate')).toBe(
        'Bearer resource_metadata="http://localhost:8100/.well-known/oauth-protected-resource/api/v1", scope="pins:read tags:read pins:write tags:write"'
      )
    })

    it('challenges an invalid token the same way', async () => {
      mockVerifyAccessToken.mockResolvedValue(null)
      const res = await app.request('/api/v1/pins', {
        headers: { Authorization: 'Bearer pso_bad' },
      })

      expect(res.status).toBe(401)
      expect(res.headers.get('WWW-Authenticate')).toContain(
        'oauth-protected-resource/api/v1'
      )
      expect(await res.json()).toEqual({
        error: 'invalid_token',
        error_description: 'The access token is invalid, expired, or revoked',
      })
    })

    // Expired, revoked, and belonging to a user who no longer exists are all
    // the same answer: the service resolves the token or it does not, and the
    // response never says which it was.
    it.each(['expired', 'revoked', 'ownerless'])(
      'rejects a %s token without saying which',
      async () => {
        mockVerifyAccessToken.mockResolvedValue(null)
        const res = await app.request('/api/v1/pins', {
          headers: { Authorization: 'Bearer pso_ok' },
        })
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({
          error: 'invalid_token',
          error_description: 'The access token is invalid, expired, or revoked',
        })
      }
    )

    // Decision 16 again, from the other side: the path is what separates the
    // two audiences, so an /mcp token must not drive the REST API.
    it('rejects a token minted for the MCP resource', async () => {
      mockVerifyAccessToken.mockImplementation(
        tokenFor('http://localhost:8100/mcp')
      )
      const res = await app.request('/api/v1/pins', {
        headers: { Authorization: 'Bearer pso_mcp' },
      })

      expect(res.status).toBe(401)
    })

    // `Authorization: Bearer` is the only credential form. Nothing else is
    // read, not even as a fallback.
    it('ignores a non-bearer credential header', async () => {
      mockVerifyAccessToken.mockImplementation(tokenFor(REST_RESOURCE))
      const res = await app.request('/api/v1/pins', {
        headers: { 'X-Custom-Credential': 'anything' },
      })

      expect(res.status).toBe(401)
      expect(mockVerifyAccessToken).not.toHaveBeenCalled()
    })

    it('accepts a token minted for the REST resource', async () => {
      mockVerifyAccessToken.mockImplementation(tokenFor(REST_RESOURCE))
      mockGetUserPinsWithPagination.mockResolvedValue({
        pins: [],
        pagination: Pagination.fromTotalCount(0),
      })
      const res = await app.request('/api/v1/pins', {
        headers: { Authorization: 'Bearer pso_ok' },
      })

      expect(res.status).toBe(200)
      expect(mockVerifyAccessToken).toHaveBeenCalledWith(
        'pso_ok',
        REST_RESOURCE
      )
    })
  })

  describe('GET /api/v1/pins', () => {
    beforeEach(() => {
      mockVerifyAccessToken.mockImplementation(tokenFor(REST_RESOURCE))
    })

    it('returns pins and pagination shape', async () => {
      mockGetUserPinsWithPagination.mockResolvedValue({
        pins: [makePin()],
        pagination: Pagination.fromTotalCount(1, { page: 1, pageSize: 25 }),
      })
      const res = await app.request('/api/v1/pins', {
        headers: { Authorization: 'Bearer pso_ok' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        pins: unknown[]
        pagination: { totalCount: number; page: number; hasNext: boolean }
      }
      expect(body.pins).toHaveLength(1)
      expect(body.pagination.totalCount).toBe(1)
      expect(body.pagination.page).toBe(1)
      expect(body.pagination.hasNext).toBe(false)
      // The API is public-only: the filter always excludes private pins,
      // and there is no query parameter that can turn that off.
      const filter = mockGetUserPinsWithPagination.mock.calls[0][1] as {
        isPrivate: boolean | undefined
      }
      expect(filter.isPrivate).toBe(false)
    })

    it('passes query params through to service', async () => {
      mockGetUserPinsWithPagination.mockResolvedValue({
        pins: [],
        pagination: Pagination.fromTotalCount(0),
      })
      await app.request(
        '/api/v1/pins?tag=js&search=react&readLater=true&page=2&pageSize=10&sortBy=title&sortDirection=asc',
        { headers: { Authorization: 'Bearer pso_ok' } }
      )
      const [, filter, pagination] = mockGetUserPinsWithPagination.mock.calls[0]
      expect(filter).toMatchObject({
        tag: 'js',
        search: 'react',
        readLater: true,
        sortBy: 'title',
        sortDirection: 'asc',
      })
      expect(pagination).toEqual({ page: 2, pageSize: 10 })
    })

    it('returns 400 on invalid query', async () => {
      const res = await app.request('/api/v1/pins?page=abc', {
        headers: { Authorization: 'Bearer pso_ok' },
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/v1/pins/:id', () => {
    beforeEach(() => {
      mockVerifyAccessToken.mockImplementation(tokenFor(REST_RESOURCE))
    })

    it('returns pin', async () => {
      mockGetPublicPin.mockResolvedValue(makePin())
      const res = await app.request('/api/v1/pins/pin-1', {
        headers: { Authorization: 'Bearer pso_ok' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { id: string }
      expect(body.id).toBe('pin-1')
    })

    // Was the opposite until the REST API was brought in line with MCP: the
    // same key could read a private pin here but not over the MCP server.
    it('reports a private pin as not found', async () => {
      mockGetPublicPin.mockRejectedValue(new PinNotFoundError('pin-1'))
      const res = await app.request('/api/v1/pins/pin-1', {
        headers: { Authorization: 'Bearer pso_ok' },
      })
      expect(res.status).toBe(404)
      // Same body as the foreign-pin case below: the id must not be echoed
      // back, or the message alone tells the caller the pin exists.
      expect(await res.json()).toEqual({ error: 'Pin not found' })
    })

    // Ownership stays opaque, exactly as the HTML routes have it: another
    // user's pin is reported as missing, never as "exists but not yours".
    // This is a different 401 from the one the auth middleware returns - that
    // one answers "who are you?" and is settled before any handler runs.
    it('reports another user’s pin as not found, not 401 or 403', async () => {
      mockGetPublicPin.mockRejectedValue(
        new UnauthorizedPinAccessError('pin-1')
      )
      const res = await app.request('/api/v1/pins/pin-1', {
        headers: { Authorization: 'Bearer pso_ok' },
      })
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Pin not found' })
    })
  })

  describe('GET /api/v1/tags', () => {
    beforeEach(() => {
      mockVerifyAccessToken.mockImplementation(tokenFor(REST_RESOURCE))
    })

    it('returns tags', async () => {
      mockGetUserTags.mockResolvedValue([makeTag()])
      const res = await app.request('/api/v1/tags', {
        headers: { Authorization: 'Bearer pso_ok' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as Tag[]
      expect(body[0].name).toBe('foo')
    })

    it('returns tags with counts when withCounts=true', async () => {
      mockGetUserTagsWithCount.mockResolvedValue([
        { ...makeTag(), pinCount: 5 },
      ])
      const res = await app.request('/api/v1/tags?withCounts=true', {
        headers: { Authorization: 'Bearer pso_ok' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as TagWithCount[]
      expect(body[0].pinCount).toBe(5)
    })
  })

  describe('GET /api/v1/tags/:id/pins', () => {
    beforeEach(() => {
      mockVerifyAccessToken.mockImplementation(tokenFor(REST_RESOURCE))
    })

    it('returns pins filtered by tag name', async () => {
      mockGetUserTagById.mockResolvedValue(makeTag())
      mockGetUserPinsWithPagination.mockResolvedValue({
        pins: [makePin()],
        pagination: Pagination.fromTotalCount(1),
      })
      const res = await app.request('/api/v1/tags/tag-1/pins', {
        headers: { Authorization: 'Bearer pso_ok' },
      })
      expect(res.status).toBe(200)
      const filter = mockGetUserPinsWithPagination.mock.calls[0][1] as {
        tag: string
        isPrivate: boolean | undefined
      }
      expect(filter.tag).toBe('foo')
      // Tag listings are public-only too.
      expect(filter.isPrivate).toBe(false)
    })

    it('returns 404 when tag service throws TagNotFoundError', async () => {
      mockGetUserTagById.mockRejectedValue(new TagNotFoundError('tag-1'))
      const res = await app.request('/api/v1/tags/tag-1/pins', {
        headers: { Authorization: 'Bearer pso_ok' },
      })
      expect(res.status).toBe(404)
    })

    it('reports another user’s tag as not found', async () => {
      mockGetUserTagById.mockRejectedValue(
        new UnauthorizedTagAccessError('tag-1')
      )
      const res = await app.request('/api/v1/tags/tag-1/pins', {
        headers: { Authorization: 'Bearer pso_ok' },
      })
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Tag not found' })
    })
  })

  // Authenticated, so the point is abuse rather than brute force. Its own
  // limiter, so a flood at /mcp cannot spend this budget.
  describe('rate limiting', () => {
    it('answers 429 with Retry-After once the per-IP quota is spent', async () => {
      exhaust(apiV1Limiter, TEST_CLIENT_IP)
      mockVerifyAccessToken.mockImplementation(tokenFor(REST_RESOURCE))

      const res = await app.request('/api/v1/pins', {
        headers: { Authorization: 'Bearer pso_good' },
      })

      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBeTruthy()
      expect(mockGetUserPinsWithPagination).not.toHaveBeenCalled()
    })
  })
})
