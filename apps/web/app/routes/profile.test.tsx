/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { User } from '@pinsquirrel/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Route } from './+types/profile'

// Mock only external dependencies - not internal validation
vi.mock('~/lib/session.server')

import { requireUser } from '~/lib/session.server'
import { action, loader } from './profile'

const mockRequireUser = vi.mocked(requireUser)

describe('Profile route', () => {
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
  })

  describe('loader', () => {
    it('returns user data when authenticated', async () => {
      const request = new Request('http://localhost/profile')
      const args: Route.LoaderArgs = { request, params: {}, context: {} }

      const result = await loader(args)

      expect(mockRequireUser).toHaveBeenCalledWith(request)
      expect(result).toEqual({ user: mockUser })
    })
  })

  describe('action', () => {
    it('handles validation errors with real validation (invalid email)', async () => {
      const formData = new FormData()
      formData.append('intent', 'update-email')
      formData.append('email', 'not-an-email') // Real invalid email

      const request = new Request('http://localhost/profile', {
        method: 'POST',
        body: formData,
      })
      const args: Route.ActionArgs = { request, params: {}, context: {} }

      const result = await action(args)

      // Real validation will catch this invalid email
      // React Router data() wraps responses in DataWithResponseInit
      expect(result).toHaveProperty('data')
      expect((result as any).data).toHaveProperty('errors')
      expect(result).toHaveProperty('init')
      expect((result as any).init).toHaveProperty('status', 400)
    })

    it('handles validation errors with real validation (missing password)', async () => {
      const formData = new FormData()
      formData.append('intent', 'change-password')
      formData.append('currentPassword', '') // Missing
      formData.append('newPassword', 'short') // Too short

      const request = new Request('http://localhost/profile', {
        method: 'POST',
        body: formData,
      })
      const args: Route.ActionArgs = { request, params: {}, context: {} }

      const result = await action(args)

      // Real validation will catch these errors
      expect(result).toHaveProperty('data')
      expect((result as any).data).toHaveProperty('errors')
      expect(result).toHaveProperty('init')
      expect((result as any).init).toHaveProperty('status', 400)
    })

    it('handles invalid intent', async () => {
      const formData = new FormData()
      formData.append('intent', 'invalid-action')

      const request = new Request('http://localhost/profile', {
        method: 'POST',
        body: formData,
      })
      const args: Route.ActionArgs = { request, params: {}, context: {} }

      const result = await action(args)

      expect(result).toHaveProperty('data')
      expect((result as any).data).toHaveProperty('errors')
      expect(result).toHaveProperty('init')
      expect((result as any).init).toHaveProperty('status', 400)
    })

    // Note: We can't easily test success cases without mocking the entire auth service
    // since they require real password operations. This is acceptable for route tests -
    // the auth service is tested separately.
  })
})
