import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@pinsquirrel/core'

// Create mock functions in hoisted scope
const mockCreate = vi.hoisted(() => vi.fn())

// Mock the session.server module
vi.mock('~/lib/session.server', () => ({
  requireUser: vi.fn(),
}))

// Mock the database repositories
vi.mock('@pinsquirrel/database', () => ({
  DrizzlePinRepository: vi.fn().mockImplementation(() => ({
    create: mockCreate,
  })),
  DrizzleTagRepository: vi.fn().mockImplementation(() => ({})),
  db: {},
}))

// Mock react-router
vi.mock('react-router', () => ({
  redirect: vi.fn().mockImplementation((to) => ({ 
    url: to, 
    status: 302 
  })),
}))

// Mock logger
vi.mock('~/lib/logger.server', () => ({
  logger: {
    info: vi.fn(),
    exception: vi.fn(),
  },
}))

import { requireUser } from '~/lib/session.server'
import { action, loader } from './pins.new'

const mockRequireUser = vi.mocked(requireUser)

describe('pins/new route', () => {
  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    passwordHash: 'hash',
    emailHash: 'emailhash',
    createdAt: new Date(),
    updatedAt: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireUser.mockResolvedValue(mockUser)
  })

  describe('loader', () => {
    it('requires user authentication', async () => {
      const request = new Request('http://localhost/pins/new')
      await loader({ request } as Parameters<typeof loader>[0])

      expect(mockRequireUser).toHaveBeenCalledWith(request)
    })

    it('returns null for authenticated user', async () => {
      const request = new Request('http://localhost/pins/new')
      const result = await loader({ request } as Parameters<typeof loader>[0])

      expect(result).toBe(null)
    })

    it('handles authentication errors', async () => {
      mockRequireUser.mockRejectedValue(new Error('Unauthorized'))

      const request = new Request('http://localhost/pins/new')
      
      await expect(loader({ request } as Parameters<typeof loader>[0]))
        .rejects.toThrow('Unauthorized')
    })
  })

  describe('action', () => {
    it('requires user authentication', async () => {
      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')
      
      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData
      })
      
      await action({ request } as Parameters<typeof action>[0])

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
      
      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData
      })
      
      const response = await action({ request } as Parameters<typeof action>[0])

      expect(mockCreate).toHaveBeenCalledWith({
        userId: 'user-1',
        url: 'https://example.com',
        title: 'Test Pin',
        description: 'Test description',
        readLater: false,
        tags: [],
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
      
      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData
      })
      
      await action({ request } as Parameters<typeof action>[0])

      expect(mockCreate).toHaveBeenCalledWith({
        userId: 'user-1',
        url: 'https://example.com',
        title: 'Test Pin',
        description: '',
        readLater: false,
        tags: [],
      })
    })

    it('returns validation errors for invalid form data', async () => {
      const formData = new FormData()
      formData.append('url', 'invalid-url')
      formData.append('title', '')
      
      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData
      })
      
      const result = await action({ request } as Parameters<typeof action>[0])

      expect(result).toEqual({
        errors: {
          url: 'Invalid URL format',
          title: 'Title is required',
        },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns validation error for missing URL', async () => {
      const formData = new FormData()
      formData.append('title', 'Test Pin')
      
      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData
      })
      
      const result = await action({ request } as Parameters<typeof action>[0])

      expect(result).toEqual({
        errors: {
          url: 'Invalid URL format',
        },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('returns validation error for missing title', async () => {
      const formData = new FormData()
      formData.append('url', 'https://example.com')
      
      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData
      })
      
      const result = await action({ request } as Parameters<typeof action>[0])

      expect(result).toEqual({
        errors: {
          title: 'Title is required',
        },
      })

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('handles repository errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('Database error'))

      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')
      
      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData
      })
      
      const result = await action({ request } as Parameters<typeof action>[0])

      expect(result).toEqual({
        error: 'Failed to create pin. Please try again.',
      })
    })

    it('handles authentication errors', async () => {
      mockRequireUser.mockRejectedValue(new Error('Unauthorized'))

      const formData = new FormData()
      formData.append('url', 'https://example.com')
      formData.append('title', 'Test Pin')
      
      const request = new Request('http://localhost/pins/new', {
        method: 'POST',
        body: formData
      })
      
      await expect(action({ request } as Parameters<typeof action>[0]))
        .rejects.toThrow('Unauthorized')
    })
  })

})