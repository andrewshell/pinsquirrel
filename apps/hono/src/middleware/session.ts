/**
 * Cookie-backed sessions.
 *
 * This file talks to the repositories directly, which nothing else outside the
 * composition root does. That is deliberate, not an oversight.
 *
 * Everywhere else, an app calling a repository skips the layer that enforces
 * authorization and validation — that is what let the REST API list private
 * pins, and what let the tag merge rules be enforced by a form instead of the
 * operation. None of that applies here: a session is how an AccessControl gets
 * built in the first place, so there is no authorization to bypass and nothing
 * for a service to check. A SessionService would take no AccessControl, and
 * only this app could ever call it — the admin app keeps its sessions in
 * memory, and an API client or a CLI has no session at all.
 *
 * So the persistence stays here, alongside the parts that are unambiguously
 * web-only: the cookie itself, the flash message that survives one redirect,
 * and the private-unlock window. The equivalent for API callers does live in a
 * service — OAuthService.verifyAccessToken — because a token resolves to a
 * principal the same way for every transport.
 *
 * If sessions ever need to be readable from outside this app, that is the
 * point to revisit this.
 */
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Session, User } from '@pinsquirrel/domain'
import { sessionRepository, userRepository } from '../lib/db'

// Session configuration
const SESSION_COOKIE_NAME = '__session'
const SESSION_DURATION_PERSISTENT = 30 * 24 * 60 * 60 * 1000 // 30 days
const SESSION_DURATION_TEMPORARY = 24 * 60 * 60 * 1000 // 24 hours (for browser session)
const PRIVATE_MODE_DURATION = 15 * 60 * 1000 // 15 minutes

// Every write of the session cookie — set, clear on expiry, clear on
// destroy — has to agree on these, or a cookie set one way is not the cookie
// deleted the other way. `secure` is read per call rather than at module load
// so tests can vary NODE_ENV.
const sessionCookieOptions = () => ({
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Lax' as const,
})

// Flash message types
export type FlashType = 'success' | 'error' | 'info' | 'warning'
export type FlashMessage = { type: FlashType; message: string }

// Session data stored in the database
export interface SessionData {
  userId: string
  keepSignedIn: boolean
  flash?: {
    type: FlashType
    message: string
  }
  privateUnlockedAt?: number
  [key: string]: unknown
}

// Session manager exposed to routes
export interface SessionManager {
  // Get the current session (may be null if not authenticated)
  getSession(): Session | null

  // Get session data
  getData(): SessionData | null

  // Get the current user (may be null if not authenticated)
  getUser(): Promise<User | null>

  // Get user ID from session
  getUserId(): string | null

  // Create a new session for a user
  create(userId: string, keepSignedIn?: boolean): Promise<void>

  // Destroy the current session (logout)
  destroy(): Promise<void>

  // Set a flash message
  setFlash(type: FlashType, message: string): void

  // Get and clear flash message
  getFlash(): { type: FlashType; message: string } | null

  // Check if user is authenticated
  isAuthenticated(): boolean

  // Private mode methods
  unlockPrivateMode(): void
  lockPrivateMode(): void
  isPrivateUnlocked(): boolean
}

// Variables stored in context
interface SessionVariables {
  session: Session | null
  sessionManager: SessionManager
  // Set by requireAuth() only. Routes behind that middleware read it with
  // getAuthUser(); anywhere else it is absent, which is why it is not typed as
  // a plain `User` here.
  authUser: User | undefined
}

// Extend Hono's context types
declare module 'hono' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ContextVariableMap extends SessionVariables {}
}

// Create session middleware
export function sessionMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    // Load session from cookie
    const sessionId = getCookie(c, SESSION_COOKIE_NAME)
    let session: Session | null = null
    let sessionData: SessionData | null = null
    let pendingFlash: { type: FlashType; message: string } | null = null
    let sessionModified = false
    let sessionDestroyed = false

    if (sessionId) {
      // Load session from database
      const isValid = await sessionRepository.isValidSession(sessionId)
      if (isValid) {
        session = await sessionRepository.findById(sessionId)
        if (session) {
          sessionData = session.data as SessionData | null
        }
      } else {
        // Session expired or invalid - clear the cookie
        deleteCookie(c, SESSION_COOKIE_NAME, sessionCookieOptions())
      }
    }

    // Create session manager
    const sessionManager: SessionManager = {
      getSession() {
        return session
      },

      getData() {
        return sessionData
      },

      getUserId() {
        return sessionData?.userId ?? null
      },

      async getUser() {
        const userId = this.getUserId()
        if (!userId) return null
        return await userRepository.findById(userId)
      },

      isAuthenticated() {
        return sessionData?.userId != null
      },

      async create(userId: string, keepSignedIn = true) {
        // If there's an existing session, destroy it first
        if (session) {
          await sessionRepository.delete(session.id)
        }

        const expiresAt = new Date(
          Date.now() +
            (keepSignedIn
              ? SESSION_DURATION_PERSISTENT
              : SESSION_DURATION_TEMPORARY)
        )

        const newSessionData: SessionData = {
          userId,
          keepSignedIn,
        }

        session = await sessionRepository.create({
          userId,
          data: newSessionData,
          expiresAt,
        })

        sessionData = newSessionData

        // Set the session cookie
        setCookie(c, SESSION_COOKIE_NAME, session.id, {
          ...sessionCookieOptions(),
          ...(keepSignedIn
            ? { maxAge: SESSION_DURATION_PERSISTENT / 1000 }
            : {}),
        })
      },

      async destroy() {
        if (session) {
          await sessionRepository.delete(session.id)
          session = null
          sessionData = null
          sessionDestroyed = true
        }

        // Clear the cookie
        deleteCookie(c, SESSION_COOKIE_NAME, sessionCookieOptions())
      },

      setFlash(type: FlashType, message: string) {
        pendingFlash = { type, message }
        sessionModified = true
      },

      getFlash() {
        if (!sessionData?.flash) return null
        const flash = sessionData.flash
        // Mark for removal after reading
        if (sessionData) {
          sessionData = { ...sessionData, flash: undefined }
          sessionModified = true
        }
        return flash
      },

      unlockPrivateMode() {
        if (sessionData) {
          sessionData = { ...sessionData, privateUnlockedAt: Date.now() }
          sessionModified = true
        }
      },

      lockPrivateMode() {
        if (sessionData) {
          sessionData = { ...sessionData, privateUnlockedAt: undefined }
          sessionModified = true
        }
      },

      isPrivateUnlocked() {
        if (!sessionData?.privateUnlockedAt) return false
        return (
          Date.now() - sessionData.privateUnlockedAt < PRIVATE_MODE_DURATION
        )
      },
    }

    // Store session and manager in context
    c.set('session', session)
    c.set('sessionManager', sessionManager)

    // Execute the route handler
    await next()

    // After handler: persist session changes
    if (sessionDestroyed) {
      // Session was destroyed, nothing more to do
      return
    }

    // If there's a pending flash or session was modified, update the database
    if (session && (sessionModified || pendingFlash)) {
      const updatedData: SessionData = {
        ...sessionData!,
        ...(pendingFlash ? { flash: pendingFlash } : {}),
      }

      await sessionRepository.update(session.id, {
        data: updatedData,
      })
    }
  }
}

// Helper middleware to require authentication
/**
 * Gate a route on a signed-in user, and resolve that user once for the whole
 * request.
 *
 * Two ways to fail, both ending in the same redirect: there is no session at
 * all, or the session names a user that no longer exists (deleted mid-session).
 * The second used to fall through to the handlers, which each coped with it
 * differently — some redirected, some returned `HX-Redirect` with a 204 — so
 * the same condition produced eight different responses across the app.
 *
 * On success the resolved user is stashed on the context. Handlers read it with
 * `getAuthUser(c)` instead of awaiting `getUser()` themselves, which keeps the
 * user lookup to one query per request and removes the unreachable null check
 * that every handler carried.
 */
export function requireAuth(redirectTo = '/signin'): MiddlewareHandler {
  return async (c, next) => {
    const sessionManager = c.get('sessionManager')

    const redirectToSignin = () => {
      const url = new URL(c.req.url)
      const currentPath = url.pathname + url.search
      const redirectUrl =
        redirectTo +
        (currentPath !== '/'
          ? `?redirectTo=${encodeURIComponent(currentPath)}`
          : '')
      return c.redirect(redirectUrl)
    }

    // Checked before getUser() so an anonymous request never touches the
    // database.
    if (!sessionManager.isAuthenticated()) {
      return redirectToSignin()
    }

    const user = await sessionManager.getUser()
    if (!user) {
      return redirectToSignin()
    }

    c.set('authUser', user)
    await next()
  }
}

// Helper to get session manager from context
export function getSessionManager(c: Context): SessionManager {
  return c.get('sessionManager')
}

/**
 * The signed-in user for a route mounted behind `requireAuth()`.
 *
 * Non-null by construction: the middleware redirects rather than calling the
 * handler when no user resolves. Throws if called from a route that is not
 * behind `requireAuth()`, which is a wiring mistake rather than a runtime
 * condition to handle.
 */
export function getAuthUser(c: Context): User {
  const user = c.get('authUser')
  if (!user) {
    throw new Error(
      'getAuthUser() called on a route that is not behind requireAuth()'
    )
  }
  return user
}
