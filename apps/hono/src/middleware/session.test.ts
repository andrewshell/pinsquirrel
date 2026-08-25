import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { Context } from 'hono'
import {
  sessionMiddleware,
  requireAuth,
  getSessionManager,
  getAuthUser,
} from './session'

// Create mock functions
const mockIsValidSession = vi.fn()
const mockFindById = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockFindUserById = vi.fn()

// Mock the database module
vi.mock('../lib/db', () => ({
  sessionRepository: {
    isValidSession: (...args: unknown[]): Promise<boolean> =>
      mockIsValidSession(...args) as Promise<boolean>,
    findById: (...args: unknown[]): Promise<unknown> =>
      mockFindById(...args) as Promise<unknown>,
    create: (...args: unknown[]): Promise<unknown> =>
      mockCreate(...args) as Promise<unknown>,
    update: (...args: unknown[]): Promise<unknown> =>
      mockUpdate(...args) as Promise<unknown>,
    delete: (...args: unknown[]): Promise<boolean> =>
      mockDelete(...args) as Promise<boolean>,
  },
  userRepository: {
    findById: (...args: unknown[]): Promise<unknown> =>
      mockFindUserById(...args) as Promise<unknown>,
  },
}))

describe('Session Middleware', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
    app.use('*', sessionMiddleware())
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('without session cookie', () => {
    it('provides session manager with null session', async () => {
      app.get('/test', c => {
        const manager = getSessionManager(c)
        return c.json({
          isAuthenticated: manager.isAuthenticated(),
          userId: manager.getUserId(),
          session: manager.getSession(),
        })
      })

      const res = await app.request('/test')
      const json = await res.json()

      expect(json.isAuthenticated).toBe(false)
      expect(json.userId).toBeNull()
      expect(json.session).toBeNull()
    })
  })

  describe('with valid session cookie', () => {
    const mockSession = {
      id: 'session-123',
      userId: 'user-456',
      data: { userId: 'user-456', keepSignedIn: true },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    }

    beforeEach(() => {
      mockIsValidSession.mockResolvedValue(true)
      mockFindById.mockResolvedValue(mockSession)
    })

    it('loads session from database', async () => {
      app.get('/test', c => {
        const manager = getSessionManager(c)
        return c.json({
          isAuthenticated: manager.isAuthenticated(),
          userId: manager.getUserId(),
        })
      })

      const res = await app.request('/test', {
        headers: {
          Cookie: '__session=session-123',
        },
      })
      const json = await res.json()

      expect(json.isAuthenticated).toBe(true)
      expect(json.userId).toBe('user-456')
      expect(mockIsValidSession).toHaveBeenCalledWith('session-123')
      expect(mockFindById).toHaveBeenCalledWith('session-123')
    })

    it('returns user from database', async () => {
      const mockUser = {
        id: 'user-456',
        username: 'testuser',
        passwordHash: 'hash',
        emailHash: 'emailhash',
        roles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockFindUserById.mockResolvedValue(mockUser)

      app.get('/test', async c => {
        const manager = getSessionManager(c)
        const user = await manager.getUser()
        return c.json({
          username: user?.username,
        })
      })

      const res = await app.request('/test', {
        headers: {
          Cookie: '__session=session-123',
        },
      })
      const json = await res.json()

      expect(json.username).toBe('testuser')
      expect(mockFindUserById).toHaveBeenCalledWith('user-456')
    })
  })

  describe('with expired session cookie', () => {
    beforeEach(() => {
      mockIsValidSession.mockResolvedValue(false)
    })

    it('clears cookie and returns null session', async () => {
      app.get('/test', c => {
        const manager = getSessionManager(c)
        return c.json({
          isAuthenticated: manager.isAuthenticated(),
        })
      })

      const res = await app.request('/test', {
        headers: {
          Cookie: '__session=expired-session',
        },
      })
      const json = await res.json()

      expect(json.isAuthenticated).toBe(false)
      // Check that cookie is being cleared (has Max-Age=0 or expires in past)
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
    })
  })

  describe('session creation', () => {
    it('creates new session and sets cookie', async () => {
      const newSession = {
        id: 'new-session-789',
        userId: 'user-456',
        data: { userId: 'user-456', keepSignedIn: true },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      }
      mockCreate.mockResolvedValue(newSession)

      app.post('/login', async c => {
        const manager = getSessionManager(c)
        await manager.create('user-456', true)
        return c.json({ success: true })
      })

      const res = await app.request('/login', { method: 'POST' })
      const json = await res.json()

      expect(json.success).toBe(true)
      expect(mockCreate).toHaveBeenCalledWith({
        userId: 'user-456',
        data: { userId: 'user-456', keepSignedIn: true },
        expiresAt: expect.any(Date),
      })

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('__session=new-session-789')
      expect(setCookie).toContain('HttpOnly')
      expect(setCookie).toContain('SameSite=Lax')
    })

    it('creates session without persistent cookie when keepSignedIn is false', async () => {
      const newSession = {
        id: 'new-session-789',
        userId: 'user-456',
        data: { userId: 'user-456', keepSignedIn: false },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      }
      mockCreate.mockResolvedValue(newSession)

      app.post('/login', async c => {
        const manager = getSessionManager(c)
        await manager.create('user-456', false)
        return c.json({ success: true })
      })

      const res = await app.request('/login', { method: 'POST' })

      expect(mockCreate).toHaveBeenCalledWith({
        userId: 'user-456',
        data: { userId: 'user-456', keepSignedIn: false },
        expiresAt: expect.any(Date),
      })

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('__session=new-session-789')
      // Should NOT contain Max-Age for session cookies
      expect(setCookie).not.toContain('Max-Age=2592000')
    })
  })

  describe('session destruction', () => {
    const mockSession = {
      id: 'session-123',
      userId: 'user-456',
      data: { userId: 'user-456', keepSignedIn: true },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    }

    beforeEach(() => {
      mockIsValidSession.mockResolvedValue(true)
      mockFindById.mockResolvedValue(mockSession)
      mockDelete.mockResolvedValue(true)
    })

    it('destroys session and clears cookie', async () => {
      app.post('/logout', async c => {
        const manager = getSessionManager(c)
        await manager.destroy()
        return c.json({ success: true })
      })

      const res = await app.request('/logout', {
        method: 'POST',
        headers: {
          Cookie: '__session=session-123',
        },
      })
      const json = await res.json()

      expect(json.success).toBe(true)
      expect(mockDelete).toHaveBeenCalledWith('session-123')

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
    })
  })

  describe('flash messages', () => {
    const mockSession = {
      id: 'session-123',
      userId: 'user-456',
      data: { userId: 'user-456', keepSignedIn: true },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    }

    beforeEach(() => {
      mockIsValidSession.mockResolvedValue(true)
      mockFindById.mockResolvedValue(mockSession)
      mockUpdate.mockResolvedValue(mockSession)
    })

    it('sets flash message', async () => {
      app.post('/action', c => {
        const manager = getSessionManager(c)
        manager.setFlash('success', 'Action completed!')
        return c.json({ success: true })
      })

      await app.request('/action', {
        method: 'POST',
        headers: {
          Cookie: '__session=session-123',
        },
      })

      expect(mockUpdate).toHaveBeenCalledWith('session-123', {
        data: expect.objectContaining({
          flash: { type: 'success', message: 'Action completed!' },
        }),
      })
    })

    it('gets and clears flash message', async () => {
      const sessionWithFlash = {
        ...mockSession,
        data: {
          userId: 'user-456',
          keepSignedIn: true,
          flash: { type: 'success' as const, message: 'Welcome back!' },
        },
      }
      mockFindById.mockResolvedValue(sessionWithFlash)

      app.get('/page', c => {
        const manager = getSessionManager(c)
        const flash = manager.getFlash()
        return c.json({ flash })
      })

      const res = await app.request('/page', {
        headers: {
          Cookie: '__session=session-123',
        },
      })
      const json = await res.json()

      expect(json.flash).toEqual({
        type: 'success',
        message: 'Welcome back!',
      })

      // Flash should be cleared from session
      expect(mockUpdate).toHaveBeenCalledWith('session-123', {
        data: expect.objectContaining({
          flash: undefined,
        }),
      })
    })
  })
})

describe('requireAuth Middleware', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
    app.use('*', sessionMiddleware())
  })

  it('redirects to signin when not authenticated', async () => {
    app.get('/protected', requireAuth(), c => {
      return c.json({ protected: true })
    })

    const res = await app.request('/protected')

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/signin?redirectTo=%2Fprotected')
  })

  it('allows access when authenticated', async () => {
    const mockSession = {
      id: 'session-123',
      userId: 'user-456',
      data: { userId: 'user-456', keepSignedIn: true },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    }
    mockIsValidSession.mockResolvedValue(true)
    mockFindById.mockResolvedValue(mockSession)
    // requireAuth now resolves the user as well as checking the session, so a
    // request only counts as authenticated if the user row is actually there.
    mockFindUserById.mockResolvedValue({ id: 'user-456', username: 'alice' })

    app.get('/protected', requireAuth(), c => {
      return c.json({ protected: true })
    })

    const res = await app.request('/protected', {
      headers: {
        Cookie: '__session=session-123',
      },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.protected).toBe(true)
  })

  it('uses custom redirect path', async () => {
    app.get('/admin', requireAuth('/admin/login'), c => {
      return c.json({ admin: true })
    })

    const res = await app.request('/admin')

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/admin/login?redirectTo=%2Fadmin')
  })

  describe('resolved user', () => {
    const validSession = {
      id: 'session-123',
      userId: 'user-456',
      data: { userId: 'user-456', keepSignedIn: true },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    }
    const authedRequest = { headers: { Cookie: '__session=session-123' } }

    beforeEach(() => {
      mockIsValidSession.mockResolvedValue(true)
      mockFindById.mockResolvedValue(validSession)
    })

    it('exposes the resolved user to handlers via getAuthUser', async () => {
      mockFindUserById.mockResolvedValue({ id: 'user-456', username: 'alice' })

      app.get('/protected', requireAuth(), c => {
        return c.json({ username: getAuthUser(c).username })
      })

      const res = await app.request('/protected', authedRequest)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ username: 'alice' })
    })

    it('resolves the user exactly once per request', async () => {
      mockFindUserById.mockResolvedValue({ id: 'user-456', username: 'alice' })

      app.get('/protected', requireAuth(), c => {
        getAuthUser(c)
        getAuthUser(c)
        return c.json({ ok: true })
      })

      await app.request('/protected', authedRequest)

      expect(mockFindUserById).toHaveBeenCalledTimes(1)
    })

    it('redirects when the session references a user that no longer exists', async () => {
      // The session carries a userId, so isAuthenticated() is true, but the row
      // is gone — e.g. the account was deleted mid-session. Handlers used to
      // each cope with this themselves, inconsistently; it is now one redirect.
      mockFindUserById.mockResolvedValue(null)

      const handler = vi.fn((c: Context) => c.json({ reached: true }))
      app.get('/protected', requireAuth(), handler)

      const res = await app.request('/protected', authedRequest)

      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe(
        '/signin?redirectTo=%2Fprotected'
      )
      expect(handler).not.toHaveBeenCalled()
    })

    it('throws rather than returning undefined when requireAuth is missing', async () => {
      // Wiring guard: if a router loses its requireAuth(), handlers calling
      // getAuthUser must fail loudly (500) instead of proceeding with an
      // undefined user, which would read as "no user" and silently skip
      // ownership checks.
      mockFindUserById.mockResolvedValue({ id: 'user-456', username: 'alice' })

      app.get('/unguarded', c => c.json({ id: getAuthUser(c).id }))

      const res = await app.request('/unguarded', authedRequest)

      expect(res.status).toBe(500)
    })

    it('does not hit the user repository when there is no session at all', async () => {
      mockIsValidSession.mockResolvedValue(false)
      mockFindById.mockResolvedValue(null)

      app.get('/protected', requireAuth(), c => c.json({ ok: true }))

      const res = await app.request('/protected')

      expect(res.status).toBe(302)
      expect(mockFindUserById).not.toHaveBeenCalled()
    })
  })
})

describe('Private Mode', () => {
  let app: Hono

  const mockSession = {
    id: 'session-123',
    userId: 'user-456',
    data: { userId: 'user-456', keepSignedIn: true },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
    app.use('*', sessionMiddleware())

    mockIsValidSession.mockResolvedValue(true)
    mockFindById.mockResolvedValue(mockSession)
    mockUpdate.mockResolvedValue(mockSession)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should report private mode as locked by default', async () => {
    app.get('/test', c => {
      const manager = getSessionManager(c)
      return c.json({
        isPrivateUnlocked: manager.isPrivateUnlocked(),
      })
    })

    const res = await app.request('/test', {
      headers: { Cookie: '__session=session-123' },
    })
    const json = await res.json()

    expect(json.isPrivateUnlocked).toBe(false)
  })

  it('should unlock private mode and persist to session', async () => {
    app.post('/unlock', c => {
      const manager = getSessionManager(c)
      manager.unlockPrivateMode()
      return c.json({
        isPrivateUnlocked: manager.isPrivateUnlocked(),
      })
    })

    const res = await app.request('/unlock', {
      method: 'POST',
      headers: { Cookie: '__session=session-123' },
    })
    const json = await res.json()

    expect(json.isPrivateUnlocked).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      'session-123',
      expect.objectContaining({
        data: expect.objectContaining({
          privateUnlockedAt: expect.any(Number),
        }),
      })
    )
  })

  it('should lock private mode and clear the timestamp', async () => {
    const sessionWithPrivate = {
      ...mockSession,
      data: {
        userId: 'user-456',
        keepSignedIn: true,
        privateUnlockedAt: Date.now(),
      },
    }
    mockFindById.mockResolvedValue(sessionWithPrivate)

    app.post('/lock', c => {
      const manager = getSessionManager(c)
      manager.lockPrivateMode()
      return c.json({
        isPrivateUnlocked: manager.isPrivateUnlocked(),
      })
    })

    const res = await app.request('/lock', {
      method: 'POST',
      headers: { Cookie: '__session=session-123' },
    })
    const json = await res.json()

    expect(json.isPrivateUnlocked).toBe(false)
    expect(mockUpdate).toHaveBeenCalledWith(
      'session-123',
      expect.objectContaining({
        data: expect.objectContaining({
          privateUnlockedAt: undefined,
        }),
      })
    )
  })

  it('should report expired private mode as locked after 15 minutes', async () => {
    const sixteenMinutesAgo = Date.now() - 16 * 60 * 1000
    const sessionWithExpiredPrivate = {
      ...mockSession,
      data: {
        userId: 'user-456',
        keepSignedIn: true,
        privateUnlockedAt: sixteenMinutesAgo,
      },
    }
    mockFindById.mockResolvedValue(sessionWithExpiredPrivate)

    app.get('/test', c => {
      const manager = getSessionManager(c)
      return c.json({
        isPrivateUnlocked: manager.isPrivateUnlocked(),
      })
    })

    const res = await app.request('/test', {
      headers: { Cookie: '__session=session-123' },
    })
    const json = await res.json()

    expect(json.isPrivateUnlocked).toBe(false)
  })

  it('should report active private mode as unlocked within 15 minutes', async () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const sessionWithActivePrivate = {
      ...mockSession,
      data: {
        userId: 'user-456',
        keepSignedIn: true,
        privateUnlockedAt: fiveMinutesAgo,
      },
    }
    mockFindById.mockResolvedValue(sessionWithActivePrivate)

    app.get('/test', c => {
      const manager = getSessionManager(c)
      return c.json({
        isPrivateUnlocked: manager.isPrivateUnlocked(),
      })
    })

    const res = await app.request('/test', {
      headers: { Cookie: '__session=session-123' },
    })
    const json = await res.json()

    expect(json.isPrivateUnlocked).toBe(true)
  })
})
