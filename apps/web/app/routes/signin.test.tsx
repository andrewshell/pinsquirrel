/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Route } from './+types/signin'

// Mock only external dependencies
vi.mock('~/lib/session.server', () => ({
  getUserId: vi.fn(),
  createUserSession: vi.fn(),
}))

vi.mock('@pinsquirrel/database', () => ({
  DrizzleUserRepository: vi.fn(),
  db: {},
}))

import { getUserId } from '~/lib/session.server'
import { loader, action } from './signin'

const mockGetUserId = vi.mocked(getUserId)

describe('Signin route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loader', () => {
    it('redirects when user is already logged in', async () => {
      mockGetUserId.mockResolvedValue('user-1')

      const request = new Request('http://localhost/signin')
      const args: Route.LoaderArgs = { request, params: {}, context: {} }

      const result = await loader(args)

      expect(result).toBeInstanceOf(Response)
      expect((result as Response).status).toBe(302)
    })

    it('returns null when user is not logged in', async () => {
      mockGetUserId.mockResolvedValue(null)

      const request = new Request('http://localhost/signin')
      const args: Route.LoaderArgs = { request, params: {}, context: {} }

      const result = await loader(args)

      expect(result).toBeNull()
    })
  })

  describe('action', () => {
    it('handles validation errors with real validation (missing fields)', async () => {
      const formData = new FormData()
      formData.append('username', '') // Missing
      formData.append('password', '') // Missing

      const request = new Request('http://localhost/signin', {
        method: 'POST',
        body: formData,
      })
      const args: Route.ActionArgs = { request, params: {}, context: {} }

      const result = await action(args)

      // Real validation will catch missing fields
      expect(result).toHaveProperty('data')
      expect((result as any).data).toHaveProperty('errors')
      expect(result).toHaveProperty('init')
      expect((result as any).init).toHaveProperty('status', 400)
    })

    it('handles validation errors with real validation (invalid credentials)', async () => {
      const formData = new FormData()
      formData.append('username', 'ab') // Too short
      formData.append('password', 'short') // Too short

      const request = new Request('http://localhost/signin', {
        method: 'POST',
        body: formData,
      })
      const args: Route.ActionArgs = { request, params: {}, context: {} }

      const result = await action(args)

      // Real validation will catch these
      expect(result).toHaveProperty('data')
      expect((result as any).data).toHaveProperty('errors')
      expect(result).toHaveProperty('init')
      expect((result as any).init).toHaveProperty('status', 400)
    })

    // Note: Testing successful login requires mocking the entire auth service
    // and database, which is complex. The auth service itself is tested separately.
    // For route tests, we focus on the HTTP handling and validation errors.
  })
})
