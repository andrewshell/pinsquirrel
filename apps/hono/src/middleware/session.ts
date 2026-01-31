import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Session, User } from '@pinsquirrel/domain'
import { sessionRepository, userRepository } from '../lib/db'

// Session configuration
const SESSION_COOKIE_NAME = '__session'
const SESSION_DURATION_PERSISTENT = 30 * 24 * 60 * 60 * 1000 // 30 days
const SESSION_DURATION_TEMPORARY = 24 * 60 * 60 * 1000 // 24 hours (for browser session)

// Flash message types
export type FlashType = 'success' | 'error' | 'info' | 'warning'

// Session data stored in the database
export interface SessionData {
  userId: string
  keepSignedIn: boolean
  flash?: {
    type: FlashType
    message: string
  }
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
}

// Variables stored in context
interface SessionVariables {
  session: Session | null
  sessionManager: SessionManager
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
        deleteCookie(c, SESSION_COOKIE_NAME, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Lax',
        })
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
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Lax',
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
        deleteCookie(c, SESSION_COOKIE_NAME, {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Lax',
        })
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
export function requireAuth(redirectTo = '/signin'): MiddlewareHandler {
  return async (c, next) => {
    const sessionManager = c.get('sessionManager')

    if (!sessionManager.isAuthenticated()) {
      const url = new URL(c.req.url)
      const currentPath = url.pathname + url.search
      const redirectUrl =
        redirectTo +
        (currentPath !== '/'
          ? `?redirectTo=${encodeURIComponent(currentPath)}`
          : '')
      return c.redirect(redirectUrl)
    }

    await next()
  }
}

// Helper to get session manager from context
export function getSessionManager(c: Context): SessionManager {
  return c.get('sessionManager')
}
