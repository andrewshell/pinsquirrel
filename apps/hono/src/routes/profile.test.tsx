/**
 * Route tests for the profile intents.
 *
 * Each intent is asserted through what the user ends up looking at, not through
 * the shape of the response: `renderedProfile` follows a redirect if there is
 * one, so the tests stay true whether the route renders inline or redirects.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { ApiKey, User } from '@pinsquirrel/domain'
import {
  AccessControl,
  InvalidCredentialsError,
  UserAlreadyExistsError,
  ValidationError,
} from '@pinsquirrel/domain'
import { formBody } from '../test-support/pin-routes'
import type { FlashMessage } from '../middleware/session'

const testUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
} as unknown as User

function makeApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 'key-1',
    userId: 'user-1',
    name: 'Laptop Key',
    lastUsedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as unknown as ApiKey
}

const svc = {
  updateEmail: vi.fn(),
  changePassword: vi.fn(),
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
}

vi.mock('../lib/services', () => ({
  accountService: {
    updateEmail: (...a: unknown[]) => svc.updateEmail(...a) as unknown,
  },
  authService: {
    changePassword: (...a: unknown[]) => svc.changePassword(...a) as unknown,
  },
  apiKeyService: {
    listApiKeys: (...a: unknown[]) => svc.listApiKeys(...a) as unknown,
    createApiKey: (...a: unknown[]) => svc.createApiKey(...a) as unknown,
    revokeApiKey: (...a: unknown[]) => svc.revokeApiKey(...a) as unknown,
  },
}))

/**
 * A flash that actually survives one request, the way the real session does —
 * a fake that always returns null would hide a message the route only sets.
 */
let flash: FlashMessage | null = null

vi.mock('../middleware/session', () => ({
  requireAuth: (): MiddlewareHandler => async (_c, next) => {
    await next()
  },
  getAuthUser: () => testUser,
  getSessionManager: () => ({
    getUser: () => Promise.resolve(testUser),
    setFlash: (type: FlashMessage['type'], message: string) => {
      flash = { type, message }
    },
    getFlash: () => {
      const current = flash
      flash = null
      return current
    },
  }),
}))

const { profileRoutes } = await import('./profile')

describe('profile routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    flash = null
    svc.listApiKeys.mockResolvedValue([makeApiKey()])
    app = new Hono()
    app.route('/profile', profileRoutes)
  })

  /** The page the user is looking at once the POST has settled. */
  async function renderedProfile(res: Response): Promise<string> {
    if (res.status >= 300 && res.status < 400) {
      expect(res.headers.get('location')).toBe('/profile')
      return (await app.request('/profile')).text()
    }
    return res.text()
  }

  describe('POST / — update-email', () => {
    it('still lists the API keys once the email has been updated', async () => {
      const res = await app.request(
        '/profile',
        formBody({ intent: 'update-email', email: 'new@example.com' })
      )

      const html = await renderedProfile(res)
      expect(svc.updateEmail).toHaveBeenCalledWith(
        new AccessControl(testUser),
        { userId: testUser.id, email: 'new@example.com' }
      )
      expect(html).toContain('Laptop Key')
      expect(html).not.toContain('No API keys yet')
    })

    it('confirms the update to the user', async () => {
      const res = await app.request(
        '/profile',
        formBody({ intent: 'update-email', email: 'new@example.com' })
      )

      expect(await renderedProfile(res)).toMatch(/[Ee]mail updated/)
    })

    // The unique index on email_hash means another account can own the
    // address; that is a rejected form, not a server fault.
    it('reports an address another account already uses', async () => {
      svc.updateEmail.mockRejectedValue(
        new UserAlreadyExistsError('alice', 'already in use')
      )

      const res = await app.request(
        '/profile',
        formBody({ intent: 'update-email', email: 'taken@example.com' })
      )

      expect(res.status).toBe(400)
      const html = await res.text()
      expect(html).toMatch(/already/i)
      expect(html).not.toMatch(/unexpected error/i)
    })

    it('clears the address when the field is submitted empty', async () => {
      await app.request(
        '/profile',
        formBody({ intent: 'update-email', email: '' })
      )

      expect(svc.updateEmail).toHaveBeenCalledWith(
        new AccessControl(testUser),
        { userId: testUser.id, email: null }
      )
    })
  })

  describe('POST / — change-password', () => {
    it('still lists the API keys once the password has been changed', async () => {
      const res = await app.request(
        '/profile',
        formBody({
          intent: 'change-password',
          currentPassword: 'old-password',
          newPassword: 'new-password',
        })
      )

      const html = await renderedProfile(res)
      expect(html).toContain('Laptop Key')
      expect(html).not.toContain('No API keys yet')
    })

    it('confirms the change to the user', async () => {
      const res = await app.request(
        '/profile',
        formBody({
          intent: 'change-password',
          currentPassword: 'old-password',
          newPassword: 'new-password',
        })
      )

      expect(await renderedProfile(res)).toMatch(/[Pp]assword changed/)
    })

    it('reports a wrong current password on the field itself', async () => {
      svc.changePassword.mockRejectedValue(new InvalidCredentialsError())

      const res = await app.request(
        '/profile',
        formBody({
          intent: 'change-password',
          currentPassword: 'wrong',
          newPassword: 'new-password',
        })
      )

      expect(res.status).toBe(400)
      expect(await res.text()).toContain('Current password is incorrect')
    })
  })

  describe('POST / — revoke-api-key', () => {
    it('confirms the revocation and re-renders the card', async () => {
      const res = await app.request(
        '/profile',
        formBody({ intent: 'revoke-api-key', keyId: 'key-1' })
      )

      expect(svc.revokeApiKey).toHaveBeenCalledWith(expect.anything(), 'key-1')
      expect(await renderedProfile(res)).toMatch(/API key revoked/)
    })
  })

  describe('POST / — create-api-key', () => {
    it('shows the raw key exactly once, alongside the key list', async () => {
      svc.createApiKey.mockResolvedValue({ rawKey: 'ps_secret_value' })

      const res = await app.request(
        '/profile',
        formBody({ intent: 'create-api-key', name: 'Laptop Key' })
      )

      const html = await res.text()
      expect(html).toContain('ps_secret_value')
      expect(html).toContain('will not be shown again')
    })

    it('reports a validation failure without losing the key list', async () => {
      svc.createApiKey.mockRejectedValue(
        new ValidationError({ name: ['Name is required'] })
      )

      const res = await app.request(
        '/profile',
        formBody({ intent: 'create-api-key', name: '' })
      )

      expect(res.status).toBe(400)
      const html = await res.text()
      expect(html).toContain('Laptop Key')
    })
  })

  it('rejects an unknown intent', async () => {
    const res = await app.request('/profile', formBody({ intent: 'nonsense' }))

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Invalid action')
  })
})
