import { describe, it, expect, vi, beforeEach } from 'vitest'
import { action, loader } from './logout'
import type { Route } from './+types/logout'
import { logout } from '~/lib/session.server'

// Mock the session module
vi.mock('~/lib/session.server', () => ({
  logout: vi.fn(),
}))

describe('Logout Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('action', () => {
    it('calls logout with request', async () => {
      const request = new Request('http://localhost/logout', { method: 'POST' })
      const args: Route.ActionArgs = { request, params: {}, context: {} }

      vi.mocked(logout).mockResolvedValue(new Response('', { status: 302 }))

      await action(args)

      expect(logout).toHaveBeenCalledWith(request)
    })

    it('returns logout response', async () => {
      const request = new Request('http://localhost/logout', { method: 'POST' })
      const args: Route.ActionArgs = { request, params: {}, context: {} }
      const logoutResponse = new Response('', { status: 302 })

      vi.mocked(logout).mockResolvedValue(logoutResponse)

      const result = await action(args)

      expect(result).toBe(logoutResponse)
    })
  })

  describe('loader', () => {
    it('calls logout with request', async () => {
      const request = new Request('http://localhost/logout')
      const args: Route.LoaderArgs = { request, params: {}, context: {} }

      vi.mocked(logout).mockResolvedValue(new Response('', { status: 302 }))

      await loader(args)

      expect(logout).toHaveBeenCalledWith(request)
    })

    it('returns logout response', async () => {
      const request = new Request('http://localhost/logout')
      const args: Route.LoaderArgs = { request, params: {}, context: {} }
      const logoutResponse = new Response('', { status: 302 })

      vi.mocked(logout).mockResolvedValue(logoutResponse)

      const result = await loader(args)

      expect(result).toBe(logoutResponse)
    })
  })
})
