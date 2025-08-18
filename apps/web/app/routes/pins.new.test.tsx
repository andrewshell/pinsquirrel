/* eslint-disable @typescript-eslint/no-unsafe-return */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@pinsquirrel/core'

// Create mock functions in hoisted scope
const mockCreate = vi.hoisted(() => vi.fn())
const mockFindByUserId = vi.hoisted(() => vi.fn())

// Mock the session.server module
vi.mock('~/lib/session.server', () => ({
  requireUser: vi.fn(),
  setFlashMessage: vi.fn().mockImplementation(
    (request: Request, type: string, message: string, redirectTo: string) =>
      ({
        url: redirectTo,
        status: 302,
      }) as any
  ),
}))

// Mock the database repositories
vi.mock('@pinsquirrel/database', () => ({
  DrizzlePinRepository: vi.fn().mockImplementation(() => ({
    create: mockCreate,
  })),
  DrizzleTagRepository: vi.fn().mockImplementation(() => ({
    findByUserId: mockFindByUserId,
  })),
  DrizzleUserRepository: vi.fn().mockImplementation(() => ({})),
  db: {},
}))

// No need to mock react-router for server-side loader/action functions

// Mock logger
vi.mock('~/lib/logger.server', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    exception: vi.fn(),
  },
}))

import { requireUser } from '~/lib/session.server'
import { action, loader } from './$username.pins.new'

const mockRequireUser = vi.mocked(requireUser)

describe('pins/new route', () => {
  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    passwordHash: 'hash',
    emailHash: 'emailhash',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireUser.mockResolvedValue(mockUser)
    mockFindByUserId.mockResolvedValue([])
  })

  describe('loader', () => {
    it('requires user authentication', async () => {
      const request = new Request('http://localhost/testuser/pins/new')
      const params = { username: 'testuser' }
      await loader({ request, params } as Parameters<typeof loader>[0])

      expect(mockRequireUser).toHaveBeenCalledWith(request)
    })

    it('fetches and returns user tags for authenticated user', async () => {
      const mockTags = [
        {
          id: 'tag-1',
          name: 'javascript',
          userId: 'user-1',
          usageCount: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'tag-2',
          name: 'react',
          userId: 'user-1',
          usageCount: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      mockFindByUserId.mockResolvedValue(mockTags)

      const request = new Request('http://localhost/testuser/pins/new')
      const params = { username: 'testuser' }
      const result = await loader({ request, params } as Parameters<
        typeof loader
      >[0])

      expect(mockFindByUserId).toHaveBeenCalledWith('user-1')
      expect(result).toMatchObject({
        data: {
          userTags: ['javascript', 'react'],
        },
      })
    })

    it('returns empty tags array when user has no tags', async () => {
      mockFindByUserId.mockResolvedValue([])

      const request = new Request('http://localhost/testuser/pins/new')
      const params = { username: 'testuser' }
      const result = await loader({ request, params } as Parameters<
        typeof loader
      >[0])

      expect(mockFindByUserId).toHaveBeenCalledWith('user-1')
      expect(result).toMatchObject({
        data: {
          userTags: [],
        },
      })
    })

    it('handles authentication errors', async () => {
      mockRequireUser.mockRejectedValue(new Error('Unauthorized'))

      const request = new Request('http://localhost/testuser/pins/new')
      const params = { username: 'testuser' }

      await expect(
        loader({ request, params } as Parameters<typeof loader>[0])
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('action', () => {
    it('requires user authentication', async () => {
      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')

      const request = new Request('http://localhost/testuser/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = { username: 'testuser' }
      await action({ request, params } as Parameters<typeof action>[0])

      expect(mockRequireUser).toHaveBeenCalledWith(request)
    })

    it('creates a pin with valid form data', async () => {
      const mockPin = {
        id: 'pin-1',
        userId: 'user-1',
        url: 'https://example.com',
        title: 'Test Pin',
        description: 'Test description',
        readLater: false,
        contentPath: null,
        imagePath: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCreate.mockResolvedValue(mockPin)

      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')
      formData.append('description', 'Test description')

      const request = new Request('http://localhost/testuser/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = { username: 'testuser' }
      const response = await action({ request, params } as Parameters<
        typeof action
      >[0])

      expect(mockCreate).toHaveBeenCalledWith({
        userId: 'user-1',
        url: 'https://example.com',
        title: 'Test Pin',
        description: 'Test description',
        readLater: false,
        tagNames: [],
      })

      expect(response).toEqual(
        expect.objectContaining({
          status: 302,
        })
      )
    })

    it('creates a pin without optional description', async () => {
      const mockPin = {
        id: 'pin-1',
        userId: 'user-1',
        url: 'https://example.com',
        title: 'Test Pin',
        description: null,
        readLater: false,
        contentPath: null,
        imagePath: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockCreate.mockResolvedValue(mockPin)

      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')

      const request = new Request('http://localhost/testuser/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = { username: 'testuser' }
      await action({ request, params } as Parameters<typeof action>[0])

      expect(mockCreate).toHaveBeenCalledWith({
        userId: 'user-1',
        url: 'https://example.com',
        title: 'Test Pin',
        description: '',
        readLater: false,
        tagNames: [],
      })
    })

    it('returns validation errors when core validation fails', async () => {
      const formData = new FormData()
      formData.append('url', 'invalid-url')
      formData.append('title', '')

      const request = new Request('http://localhost/testuser/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = { username: 'testuser' }
      const result = await action({ request, params } as Parameters<
        typeof action
      >[0])

      // Should return validation errors (actual validation is tested in core)
      expect(result).toHaveProperty('data.errors')
      expect(result).toHaveProperty('init.status', 400)
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('handles repository errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('Database error'))

      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')

      const request = new Request('http://localhost/testuser/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = { username: 'testuser' }
      const result = await action({ request, params } as Parameters<
        typeof action
      >[0])

      expect(result).toMatchObject({
        data: {
          errors: {
            _form: 'Failed to create pin. Please try again.',
          },
        },
        init: {
          status: 400,
        },
      })
    })

    it('handles authentication errors', async () => {
      mockRequireUser.mockRejectedValue(new Error('Unauthorized'))

      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')

      const request = new Request('http://localhost/testuser/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = { username: 'testuser' }
      await expect(
        action({ request, params } as Parameters<typeof action>[0])
      ).rejects.toThrow('Unauthorized')
    })
  })
})
