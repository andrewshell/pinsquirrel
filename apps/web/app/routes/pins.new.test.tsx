import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User, AccessControl } from '@pinsquirrel/domain'

// Mock the session.server module
vi.mock('~/lib/session.server', () => ({
  requireAccessControl: vi.fn(),
}))

// Mock the auth.server module
vi.mock('~/lib/auth.server', () => ({
  getUserPath: vi.fn(),
}))

import { requireAccessControl } from '~/lib/session.server'
import { getUserPath } from '~/lib/auth.server'
import { loader } from './pins.new'

const mockRequireAccessControl = vi.mocked(requireAccessControl)
const mockGetUserPath = vi.mocked(getUserPath)

describe('pins/new redirect route', () => {
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
  })

  describe('loader', () => {
    it('redirects to user-specific pin creation page with query parameters', async () => {
      mockGetUserPath.mockReturnValue(
        '/testuser/pins/new?url=https%3A%2F%2Fexample.com&title=Test'
      )

      const request = new Request(
        'http://localhost/pins/new?url=https%3A//example.com&title=Test'
      )
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const response = await loader({ request, params: {}, context: {} } as any)

      expect(mockRequireAccessControl).toHaveBeenCalledWith(request)
      expect(mockGetUserPath).toHaveBeenCalledWith(
        'testuser',
        '/pins/new',
        '?url=https%3A%2F%2Fexample.com&title=Test'
      )
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe(
        '/testuser/pins/new?url=https%3A%2F%2Fexample.com&title=Test'
      )
    })

    it('redirects with no query parameters when none provided', async () => {
      mockGetUserPath.mockReturnValue('/testuser/pins/new')

      const request = new Request('http://localhost/pins/new')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const response = await loader({ request, params: {}, context: {} } as any)

      expect(mockRequireAccessControl).toHaveBeenCalledWith(request)
      expect(mockGetUserPath).toHaveBeenCalledWith('testuser', '/pins/new', '')
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('/testuser/pins/new')
    })

    it('requires authentication', async () => {
      mockRequireAccessControl.mockRejectedValue(new Error('Unauthorized'))

      const request = new Request(
        'http://localhost/pins/new?url=https%3A//example.com'
      )

      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        loader({ request, params: {}, context: {} } as any)
      ).rejects.toThrow('Unauthorized')
    })

    it('handles Web Share Target parameters correctly', async () => {
      // Test typical Web Share Target parameters: url, title, text
      mockGetUserPath.mockReturnValue(
        '/testuser/pins/new?url=https%3A%2F%2Fexample.com&title=Example+Site&text=Description'
      )

      const request = new Request(
        'http://localhost/pins/new?url=https%3A//example.com&title=Example%20Site&text=Description'
      )
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const response = await loader({ request, params: {}, context: {} } as any)

      expect(mockRequireAccessControl).toHaveBeenCalledWith(request)
      expect(mockGetUserPath).toHaveBeenCalledWith(
        'testuser',
        '/pins/new',
        '?url=https%3A%2F%2Fexample.com&title=Example+Site&text=Description'
      )
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe(
        '/testuser/pins/new?url=https%3A%2F%2Fexample.com&title=Example+Site&text=Description'
      )
    })
  })
})
