import { createCookieSessionStorage, redirect } from 'react-router'
import { repositories } from './services/container.server'
import { logger } from './logger.server'

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
    const user = await repositories.user.findById(userId)
    if (!user) {
      logger.warn('User not found for valid session', { userId })
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

export async function requireUser(request: Request) {
  const user = await getUser(request)
  if (!user) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect('/signin')
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

  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await sessionStorage.commitSession(session),
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
  return sessionStorage.commitSession(session)
}
