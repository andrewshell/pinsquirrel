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
import type { User } from '@pinsquirrel/domain'
import {
  AccessControl,
  InvalidCredentialsError,
  OAuthInvalidGrantError,
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

const svc = {
  updateEmail: vi.fn(),
  changePassword: vi.fn(),
  listGrants: vi.fn(),
  revokeGrant: vi.fn(),
}

function makeGrant(overrides: Record<string, unknown> = {}) {
  return {
    tokenId: 'token-1',
    clientId: 'https://claude.ai/oauth/claude-code-client-metadata',
    clientName: 'Claude Code',
    scopes: ['pins:read', 'tags:read'],
    resource: 'http://localhost:8100/mcp',
    expiresAt: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }
}

vi.mock('../lib/services', () => ({
  accountService: {
    updateEmail: (...a: unknown[]) => svc.updateEmail(...a) as unknown,
  },
  authService: {
    changePassword: (...a: unknown[]) => svc.changePassword(...a) as unknown,
  },
  oauthService: {
    listGrants: (...a: unknown[]) => svc.listGrants(...a) as unknown,
    revokeGrant: (...a: unknown[]) => svc.revokeGrant(...a) as unknown,
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
    svc.listGrants.mockResolvedValue([makeGrant()])
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
    it('still lists the connected applications once the email has been updated', async () => {
      const res = await app.request(
        '/profile',
        formBody({ intent: 'update-email', email: 'new@example.com' })
      )

      const html = await renderedProfile(res)
      expect(svc.updateEmail).toHaveBeenCalledWith(
        new AccessControl(testUser),
        { userId: testUser.id, email: 'new@example.com' }
      )
      expect(html).toContain('Claude Code')
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

    // The card list has to come back with the error, or a rejected form would
    // blank the rest of the page.
    it('reports a validation failure without losing the connected applications', async () => {
      svc.updateEmail.mockRejectedValue(
        new ValidationError({ email: ['Invalid email address'] })
      )

      const res = await app.request(
        '/profile',
        formBody({ intent: 'update-email', email: 'nope' })
      )

      expect(res.status).toBe(400)
      const html = await res.text()
      expect(html).toContain('Invalid email address')
      expect(html).toContain('Claude Code')
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
    it('still lists the connected applications once the password has been changed', async () => {
      const res = await app.request(
        '/profile',
        formBody({
          intent: 'change-password',
          currentPassword: 'old-password',
          newPassword: 'new-password',
        })
      )

      const html = await renderedProfile(res)
      expect(html).toContain('Claude Code')
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

  // The API keys are gone (Phase 7), and so are the intents their forms
  // posted. A stale page still holding those forms gets the same answer as any
  // other action the route does not have.
  describe.each(['create-api-key', 'revoke-api-key'])('POST / — %s', intent => {
    it('is no longer an action the profile page knows about', async () => {
      const res = await app.request(
        '/profile',
        formBody({ intent, name: 'Laptop Key', keyId: 'key-1' })
      )

      expect(res.status).toBe(400)
      expect(await res.text()).toContain('Invalid action')
    })
  })

  it('rejects an unknown intent', async () => {
    const res = await app.request('/profile', formBody({ intent: 'nonsense' }))

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Invalid action')
  })

  describe('OAuth grants', () => {
    it('lists a grant with what it can do and where', async () => {
      const html = await (await app.request('/profile')).text()

      expect(svc.listGrants).toHaveBeenCalledWith(expect.anything(), 'user-1')
      expect(html).toContain('Claude Code')
      expect(html).toContain('pins:read')
      expect(html).toContain('tags:read')
      // The audience the token is bound to, in the words a user has for it.
      expect(html).toContain('MCP')
    })

    it('names the REST resource as such', async () => {
      svc.listGrants.mockResolvedValue([
        makeGrant({ resource: 'http://localhost:8100/api/v1' }),
      ])

      const html = await (await app.request('/profile')).text()

      expect(html).toContain('REST API')
    })

    // A client that registered without a name is still something the user has
    // to be able to recognise and revoke.
    it('falls back to the client identifier when the client has no name', async () => {
      svc.listGrants.mockResolvedValue([
        makeGrant({ clientName: null, clientId: 'dcr_abc123' }),
      ])

      const html = await (await app.request('/profile')).text()

      expect(html).toContain('dcr_abc123')
    })

    it('says so plainly when nothing has been authorized', async () => {
      svc.listGrants.mockResolvedValue([])

      const html = await (await app.request('/profile')).text()

      expect(html).toMatch(/no applications|not authorized any/i)
    })

    it('revokes a grant and confirms it', async () => {
      const res = await app.request(
        '/profile',
        formBody({ intent: 'revoke-oauth-grant', tokenId: 'token-1' })
      )

      expect(svc.revokeGrant).toHaveBeenCalledWith(expect.anything(), 'token-1')
      expect(await renderedProfile(res)).toMatch(/access revoked/i)
    })

    // A second tab, or the back button: the grant is already gone by the time
    // the form arrives. That is a stale form, not a server fault.
    it('reports a grant that is already gone as a rejected form', async () => {
      svc.revokeGrant.mockRejectedValue(
        new OAuthInvalidGrantError('No such grant')
      )

      const res = await app.request(
        '/profile',
        formBody({ intent: 'revoke-oauth-grant', tokenId: 'gone' })
      )

      expect(res.status).toBe(400)
    })

    it('keeps the grants on screen when another action fails', async () => {
      svc.changePassword.mockRejectedValue(new InvalidCredentialsError())

      const res = await app.request(
        '/profile',
        formBody({
          intent: 'change-password',
          currentPassword: 'wrong',
          newPassword: 'newpassword123',
        })
      )

      expect(res.status).toBe(400)
      expect(await res.text()).toContain('Claude Code')
    })
  })
})
