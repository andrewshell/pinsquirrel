import { createHash } from 'node:crypto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { Role, UserStatus } from '@pinsquirrel/domain'
import {
  sessionMiddleware,
  requireAuth,
  getSessionManager,
  getAuthUser,
} from './session'

const alice = {
  id: 'user-456',
  username: 'alice',
  roles: [Role.User],
  status: UserStatus.Active,
}

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex')

function cookieSetBy(res: Response, name: string): string | undefined {
  const header = res.headers.getSetCookie().find(h => h.startsWith(`${name}=`))
  return header?.split(';')[0]!.slice(name.length + 1)
}

// Create mock functions
const mockIsValidSession = vi.fn()
const mockFindById = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockPatchData = vi.fn()
const mockFindUserById = vi.fn()

/**
 * A session row that the fake repository reads and writes, so a test can
 * assert what ends up stored whichever write method the middleware uses.
 */
function storedSession(data: Record<string, unknown>) {
  const row = {
    id: 'session-123',
    userId: 'user-456',
    data,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  }
  mockIsValidSession.mockResolvedValue(true)
  mockFindById.mockImplementation(() =>
    Promise.resolve({ ...row, data: { ...row.data } })
  )
  mockUpdate.mockImplementation(
    (_id: string, update: { data?: Record<string, unknown> }) => {
      if (update.data) row.data = { ...update.data }
      return Promise.resolve(row)
    }
  )
  mockPatchData.mockImplementation(
    (_id: string, patch: { set: Record<string, unknown>; unset: string[] }) => {
      const next: Record<string, unknown> = { ...row.data, ...patch.set }
      for (const key of patch.unset) delete next[key]
      row.data = next
      return Promise.resolve()
    }
  )
  return row
}

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
    patchData: (...args: unknown[]): Promise<void> =>
      mockPatchData(...args) as Promise<void>,
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
      expect(mockIsValidSession).toHaveBeenCalledWith(sha256('session-123'))
      expect(mockFindById).toHaveBeenCalledWith(sha256('session-123'))
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
        id: expect.any(String),
        userId: 'user-456',
        data: { userId: 'user-456', keepSignedIn: true },
        expiresAt: expect.any(Date),
      })

      const token = cookieSetBy(res, '__session')!
      const { id } = mockCreate.mock.calls[0][0] as { id: string }
      expect(id).toBe(sha256(token))
      expect(token).not.toBe(id)

      const setCookie = res.headers.get('set-cookie')
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
        id: expect.any(String),
        userId: 'user-456',
        data: { userId: 'user-456', keepSignedIn: false },
        expiresAt: expect.any(Date),
      })

      const setCookie = res.headers.get('set-cookie')
      expect(cookieSetBy(res, '__session')).toBeTruthy()
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
      const row = storedSession({ userId: 'user-456', keepSignedIn: true })
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

      expect(row.data.flash).toEqual({
        type: 'success',
        message: 'Action completed!',
      })
    })

    it('gets and clears flash message', async () => {
      const row = storedSession({
        userId: 'user-456',
        keepSignedIn: true,
        flash: { type: 'success', message: 'Welcome back!' },
      })

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

      expect(row.data).not.toHaveProperty('flash')
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

  it('keeps the sign-in page in embed mode when the request was', async () => {
    app.get('/protected', requireAuth(), c => {
      return c.json({ protected: true })
    })

    const res = await app.request('/protected?embed=1')

    expect(res.status).toBe(302)
    // The redirectTo carries the original query, so after sign-in the user
    // lands back in embed; the trailing embed=1 is for the sign-in page itself.
    expect(res.headers.get('location')).toBe(
      '/signin?redirectTo=%2Fprotected%3Fembed%3D1&embed=1'
    )
  })

  it('does not put a page into embed mode for any other embed value', async () => {
    app.get('/protected', requireAuth(), c => {
      return c.json({ protected: true })
    })

    const res = await app.request('/protected?embed=yes')

    expect(res.headers.get('location')).toBe(
      '/signin?redirectTo=%2Fprotected%3Fembed%3Dyes'
    )
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
    mockFindUserById.mockResolvedValue(alice)

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
      mockFindUserById.mockResolvedValue(alice)

      app.get('/protected', requireAuth(), c => {
        return c.json({ username: getAuthUser(c).username })
      })

      const res = await app.request('/protected', authedRequest)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ username: 'alice' })
    })

    it('resolves the user exactly once per request', async () => {
      mockFindUserById.mockResolvedValue(alice)

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

    it('ends the session of a user who no longer holds the User role', async () => {
      mockFindUserById.mockResolvedValue({ ...alice, roles: [] })
      mockDelete.mockResolvedValue(true)

      const handler = vi.fn((c: Context) => c.json({ reached: true }))
      app.get('/pins', requireAuth(), handler)

      const res = await app.request('/pins', authedRequest)

      expect(handler).not.toHaveBeenCalled()
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toMatch(/^\/signin/)
      expect(mockDelete).toHaveBeenCalledWith(validSession.id)
    })

    it('ends the session of a user who is no longer active', async () => {
      mockFindUserById.mockResolvedValue({
        ...alice,
        status: UserStatus.Waitlist,
      })

      const handler = vi.fn((c: Context) => c.json({ reached: true }))
      app.get('/pins', requireAuth(), handler)

      const res = await app.request('/pins', authedRequest)

      expect(handler).not.toHaveBeenCalled()
      expect(res.headers.get('location')).toMatch(/^\/signin/)
    })

    it('throws rather than returning undefined when requireAuth is missing', async () => {
      // Wiring guard: if a router loses its requireAuth(), handlers calling
      // getAuthUser must fail loudly (500) instead of proceeding with an
      // undefined user, which would read as "no user" and silently skip
      // ownership checks.
      mockFindUserById.mockResolvedValue(alice)

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
    const row = storedSession({ userId: 'user-456', keepSignedIn: true })
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
    expect(row.data.privateUnlockedAt).toEqual(expect.any(Number))
  })

  it('should lock private mode and clear the timestamp', async () => {
    const row = storedSession({
      userId: 'user-456',
      keepSignedIn: true,
      privateUnlockedAt: Date.now(),
    })

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
    expect(row.data).not.toHaveProperty('privateUnlockedAt')
  })

  // A save in one tab and a lock (or the tab-close beacon) in another overlap
  // on one session. The save started while private mode was unlocked; it must
  // not write that back over the lock.
  it('keeps a lock made while another request on the session was in flight', async () => {
    const row = storedSession({
      userId: 'user-456',
      keepSignedIn: true,
      privateUnlockedAt: Date.now(),
    })
    let saveLoaded!: () => void
    const loaded = new Promise<void>(resolve => (saveLoaded = resolve))
    let finishSave!: () => void
    const saving = new Promise<void>(resolve => (finishSave = resolve))

    app.post('/save', async c => {
      getSessionManager(c).setFlash('success', 'Pin saved')
      saveLoaded()
      await saving
      return c.text('ok')
    })
    app.post('/lock', c => {
      getSessionManager(c).lockPrivateMode()
      return c.text('ok')
    })
    const cookie = { headers: { Cookie: '__session=session-123' } }

    const save = app.request('/save', { method: 'POST', ...cookie })
    await loaded
    await app.request('/lock', { method: 'POST', ...cookie })
    finishSave()
    await save

    expect(row.data).not.toHaveProperty('privateUnlockedAt')
    expect(row.data.flash).toEqual({ type: 'success', message: 'Pin saved' })
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
