import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { ApiKey, Pin, Tag, TagWithCount, User } from '@pinsquirrel/domain'
import { Pagination } from '@pinsquirrel/domain'

const mockAuthenticateByKey = vi.fn()
const mockFindUserById = vi.fn()
const mockFindTagById = vi.fn()
const mockGetPin = vi.fn()
const mockGetUserPinsWithPagination = vi.fn()
const mockGetUserTags = vi.fn()
const mockGetUserTagsWithCount = vi.fn()

vi.mock('../lib/services', () => ({
  apiKeyService: {
    authenticateByKey: (...args: unknown[]) =>
      mockAuthenticateByKey(...args) as unknown,
  },
  pinService: {
    getPin: (...args: unknown[]) => mockGetPin(...args) as unknown,
    getUserPinsWithPagination: (...args: unknown[]) =>
      mockGetUserPinsWithPagination(...args) as unknown,
  },
  tagService: {
    getUserTags: (...args: unknown[]) => mockGetUserTags(...args) as unknown,
    getUserTagsWithCount: (...args: unknown[]) =>
      mockGetUserTagsWithCount(...args) as unknown,
  },
}))

vi.mock('../lib/db', () => ({
  userRepository: {
    findById: (...args: unknown[]) => mockFindUserById(...args) as unknown,
  },
  tagRepository: {
    findById: (...args: unknown[]) => mockFindTagById(...args) as unknown,
  },
}))

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

const testApiKey: ApiKey = {
  id: 'key-1',
  userId: 'user-1',
  name: 'test',
  keyHash: 'hash',
  keyPrefix: 'ps_test',
  lastUsedAt: new Date('2024-01-01'),
  expiresAt: null,
  createdAt: new Date('2024-01-01'),
} as unknown as ApiKey

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
  } as Pin
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1',
    userId: 'user-1',
    name: 'foo',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Tag
}

describe('api-v1 routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    app = new Hono()
    app.route('/api/v1', apiV1Routes)
  })

  describe('auth middleware', () => {
    it('returns 401 without auth header', async () => {
      const res = await app.request('/api/v1/pins')
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'Missing API key' })
    })

    it('returns 401 with invalid API key', async () => {
      mockAuthenticateByKey.mockResolvedValue(null)
      const res = await app.request('/api/v1/pins', {
        headers: { Authorization: 'Bearer ps_bad' },
      })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'Invalid API key' })
    })

    it('returns 401 when user lookup fails', async () => {
      mockAuthenticateByKey.mockResolvedValue(testApiKey)
      mockFindUserById.mockResolvedValue(null)
      const res = await app.request('/api/v1/pins', {
        headers: { Authorization: 'Bearer ps_ok' },
      })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'User not found' })
    })

    it('accepts X-API-Key header', async () => {
      mockAuthenticateByKey.mockResolvedValue(testApiKey)
      mockFindUserById.mockResolvedValue(testUser)
      mockGetUserPinsWithPagination.mockResolvedValue({
        pins: [],
        pagination: Pagination.fromTotalCount(0),
      })
      const res = await app.request('/api/v1/pins', {
        headers: { 'X-API-Key': 'ps_ok' },
      })
      expect(res.status).toBe(200)
    })
  })

  describe('GET /api/v1/pins', () => {
    beforeEach(() => {
      mockAuthenticateByKey.mockResolvedValue(testApiKey)
      mockFindUserById.mockResolvedValue(testUser)
    })

    it('returns pins and pagination shape', async () => {
      mockGetUserPinsWithPagination.mockResolvedValue({
        pins: [makePin()],
        pagination: Pagination.fromTotalCount(1, { page: 1, pageSize: 25 }),
      })
      const res = await app.request('/api/v1/pins', {
        headers: { Authorization: 'Bearer ps_ok' },
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
      // isPrivate defaults to undefined (no filter) when not specified
      const filter = mockGetUserPinsWithPagination.mock.calls[0][1] as {
        isPrivate: boolean | undefined
      }
      expect(filter.isPrivate).toBeUndefined()
    })

    it('passes query params through to service', async () => {
      mockGetUserPinsWithPagination.mockResolvedValue({
        pins: [],
        pagination: Pagination.fromTotalCount(0),
      })
      await app.request(
        '/api/v1/pins?tag=js&search=react&readLater=true&page=2&pageSize=10&sortBy=title&sortDirection=asc',
        { headers: { Authorization: 'Bearer ps_ok' } }
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
        headers: { Authorization: 'Bearer ps_ok' },
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/v1/pins/:id', () => {
    beforeEach(() => {
      mockAuthenticateByKey.mockResolvedValue(testApiKey)
      mockFindUserById.mockResolvedValue(testUser)
    })

    it('returns pin', async () => {
      mockGetPin.mockResolvedValue(makePin())
      const res = await app.request('/api/v1/pins/pin-1', {
        headers: { Authorization: 'Bearer ps_ok' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { id: string }
      expect(body.id).toBe('pin-1')
    })

    it('returns private pins', async () => {
      mockGetPin.mockResolvedValue(makePin({ isPrivate: true }))
      const res = await app.request('/api/v1/pins/pin-1', {
        headers: { Authorization: 'Bearer ps_ok' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { isPrivate: boolean }
      expect(body.isPrivate).toBe(true)
    })
  })

  describe('GET /api/v1/tags', () => {
    beforeEach(() => {
      mockAuthenticateByKey.mockResolvedValue(testApiKey)
      mockFindUserById.mockResolvedValue(testUser)
    })

    it('returns tags', async () => {
      mockGetUserTags.mockResolvedValue([makeTag()])
      const res = await app.request('/api/v1/tags', {
        headers: { Authorization: 'Bearer ps_ok' },
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
        headers: { Authorization: 'Bearer ps_ok' },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as TagWithCount[]
      expect(body[0].pinCount).toBe(5)
    })
  })

  describe('GET /api/v1/tags/:id/pins', () => {
    beforeEach(() => {
      mockAuthenticateByKey.mockResolvedValue(testApiKey)
      mockFindUserById.mockResolvedValue(testUser)
    })

    it('returns pins filtered by tag name', async () => {
      mockFindTagById.mockResolvedValue(makeTag())
      mockGetUserPinsWithPagination.mockResolvedValue({
        pins: [makePin()],
        pagination: Pagination.fromTotalCount(1),
      })
      const res = await app.request('/api/v1/tags/tag-1/pins', {
        headers: { Authorization: 'Bearer ps_ok' },
      })
      expect(res.status).toBe(200)
      const filter = mockGetUserPinsWithPagination.mock.calls[0][1] as {
        tag: string
        isPrivate: boolean | undefined
      }
      expect(filter.tag).toBe('foo')
      expect(filter.isPrivate).toBeUndefined()
    })

    it('returns 404 if tag does not belong to user', async () => {
      mockFindTagById.mockResolvedValue(makeTag({ userId: 'other-user' }))
      const res = await app.request('/api/v1/tags/tag-1/pins', {
        headers: { Authorization: 'Bearer ps_ok' },
      })
      expect(res.status).toBe(404)
    })

    it('returns 404 when tag not found', async () => {
      mockFindTagById.mockResolvedValue(null)
      const res = await app.request('/api/v1/tags/tag-1/pins', {
        headers: { Authorization: 'Bearer ps_ok' },
      })
      expect(res.status).toBe(404)
    })
  })
})
