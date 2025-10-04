/* eslint-disable @typescript-eslint/no-unsafe-return */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User, AccessControl } from '@pinsquirrel/domain'

// Create mock functions in hoisted scope
const mockCreatePinFromFormData = vi.hoisted(() => vi.fn())
const mockFindByUserId = vi.hoisted(() => vi.fn())
const mockGetUserPinsWithPagination = vi.hoisted(() => vi.fn())

// Mock the session.server module
vi.mock('~/lib/session.server', () => ({
  requireUser: vi.fn(),
  requireAccessControl: vi.fn(),
  setFlashMessage: vi.fn().mockImplementation(
    (request: Request, type: string, message: string, redirectTo: string) =>
      ({
        url: redirectTo,
        status: 302,
      }) as any
  ),
}))

// Mock the services container
vi.mock('~/lib/services/container.server', () => ({
  tagService: {
    getUserTags: mockFindByUserId,
  },
  pinService: {
    createPin: mockCreatePinFromFormData,
    getUserPinsWithPagination: mockGetUserPinsWithPagination,
  },
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

import { requireAccessControl } from '~/lib/session.server'
import { action, loader } from './pins.new'

const mockRequireAccessControl = vi.mocked(requireAccessControl)

describe('pins/new route', () => {
  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    passwordHash: 'hash',
    emailHash: 'emailhash',
    roles: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Helper to create mock AccessControl
  const createMockAccessControl = (
    user: User | null = mockUser
  ): AccessControl =>
    ({
      user,
      canCreateAs: (userId: string) => !!user && user.id === userId,
      canRead: () => !!user,
      canUpdate: () => !!user,
      canDelete: () => !!user,
      hasRole: () => false,
    }) as AccessControl

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAccessControl.mockResolvedValue(
      createMockAccessControl(mockUser)
    )
    mockFindByUserId.mockResolvedValue([])
    mockGetUserPinsWithPagination.mockResolvedValue({
      pins: [],
      pagination: { page: 1, pageSize: 1, totalPages: 0, totalCount: 0 },
      totalCount: 0,
    })
  })

  describe('loader', () => {
    it('requires user authentication', async () => {
      const request = new Request('http://localhost/pins/new')
      const params = {}
      await loader({ request, params } as Parameters<typeof loader>[0])

      expect(mockRequireAccessControl).toHaveBeenCalledWith(request)
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

      const request = new Request('http://localhost/pins/new')
      const params = {}
      const result = await loader({ request, params } as Parameters<
        typeof loader
      >[0])

      expect(mockFindByUserId).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          user: expect.objectContaining({ id: 'user-1' }),
        }),
        'user-1'
      )
      expect(result).toMatchObject({
        data: {
          userTags: ['javascript', 'react'],
        },
      })
    })

    it('returns empty tags array when user has no tags', async () => {
      mockFindByUserId.mockResolvedValue([])

      const request = new Request('http://localhost/pins/new')
      const params = {}
      const result = await loader({ request, params } as Parameters<
        typeof loader
      >[0])

      expect(mockFindByUserId).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          user: expect.objectContaining({ id: 'user-1' }),
        }),
        'user-1'
      )
      expect(result).toMatchObject({
        data: {
          userTags: [],
        },
      })
    })

    it('handles authentication errors', async () => {
      mockRequireAccessControl.mockRejectedValue(new Error('Unauthorized'))

      const request = new Request('http://localhost/pins/new')
      const params = {}

      await expect(
        loader({ request, params } as Parameters<typeof loader>[0])
      ).rejects.toThrow('Unauthorized')
    })

    it('redirects to edit form when URL already exists', async () => {
      const existingPin = {
        id: 'existing-pin-1',
        userId: 'user-1',
        url: 'https://example.com',
        title: 'Existing Pin',
        description: null,
        readLater: false,
        tagNames: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockGetUserPinsWithPagination.mockResolvedValue({
        pins: [existingPin],
        pagination: { page: 1, pageSize: 1, totalPages: 1, totalCount: 1 },
        totalCount: 1,
      })

      const request = new Request(
        'http://localhost/pins/new?url=https://example.com'
      )
      const params = {}

      try {
        await loader({ request, params } as Parameters<typeof loader>[0])
        // Should have thrown a redirect response
        expect.fail('Expected loader to throw a redirect')
      } catch (error) {
        // Verify it's a redirect response (redirect() throws a Response)
        expect(error).toBeInstanceOf(Response)
        if (error instanceof Response) {
          expect(error.status).toBe(302)
          expect(error.headers.get('Location')).toBe(
            '/pins/existing-pin-1/edit'
          )
        }
      }

      expect(mockGetUserPinsWithPagination).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser,
        }),
        { url: 'https://example.com' },
        { page: 1, pageSize: 1 }
      )
    })

    it('does not redirect when URL does not exist', async () => {
      mockGetUserPinsWithPagination.mockResolvedValue({
        pins: [],
        pagination: { page: 1, pageSize: 1, totalPages: 0, totalCount: 0 },
        totalCount: 0,
      })

      const request = new Request(
        'http://localhost/pins/new?url=https://new-url.com'
      )
      const params = {}

      const result = await loader({ request, params } as Parameters<
        typeof loader
      >[0])

      // Should return normal loader data
      expect(result).toHaveProperty('data')
      expect(result.data).toHaveProperty('userTags')
      expect(result.data).toHaveProperty('urlParams')

      expect(mockGetUserPinsWithPagination).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser,
        }),
        { url: 'https://new-url.com' },
        { page: 1, pageSize: 1 }
      )
    })

    it('does not check for duplicates when no URL parameter', async () => {
      const request = new Request('http://localhost/pins/new')
      const params = {}

      await loader({ request, params } as Parameters<typeof loader>[0])

      // Should not call getUserPinsWithPagination
      expect(mockGetUserPinsWithPagination).not.toHaveBeenCalled()
    })
  })

  describe('action', () => {
    it('requires user authentication', async () => {
      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')

      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = {}
      await action({ request, params } as Parameters<typeof action>[0])

      expect(mockRequireAccessControl).toHaveBeenCalledWith(request)
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

      mockCreatePinFromFormData.mockResolvedValue(mockPin)

      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')
      formData.append('description', 'Test description')

      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = {}
      const response = await action({ request, params } as Parameters<
        typeof action
      >[0])

      expect(mockCreatePinFromFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser,
        }),
        {
          userId: mockUser.id,
          url: 'https://example.com',
          title: 'Test Pin',
          description: 'Test description',
          readLater: false,
          tagNames: [],
        }
      )

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

      mockCreatePinFromFormData.mockResolvedValue(mockPin)

      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')

      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = {}
      await action({ request, params } as Parameters<typeof action>[0])

      expect(mockCreatePinFromFormData).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser,
        }),
        {
          userId: mockUser.id,
          url: 'https://example.com',
          title: 'Test Pin',
          description: undefined,
          readLater: false,
          tagNames: [],
        }
      )
    })

    it('returns validation errors when core validation fails', async () => {
      const { ValidationError } = await import('@pinsquirrel/domain')

      mockCreatePinFromFormData.mockRejectedValue(
        new ValidationError({
          url: ['Invalid URL format'],
          title: ['Title is required'],
        })
      )

      const formData = new FormData()
      formData.append('url', 'invalid-url')
      formData.append('title', '')

      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = {}
      const result = await action({ request, params } as Parameters<
        typeof action
      >[0])

      // Should return validation errors from service
      expect(result).toHaveProperty('data.errors')
      expect(result).toHaveProperty('init.status', 400)
      expect(mockCreatePinFromFormData).toHaveBeenCalled()
    })

    it('handles service errors gracefully', async () => {
      mockCreatePinFromFormData.mockRejectedValue(new Error('Database error'))

      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')

      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = {}
      const result = await action({ request, params } as Parameters<
        typeof action
      >[0])

      expect(result).toMatchObject({
        data: {
          errors: {
            _form: ['Failed to create pin. Please try again.'],
          },
        },
        init: {
          status: 500,
        },
      })
    })

    it('handles authentication errors', async () => {
      mockRequireAccessControl.mockRejectedValue(new Error('Unauthorized'))

      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')

      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData,
      })

      const params = {}
      await expect(
        action({ request, params } as Parameters<typeof action>[0])
      ).rejects.toThrow('Unauthorized')
    })
  })
})
