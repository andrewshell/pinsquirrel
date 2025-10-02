import { createCookieSessionStorage, redirect } from 'react-router'
// Import userRepository directly since session validation is infrastructure-level,
// not business logic that requires AccessControl
import {
  DrizzleUserRepository,
  createDatabaseClient,
} from '@pinsquirrel/database'
import { logger } from './logger.server'
import { AccessControl } from '@pinsquirrel/domain'

// Create database client and user repository for session validation
const db = createDatabaseClient(
  process.env.DATABASE_URL || 'postgresql://localhost:5432/pinsquirrel'
)
const userRepository = new DrizzleUserRepository(db)

// Session storage configuration
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    // No default maxAge - we'll set it per session based on keepSignedIn
    sameSite: 'lax',
    secrets: [process.env.SESSION_SECRET || 'dev-secret-change-in-production'],
  },
})

// Session management functions
export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get('Cookie'))
}

export async function getUserId(request: Request): Promise<string | null> {
  const session = await getSession(request)
  return (session.get('userId') as string) || null
}

export async function getUser(request: Request) {
  const userId = await getUserId(request)
  if (!userId) return null

  try {
    const user = await userRepository.findById(userId)
    if (!user) {
      logger.warn('User not found for valid session', { userId })
      // Clear the invalid session and redirect to signin
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect('/signin', {
        headers: {
          'Set-Cookie': await sessionStorage.destroySession(
            await getSession(request)
          ),
        },
      })
    }

    return user
  } catch (error) {
    logger.exception(error, 'Failed to fetch user from session', { userId })
    // If user lookup fails, clear the session
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect('/signin', {
      headers: {
        'Set-Cookie': await sessionStorage.destroySession(
          await getSession(request)
        ),
      },
    })
  }
}

export async function extendSessionIfNeeded(
  request: Request
): Promise<string | null> {
  const session = await getSession(request)
  const keepSignedIn = session.get('keepSignedIn') as boolean | undefined

  // Only extend session if user chose to keep signed in
  if (keepSignedIn) {
    const cookieOptions = { maxAge: 60 * 60 * 24 * 30 } // Reset to 30 days
    return await sessionStorage.commitSession(session, cookieOptions)
  }

  return null
}

export async function requireUser(request: Request) {
  const user = await getUser(request)
  if (!user) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect('/signin')
  }
  return user
}

export async function requireAccessControl(request: Request) {
  const user = await getUser(request)
  if (!user) {
    const url = new URL(request.url)
    const redirectTo = url.pathname + url.search
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect(`/signin?redirectTo=${encodeURIComponent(redirectTo)}`)
  }
  return new AccessControl(user)
}

export async function createUserSession(
  userId: string,
  redirectTo: string = '/',
  keepSignedIn: boolean = true
) {
  const session = await sessionStorage.getSession()
  session.set('userId', userId)
  session.set('keepSignedIn', keepSignedIn)

  // Create true session cookies when keepSignedIn is false
  // NOTE: Modern browsers (Chrome, Firefox, Safari) with session restore features
  // may persist session cookies across browser restarts. This is browser behavior,
  // not an application bug. True session-only behavior requires disabling session restore.
  const cookieOptions = keepSignedIn
    ? { maxAge: 60 * 60 * 24 * 30 } // 30 days persistent cookie
    : {} // True session cookie - no maxAge or expires

  const cookieHeader = await sessionStorage.commitSession(
    session,
    cookieOptions
  )

  logger.info('User session created', {
    userId,
    redirectTo,
    keepSignedIn,
    cookieOptions,
  })

  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': cookieHeader,
    },
  })
}

export async function logout(request: Request) {
  const session = await getSession(request)
  const userId = session.get('userId') as string | undefined

  if (userId) {
    logger.info('User logout', { userId })
  }

  return redirect('/signin', {
    headers: {
      'Set-Cookie': await sessionStorage.destroySession(session),
    },
  })
}

export async function setFlashMessage(
  request: Request,
  type: 'success' | 'error',
  message: string,
  redirectTo: string
) {
  const session = await getSession(request)
  session.flash(`flash-${type}`, message)

  // Preserve the user's keepSignedIn preference when setting flash message
  const keepSignedIn = session.get('keepSignedIn') as boolean | undefined
  const cookieOptions = keepSignedIn ? { maxAge: 60 * 60 * 24 * 30 } : {} // Session cookie - subject to browser session restore behavior

  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session, cookieOptions),
    },
  })
}

export async function getFlashMessage(
  request: Request,
  type: 'success' | 'error'
): Promise<string | null> {
  const session = await getSession(request)
  const message = session.get(`flash-${type}`) as string | null

  return message
}

export async function commitSession(
  session: Awaited<ReturnType<typeof getSession>>
) {
  // Preserve the user's keepSignedIn preference when committing session
  const keepSignedIn = session.get('keepSignedIn') as boolean | undefined
  const cookieOptions = keepSignedIn ? { maxAge: 60 * 60 * 24 * 30 } : {} // Session cookie - subject to browser session restore behavior

  return sessionStorage.commitSession(session, cookieOptions)
}
