import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Pin } from '@pinsquirrel/core'

// Create mock functions in hoisted scope
const mockFindById = vi.hoisted(() => vi.fn())
const mockUpdatePin = vi.hoisted(() => vi.fn())

// Mock the session.server module
vi.mock('~/lib/session.server', () => ({
  requireUser: vi.fn(),
  getSession: vi.fn().mockResolvedValue({}),
  getFlashMessage: vi.fn().mockResolvedValue(null),
  commitSession: vi.fn().mockResolvedValue('cookie-string'),
  setFlashMessage: vi.fn().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { Location: '/pins' },
    })
  ),
}))

// Mock the database repositories
vi.mock('@pinsquirrel/database', () => ({
  DrizzlePinRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    update: mockUpdatePin,
  })),
  DrizzleTagRepository: vi.fn().mockImplementation(() => ({})),
  db: {},
}))

// Mock the PinService
vi.mock('~/lib/services/pinService.server', () => ({
  pinService: {
    getPin: vi.fn(),
    updatePin: vi.fn(),
  },
}))

// Mock react-router
vi.mock('react-router', () => ({
  data: vi.fn((data: unknown) => data),
  json: vi.fn(
    (data: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      })
  ),
  redirect: vi.fn(
    (url: string) =>
      new Response(null, {
        status: 302,
        headers: { Location: url },
      })
  ),
  useLoaderData: vi.fn(),
  useActionData: vi.fn(),
}))

// Mock useMetadataFetch hook
vi.mock('~/lib/useMetadataFetch', () => ({
  useMetadataFetch: vi.fn(() => ({
    loading: false,
    error: null,
    metadata: null,
    fetchMetadata: vi.fn(),
  })),
}))

import { requireUser } from '~/lib/session.server'
import { pinService } from '~/lib/services/pinService.server'
import { loader, action } from './pins.$id.edit'

const mockRequireUser = vi.mocked(requireUser)
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockGetPin = vi.mocked(pinService.getPin)
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockUpdatePinService = vi.mocked(pinService.updatePin)

describe('pins.$id.edit route', () => {
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    passwordHash: 'hash',
    emailHash: 'emailhash',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockDate = new Date('2025-08-07T00:00:00.000Z')
  const mockPin: Pin = {
    id: 'pin-1',
    userId: 'user-1',
    url: 'https://example.com',
    title: 'Example Pin',
    description: 'A test pin',
    readLater: false,
    contentPath: null,
    imagePath: null,
    createdAt: mockDate,
    updatedAt: mockDate,
    tags: [
      {
        id: 'tag-1',
        name: 'test',
        userId: 'user-1',
        createdAt: mockDate,
        updatedAt: mockDate,
      },
      {
        id: 'tag-2',
        name: 'example',
        userId: 'user-1',
        createdAt: mockDate,
        updatedAt: mockDate,
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loader', () => {
    it('should require user authentication', async () => {
      mockRequireUser.mockResolvedValue(mockUser)
      mockGetPin.mockResolvedValue(mockPin)

      const request = new Request('http://localhost:3000/pins/pin-1/edit')
      const params = { id: 'pin-1' }

      await loader({ request, params, context: {} })

      expect(mockRequireUser).toHaveBeenCalledWith(request)
    })

    it('should fetch pin by id for authenticated user', async () => {
      mockRequireUser.mockResolvedValue(mockUser)
      mockGetPin.mockResolvedValue(mockPin)

      const request = new Request('http://localhost:3000/pins/pin-1/edit')
      const params = { id: 'pin-1' }

      const result = await loader({ request, params, context: {} })

      // The data function returns the data directly in our mock
      expect(mockGetPin).toHaveBeenCalledWith('user-1', 'pin-1')
      // In our mock, data() just returns the object directly
      expect(result).toEqual({ pin: mockPin })
    })

    it('should return 404 response when pin is not found', async () => {
      mockRequireUser.mockResolvedValue(mockUser)
      mockGetPin.mockRejectedValue(new Error('Pin not found'))

      const request = new Request('http://localhost:3000/pins/pin-1/edit')
      const params = { id: 'pin-1' }

      try {
        await loader({ request, params, context: {} })
        throw new Error('Should have thrown')
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Response)
        const response = error as Response
        expect(response.status).toBe(404)
        expect(await response.text()).toBe('Pin not found')
      }
    })

    it('should return 404 response when pin id is missing', async () => {
      mockRequireUser.mockResolvedValue(mockUser)

      const request = new Request('http://localhost:3000/pins/undefined/edit')
      const params = { id: undefined as unknown as string }

      try {
        await loader({ request, params, context: {} })
        throw new Error('Should have thrown')
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Response)
        const response = error as Response
        expect(response.status).toBe(404)
        expect(await response.text()).toBe('Pin ID is required')
      }
    })
  })

  describe('action', () => {
    it('should require user authentication', async () => {
      mockRequireUser.mockResolvedValue(mockUser)

      const formData = new FormData()
      formData.append('url', 'https://updated.com')
      formData.append('title', 'Updated Pin')
      formData.append('description', 'Updated description')

      const request = new Request('http://localhost:3000/pins/pin-1/edit', {
        method: 'POST',
        body: formData,
      })
      const params = { id: 'pin-1' }

      await action({ request, params, context: {} })

      expect(mockRequireUser).toHaveBeenCalledWith(request)
    })

    it('should update pin with valid data', async () => {
      mockRequireUser.mockResolvedValue(mockUser)
      mockUpdatePinService.mockResolvedValue({
        ...mockPin,
        url: 'https://updated.com',
        title: 'Updated Pin',
        description: 'Updated description',
      })

      const formData = new FormData()
      formData.append('url', 'https://updated.com')
      formData.append('title', 'Updated Pin')
      formData.append('description', 'Updated description')

      const request = new Request('http://localhost:3000/pins/pin-1/edit', {
        method: 'POST',
        body: formData,
      })
      const params = { id: 'pin-1' }

      const response = await action({ request, params, context: {} })

      expect(mockUpdatePinService).toHaveBeenCalledWith('user-1', 'pin-1', {
        url: 'https://updated.com',
        title: 'Updated Pin',
        description: 'Updated description',
        readLater: false,
      })
      // setFlashMessage returns a Response with redirect
      expect(response).toBeInstanceOf(Response)
      expect((response as Response).status).toBe(302)
      expect((response as Response).headers.get('Location')).toBe('/pins')
    })

    it('should return validation errors for invalid data', async () => {
      mockRequireUser.mockResolvedValue(mockUser)

      const formData = new FormData()
      formData.append('url', 'not-a-url')
      formData.append('title', '')
      formData.append('description', 'Some description')

      const request = new Request('http://localhost:3000/pins/pin-1/edit', {
        method: 'POST',
        body: formData,
      })
      const params = { id: 'pin-1' }

      const result = await action({ request, params, context: {} })

      // In our mock, data() just returns the object directly
      expect(result).toHaveProperty('errors')
      expect(mockUpdatePinService).not.toHaveBeenCalled()
    })

    it('should return 404 response when pin id is missing', async () => {
      mockRequireUser.mockResolvedValue(mockUser)

      const formData = new FormData()
      formData.append('url', 'https://updated.com')
      formData.append('title', 'Updated Pin')

      const request = new Request('http://localhost:3000/pins/undefined/edit', {
        method: 'POST',
        body: formData,
      })
      const params = { id: undefined as unknown as string }

      try {
        await action({ request, params, context: {} })
        throw new Error('Should have thrown')
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Response)
        const response = error as Response
        expect(response.status).toBe(404)
        expect(await response.text()).toBe('Pin ID is required')
      }
    })

    it('should handle service errors during update', async () => {
      mockRequireUser.mockResolvedValue(mockUser)
      mockUpdatePinService.mockRejectedValue(new Error('Database error'))

      const formData = new FormData()
      formData.append('url', 'https://updated.com')
      formData.append('title', 'Updated Pin')
      formData.append('description', 'Updated description')

      const request = new Request('http://localhost:3000/pins/pin-1/edit', {
        method: 'POST',
        body: formData,
      })
      const params = { id: 'pin-1' }

      const result = await action({ request, params, context: {} })

      expect(result).toHaveProperty(
        'error',
        'Failed to update pin. Please try again.'
      )
    })
  })
})
