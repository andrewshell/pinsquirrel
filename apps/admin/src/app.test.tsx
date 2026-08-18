/**
 * Route tests for the admin app.
 *
 * The app reads its config at module scope (`loadConfig()` in app.tsx), so
 * every test writes a fixture config to a temp file, points ADMIN_CONFIG at
 * it, and imports the app fresh. The database and the key file are mocked;
 * everything else — sessions, signed cookies, the unlock gate — runs for real,
 * because those gates are exactly what these routes depend on.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Role, UserStatus } from '@pinsquirrel/domain'
import type { Hono } from 'hono'
import type { User } from '@pinsquirrel/domain'

const userRepository = {
  findByStatus: vi.fn(),
  findByUsername: vi.fn(),
}

const authService = {
  login: vi.fn(),
  grantAccess: vi.fn(),
  grantAdmin: vi.fn(),
}

vi.mock('./runtime.js', () => ({
  getRuntime: () => ({ userRepository, authService }),
}))

// The key file is never read in tests; the unlock flow takes the raw-key path.
vi.mock('./key.js', () => ({
  readKeyFile: () => 'raw-key-contents',
  keyNeedsPassphrase: () => false,
  unlockPrivateKey: () => Promise.resolve('unlocked-private-key'),
}))

vi.mock('@pinsquirrel/crypto', () => ({
  openSealedEmail: () => Promise.resolve('person@example.com'),
}))

const tempDir = mkdtempSync(join(tmpdir(), 'admin-test-'))
const configPath = join(tempDir, 'admin.config.json')

writeFileSync(
  configPath,
  JSON.stringify({
    sessionSecret: 'test-secret-that-is-long-enough-to-sign-with',
    environments: [
      {
        name: 'test',
        label: 'Test Env',
        databaseUrl: 'mysql://user:pass@localhost:3306/test',
        privateKeyPath: '/nonexistent/key.json',
        mailgun: {
          apiKey: 'key-test',
          domain: 'mg.example.com',
          fromEmail: 'noreply@example.com',
        },
      },
    ],
  })
)

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'alice',
    passwordHash: 'hash',
    emailHash: 'emailhash',
    emailEncrypted: 'sealed',
    roles: [Role.User],
    status: UserStatus.Waitlist,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

const adminUser = makeUser({
  id: 'admin-1',
  username: 'root',
  roles: [Role.User, Role.Admin],
  status: UserStatus.Active,
})

let app: Hono

/** Sign in and unlock, returning the session cookie for later requests. */
async function signIn(): Promise<string> {
  authService.login.mockResolvedValue(adminUser)

  const res = await app.request('/login', {
    method: 'POST',
    body: new URLSearchParams({
      environment: 'test',
      username: 'root',
      password: 'correct-horse',
    }),
  })

  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error('sign-in did not set a session cookie')
  const cookie = setCookie.split(';')[0]

  // Raw-key path: GET /unlock stores the key on the session and redirects.
  await app.request('/unlock', { headers: { Cookie: cookie } })

  return cookie
}

function form(fields: Record<string, string>, cookie: string): RequestInit {
  return {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: { Cookie: cookie },
  }
}

beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  process.env.ADMIN_CONFIG = configPath
  app = (await import('./app.js')).app
  userRepository.findByStatus.mockResolvedValue([])
})

describe('GET /waitlist', () => {
  it('lists waitlisted users with their decrypted email', async () => {
    const cookie = await signIn()
    userRepository.findByStatus.mockResolvedValue([makeUser()])

    const res = await app.request('/waitlist', { headers: { Cookie: cookie } })
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('alice')
    expect(body).toContain('person@example.com')
  })

  it('reports a database failure without throwing', async () => {
    const cookie = await signIn()
    userRepository.findByStatus.mockRejectedValue(new Error('connection lost'))

    const res = await app.request('/waitlist', { headers: { Cookie: cookie } })

    expect(res.status).toBe(500)
    // The leading apostrophe of "Couldn't" is HTML-escaped in the render.
    expect(await res.text()).toContain('reach the Test Env database')
  })

  it('redirects to /login when unauthenticated', async () => {
    const res = await app.request('/waitlist')

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
  })
})

describe('POST /grant-access', () => {
  it('grants access to the named user and reports it', async () => {
    const cookie = await signIn()
    const waitlisted = makeUser()
    authService.grantAccess.mockResolvedValue({
      ...waitlisted,
      status: UserStatus.Active,
    })

    const res = await app.request(
      '/grant-access',
      form({ userId: 'user-1' }, cookie)
    )

    expect(res.status).toBe(200)
    expect(authService.grantAccess).toHaveBeenCalledWith('user-1')
    expect(await res.text()).toContain('Granted access to alice')
  })

  it('reports a user that no longer exists rather than throwing', async () => {
    const cookie = await signIn()
    authService.grantAccess.mockRejectedValue(new Error('User not found'))

    const res = await app.request(
      '/grant-access',
      form({ userId: 'ghost' }, cookie)
    )

    expect(res.status).toBe(500)
    expect(await res.text()).toContain('Could not grant access')
  })

  it('redirects to /login when unauthenticated', async () => {
    const res = await app.request('/grant-access', {
      method: 'POST',
      body: new URLSearchParams({ userId: 'user-1' }),
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
    expect(authService.grantAccess).not.toHaveBeenCalled()
  })
})

describe('POST /grant-admin', () => {
  it('grants the Admin role by username', async () => {
    const cookie = await signIn()
    const target = makeUser({ username: 'bob', roles: [Role.User] })
    userRepository.findByUsername.mockResolvedValue(target)
    authService.grantAdmin.mockResolvedValue({
      ...target,
      roles: [Role.User, Role.Admin],
    })

    const res = await app.request(
      '/grant-admin',
      form({ username: 'bob' }, cookie)
    )

    expect(res.status).toBe(200)
    expect(authService.grantAdmin).toHaveBeenCalledWith('user-1')
    expect(await res.text()).toContain('Granted the Admin role to bob')
  })

  it('reports no change for an existing admin without writing', async () => {
    const cookie = await signIn()
    userRepository.findByUsername.mockResolvedValue(
      makeUser({ username: 'bob', roles: [Role.User, Role.Admin] })
    )

    const res = await app.request(
      '/grant-admin',
      form({ username: 'bob' }, cookie)
    )

    expect(res.status).toBe(200)
    expect(authService.grantAdmin).not.toHaveBeenCalled()
    expect(await res.text()).toContain('bob is already an admin')
  })

  it('reports an unknown username', async () => {
    const cookie = await signIn()
    userRepository.findByUsername.mockResolvedValue(null)

    const res = await app.request(
      '/grant-admin',
      form({ username: 'nobody' }, cookie)
    )

    expect(res.status).toBe(404)
    expect(authService.grantAdmin).not.toHaveBeenCalled()
    expect(await res.text()).toContain('No user named nobody')
  })

  it('rejects a blank username without touching the database', async () => {
    const cookie = await signIn()

    const res = await app.request(
      '/grant-admin',
      form({ username: '' }, cookie)
    )

    expect(res.status).toBe(400)
    expect(userRepository.findByUsername).not.toHaveBeenCalled()
    expect(authService.grantAdmin).not.toHaveBeenCalled()
  })

  it('redirects to /login when unauthenticated', async () => {
    const res = await app.request('/grant-admin', {
      method: 'POST',
      body: new URLSearchParams({ username: 'bob' }),
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
    expect(authService.grantAdmin).not.toHaveBeenCalled()
  })
})
