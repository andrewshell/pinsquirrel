import { createCookieSessionStorage, redirect } from 'react-router'
import { DrizzleUserRepository, db } from '@pinsquirrel/database'
import { logger } from './logger.server'

const userRepository = new DrizzleUserRepository(db)

// Session storage configuration
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
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
    }
    return user
  } catch (error) {
    logger.exception(error, 'Failed to fetch user from session', { userId })
    // If user lookup fails, clear the session
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect('/login', {
      headers: {
        'Set-Cookie': await sessionStorage.destroySession(
          await getSession(request)
        ),
      },
    })
  }
}

export async function requireUser(request: Request) {
  const user = await getUser(request)
  if (!user) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect('/login')
  }
  return user
}

export async function createUserSession(
  userId: string,
  redirectTo: string = '/'
) {
  const session = await sessionStorage.getSession()
  session.set('userId', userId)

  logger.info('User session created', { userId, redirectTo })

  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session),
    },
  })
}

export async function logout(request: Request) {
  const session = await getSession(request)
  const userId = session.get('userId') as string | undefined

  if (userId) {
    logger.info('User logout', { userId })
  }

  return redirect('/login', {
    headers: {
      'Set-Cookie': await sessionStorage.destroySession(session),
    },
  })
}
