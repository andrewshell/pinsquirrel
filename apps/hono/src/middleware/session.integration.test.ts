import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { db, sessionRepository, userRepository } from '../lib/db'
import { getSessionManager, sessionMiddleware } from './session'

let userId: string

beforeAll(async () => {
  const user = await userRepository.create({
    username: `sess${randomBytes(6).toString('hex')}`,
    passwordHash: null,
    emailHash: null,
  })
  userId = user.id
})

afterAll(async () => {
  // Sessions cascade from users.id.
  if (userId) await userRepository.delete(userId)
  await (db as unknown as { $client: { end(): Promise<void> } }).$client.end()
})

const originalNodeEnv = process.env.NODE_ENV
afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
})

function buildApp(): Hono {
  const app = new Hono()
  app.use('*', sessionMiddleware())
  app.post('/signin', async c => {
    await getSessionManager(c).create(userId, true)
    return c.text('ok')
  })
  app.get('/whoami', c => c.json({ userId: getSessionManager(c).getUserId() }))
  return app
}

/** Every Set-Cookie on a response, as name -> raw header. */
function setCookies(res: Response): Map<string, string> {
  return new Map(
    res.headers.getSetCookie().map(header => [header.split('=')[0], header])
  )
}

function cookieValue(header: string): string {
  return decodeURIComponent(header.split(';')[0].split('=').slice(1).join('='))
}

describe('session storage', () => {
  it('does not store the cookie value as the session row id', async () => {
    const app = buildApp()
    const res = await app.request('/signin', { method: 'POST' })
    const [[name, header]] = [...setCookies(res)]
    const value = cookieValue(header)

    const who = await app.request('/whoami', {
      headers: { Cookie: `${name}=${encodeURIComponent(value)}` },
    })
    expect(await who.json()).toEqual({ userId })

    const rows = await sessionRepository.findByUserId(userId)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.map(r => r.id)).not.toContain(value)
  })

  it('names the cookie __Host-session in production', async () => {
    process.env.NODE_ENV = 'production'
    const app = buildApp()
    const res = await app.request('https://pinsquirrel.test/signin', {
      method: 'POST',
    })

    const header = setCookies(res).get('__Host-session')
    expect(header).toBeDefined()
    expect(header).toContain('Secure')
    expect(header).toContain('Path=/')
    expect(header).not.toContain('Domain')
  })

  it('accepts a session from before ids were hashed and reissues it under __Host-session', async () => {
    process.env.NODE_ENV = 'production'
    // What the migration leaves for a session made before it: the old cookie
    // value was the row id, and the row id is now its SHA-256.
    const legacyValue = randomUUID()
    await sessionRepository.create({
      id: createHash('sha256').update(legacyValue).digest('hex'),
      userId,
      data: { userId, keepSignedIn: true },
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    const app = buildApp()

    const res = await app.request('https://pinsquirrel.test/whoami', {
      headers: { Cookie: `__session=${legacyValue}` },
    })

    expect(await res.json()).toEqual({ userId })
    const cookies = setCookies(res)
    expect(cookieValue(cookies.get('__Host-session')!)).toBe(legacyValue)
    expect(cookies.get('__session')).toMatch(/Max-Age=0/)
  })
})
