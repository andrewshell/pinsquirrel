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

const userService = {
  getUserByUsername: vi.fn(),
  listByStatus: vi.fn(),
}

const authService = {
  login: vi.fn(),
  grantAccess: vi.fn(),
  grantAdmin: vi.fn(),
}

vi.mock('./runtime.js', () => ({
  getRuntime: () => ({ userService, authService }),
}))

// The real key file is never read. Defaults (set in beforeEach) take the
// raw-key path so sign-in needs no passphrase; the unlock tests vary them.
const keyFile = {
  readKeyFile: vi.fn(),
  keyNeedsPassphrase: vi.fn(),
  unlockPrivateKey: vi.fn(),
}

vi.mock('./key.js', () => keyFile)

const mailer = { sendBulk: vi.fn() }

vi.mock('./mailer.js', () => mailer)

const crypto = { openSealedEmail: vi.fn() }

vi.mock('@pinsquirrel/crypto', () => crypto)

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

/**
 * Domain error classes, re-imported per test.
 *
 * `vi.resetModules()` gives the freshly imported app its own instance of
 * `@pinsquirrel/domain`, so classes from a static import at the top of this
 * file are different objects and every `instanceof` check in the app would
 * miss. These have to come from the same post-reset registry as the app.
 * Enums (Role, UserStatus) compare by value and are unaffected.
 */
let domain: typeof import('@pinsquirrel/domain')

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

/**
 * Answer getUserByUsername for the signed-in admin plus any named targets.
 *
 * The app re-reads its own account each request to build the AccessControl it
 * passes to listByStatus, so a blanket mockResolvedValue would hand the admin
 * lookup whatever the test meant for its target.
 */
function usersByName(targets: Record<string, User | null> = {}): void {
  userService.getUserByUsername.mockImplementation((name: string) =>
    Promise.resolve(
      name === adminUser.username ? adminUser : (targets[name] ?? null)
    )
  )
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
  domain = await import('@pinsquirrel/domain')
  app = (await import('./app.js')).app
  userService.listByStatus.mockResolvedValue([])
  usersByName()
  keyFile.readKeyFile.mockReturnValue('raw-key-contents')
  keyFile.keyNeedsPassphrase.mockReturnValue(false)
  keyFile.unlockPrivateKey.mockResolvedValue('unlocked-private-key')
  crypto.openSealedEmail.mockResolvedValue('person@example.com')
  mailer.sendBulk.mockResolvedValue([])
})

describe('POST /login', () => {
  it('signs an admin in and sends them to the unlock step', async () => {
    authService.login.mockResolvedValue(adminUser)

    const res = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'root',
        password: 'correct-horse',
      }),
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/unlock')
    expect(res.headers.get('set-cookie')).toContain('admin_session=')
  })

  it('rejects an environment that is not in the config', async () => {
    const res = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'production',
        username: 'root',
        password: 'correct-horse',
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Unknown environment')
    expect(authService.login).not.toHaveBeenCalled()
  })

  // A non-admin with valid credentials must not get a session cookie: the
  // waitlist routes rebuild the AccessControl per request, but /unlock would
  // already have read the private key onto the session.
  it('refuses a valid non-admin account without opening a session', async () => {
    authService.login.mockResolvedValue(makeUser({ roles: [Role.User] }))

    const res = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'alice',
        password: 'correct-horse',
      }),
    })

    expect(res.status).toBe(403)
    expect(await res.text()).toContain('not an admin')
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it.each([
    ['a wrong password', () => new domain.InvalidCredentialsError()],
    ['a malformed submission', () => new domain.ValidationError({})],
  ])(
    'reports %s without naming which half was wrong',
    async (_l, makeError) => {
      authService.login.mockRejectedValue(makeError())

      const res = await app.request('/login', {
        method: 'POST',
        body: new URLSearchParams({
          environment: 'test',
          username: 'root',
          password: 'nope',
        }),
      })

      expect(res.status).toBe(400)
      expect(await res.text()).toContain('Invalid username or password')
    }
  )

  it.each([
    ['without the Admin role', () => new domain.MissingRoleError()],
    ['still on the waitlist', () => new domain.AccessNotGrantedError()],
  ])('reports an account %s as unable to sign in', async (_l, makeError) => {
    authService.login.mockRejectedValue(makeError())

    const res = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'root',
        password: 'correct-horse',
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('This account cannot sign in')
  })

  it('reports an unreachable database as a connection problem', async () => {
    authService.login.mockRejectedValue(new Error('ECONNREFUSED'))

    const res = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'root',
        password: 'correct-horse',
      }),
    })

    const body = await res.text()
    expect(res.status).toBe(400)
    expect(body).toContain('Could not connect to this environment')
    expect(body).not.toContain('ECONNREFUSED')
  })

  it('hands the failed form back with the username and environment filled in', async () => {
    authService.login.mockRejectedValue(new domain.InvalidCredentialsError())

    const res = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'root',
        password: 'nope',
      }),
    })

    const body = await res.text()
    expect(body).toContain('value="root"')
    expect(body).toContain('selected')
    expect(body).not.toContain('nope')
  })
})

describe('unlock', () => {
  /** Sign in without unlocking, so the key file behaviour can be varied. */
  async function signInOnly(): Promise<string> {
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
    return setCookie.split(';')[0]
  }

  it('prompts for a passphrase when the key file is encrypted', async () => {
    keyFile.keyNeedsPassphrase.mockReturnValue(true)
    const cookie = await signInOnly()

    const res = await app.request('/unlock', { headers: { Cookie: cookie } })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Passphrase')
    expect(keyFile.unlockPrivateKey).not.toHaveBeenCalled()
  })

  it('leaves the session locked while the passphrase is outstanding', async () => {
    keyFile.keyNeedsPassphrase.mockReturnValue(true)
    const cookie = await signInOnly()
    await app.request('/unlock', { headers: { Cookie: cookie } })

    const res = await app.request('/waitlist', { headers: { Cookie: cookie } })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/unlock')
  })

  it('names the unreadable key file when it cannot be opened', async () => {
    keyFile.readKeyFile.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const cookie = await signInOnly()

    const res = await app.request('/unlock', { headers: { Cookie: cookie } })

    expect(res.status).toBe(500)
    expect(await res.text()).toContain('/nonexistent/key.json')
  })

  it('unlocks an encrypted key with the submitted passphrase', async () => {
    keyFile.keyNeedsPassphrase.mockReturnValue(true)
    const cookie = await signInOnly()

    const res = await app.request(
      '/unlock',
      form({ passphrase: 'open sesame' }, cookie)
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/waitlist')
    expect(keyFile.unlockPrivateKey).toHaveBeenCalledWith(
      'raw-key-contents',
      'open sesame'
    )
  })

  it('rejects a wrong passphrase and keeps the session locked', async () => {
    keyFile.keyNeedsPassphrase.mockReturnValue(true)
    keyFile.unlockPrivateKey.mockRejectedValue(new Error('bad mac'))
    const cookie = await signInOnly()

    const res = await app.request(
      '/unlock',
      form({ passphrase: 'wrong' }, cookie)
    )

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Incorrect passphrase')

    const waitlist = await app.request('/waitlist', {
      headers: { Cookie: cookie },
    })
    expect(waitlist.headers.get('location')).toBe('/unlock')
  })

  it('redirects an unauthenticated unlock attempt to /login', async () => {
    const res = await app.request('/unlock', {
      method: 'POST',
      body: new URLSearchParams({ passphrase: 'anything' }),
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
    expect(keyFile.unlockPrivateKey).not.toHaveBeenCalled()
  })
})

describe('GET /compose', () => {
  it('counts only the waitlisted people whose email could be opened', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([
      makeUser({ id: 'a' }),
      makeUser({ id: 'b' }),
      makeUser({ id: 'c', emailEncrypted: null }),
    ])
    crypto.openSealedEmail
      .mockResolvedValueOnce('one@example.com')
      .mockRejectedValueOnce(new Error('wrong key'))

    const res = await app.request('/compose', { headers: { Cookie: cookie } })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('to 1 waitlisted person')
  })

  it('reports a database failure instead of an empty compose form', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockRejectedValue(new Error('connection lost'))

    const res = await app.request('/compose', { headers: { Cookie: cookie } })

    expect(res.status).toBe(500)
    expect(await res.text()).toContain('reach the Test Env database')
  })

  it('redirects to /login when unauthenticated', async () => {
    const res = await app.request('/compose')

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
  })
})

describe('POST /send', () => {
  it.each([
    ['no subject', { subject: '', body: 'Hello' }],
    ['no message', { subject: 'Hi', body: '   ' }],
  ])('rejects a submission with %s before any DB work', async (_l, fields) => {
    const cookie = await signIn()

    const res = await app.request('/send', form(fields, cookie))

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Subject and message are both required')
    expect(userService.listByStatus).not.toHaveBeenCalled()
    expect(mailer.sendBulk).not.toHaveBeenCalled()
  })

  // The form carries no recipient list; they are re-read and decrypted here so
  // plaintext addresses never make the round trip through the browser.
  it('sends to the addresses read from the database', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([makeUser()])
    mailer.sendBulk.mockResolvedValue([
      { recipient: 'person@example.com', ok: true },
    ])

    const res = await app.request(
      '/send',
      form({ subject: 'Hi', body: 'Hello', to: 'attacker@example.com' }, cookie)
    )

    expect(res.status).toBe(200)
    expect(mailer.sendBulk).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'mg.example.com' }),
      ['person@example.com'],
      'Hi',
      'Hello'
    )
  })

  it('reports which recipients the provider accepted and which it did not', async () => {
    const cookie = await signIn()
    mailer.sendBulk.mockResolvedValue([
      { recipient: 'one@example.com', ok: true },
      { recipient: 'two@example.com', ok: false, error: 'mailbox full' },
    ])

    const res = await app.request(
      '/send',
      form({ subject: 'Hi', body: 'Hello' }, cookie)
    )

    const html = await res.text()
    expect(html).toContain('1 delivered')
    expect(html).toContain('1 failed')
    expect(html).toContain('mailbox full')
  })

  it('keeps the drafted message when the recipient lookup fails', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockRejectedValue(new Error('connection lost'))

    const res = await app.request(
      '/send',
      form({ subject: 'Launch day', body: 'We are open' }, cookie)
    )

    const html = await res.text()
    expect(res.status).toBe(500)
    expect(html).toContain('reach the Test Env database')
    expect(html).toContain('Launch day')
    expect(html).toContain('We are open')
    expect(mailer.sendBulk).not.toHaveBeenCalled()
  })

  it('keeps the drafted message when the provider is unreachable', async () => {
    const cookie = await signIn()
    mailer.sendBulk.mockRejectedValue(new Error('mailgun 503'))

    const res = await app.request(
      '/send',
      form({ subject: 'Launch day', body: 'We are open' }, cookie)
    )

    const html = await res.text()
    expect(res.status).toBe(500)
    expect(html).toContain('reach the email provider')
    expect(html).toContain('Launch day')
    expect(html).not.toContain('mailgun 503')
  })

  it('redirects to /login when unauthenticated', async () => {
    const res = await app.request('/send', {
      method: 'POST',
      body: new URLSearchParams({ subject: 'Hi', body: 'Hello' }),
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
    expect(mailer.sendBulk).not.toHaveBeenCalled()
  })
})

describe('POST /logout', () => {
  it('drops the session so the cookie cannot be replayed', async () => {
    const cookie = await signIn()

    const res = await app.request('/logout', form({}, cookie))

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')

    const replayed = await app.request('/waitlist', {
      headers: { Cookie: cookie },
    })
    expect(replayed.headers.get('location')).toBe('/login')
  })

  it('clears the cookie and redirects even without a session', async () => {
    const res = await app.request('/logout', { method: 'POST' })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
    expect(res.headers.get('set-cookie')).toContain('admin_session=;')
  })
})

describe('GET /waitlist', () => {
  it('lists waitlisted users with their decrypted email', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([makeUser()])

    const res = await app.request('/waitlist', { headers: { Cookie: cookie } })
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('alice')
    expect(body).toContain('person@example.com')
  })

  it('reports a database failure without throwing', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockRejectedValue(new Error('connection lost'))

    const res = await app.request('/waitlist', { headers: { Cookie: cookie } })

    expect(res.status).toBe(500)
    // The leading apostrophe of "Couldn't" is HTML-escaped in the render.
    expect(await res.text()).toContain('reach the Test Env database')
  })

  // The listing is Admin-gated in UserService, so the app has to hand it an
  // AccessControl for the signed-in account rather than an empty one.
  it('asks for the waitlist as the signed-in admin', async () => {
    const cookie = await signIn()

    await app.request('/waitlist', { headers: { Cookie: cookie } })

    const [ac, status] = userService.listByStatus.mock.calls[0] as [
      { user: User | null },
      string,
    ]
    expect(ac.user?.id).toBe(adminUser.id)
    expect(status).toBe(UserStatus.Waitlist)
  })

  // The account is re-read each request, so a mid-session demotion is caught
  // by the service. Reporting that as a database failure would be a lie.
  it('reports a lost Admin role as such, not as a database failure', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockRejectedValue(new domain.MissingRoleError())

    const res = await app.request('/waitlist', { headers: { Cookie: cookie } })

    expect(res.status).toBe(500)
    const body = await res.text()
    expect(body).toContain('no longer has admin access')
    expect(body).not.toContain('reach the Test Env database')
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

  it('returns 404 when the target was deleted before the grant', async () => {
    const cookie = await signIn()
    authService.grantAccess.mockRejectedValue(
      new domain.UserNotFoundError('ghost')
    )

    const res = await app.request(
      '/grant-access',
      form({ userId: 'ghost' }, cookie)
    )

    expect(res.status).toBe(404)
    expect(await res.text()).toContain('no longer exists')
  })

  it('refuses to activate a user who has not confirmed their email', async () => {
    const cookie = await signIn()
    authService.grantAccess.mockRejectedValue(
      new domain.UserNotEligibleError(
        UserStatus.Unverified,
        'User "alice" has not confirmed their email yet'
      )
    )

    const res = await app.request(
      '/grant-access',
      form({ userId: 'user-1' }, cookie)
    )

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('has not confirmed their email yet')
  })

  it('reports an unexpected failure as a 500', async () => {
    const cookie = await signIn()
    authService.grantAccess.mockRejectedValue(new Error('connection reset'))

    const res = await app.request(
      '/grant-access',
      form({ userId: 'user-1' }, cookie)
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
    usersByName({ bob: target })
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
    usersByName({
      bob: makeUser({ username: 'bob', roles: [Role.User, Role.Admin] }),
    })

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
    usersByName({})

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
    expect(authService.grantAdmin).not.toHaveBeenCalled()
    expect(authService.grantAdmin).not.toHaveBeenCalled()
  })

  it('returns 404 when the target is deleted between lookup and grant', async () => {
    const cookie = await signIn()
    usersByName({ bob: makeUser({ username: 'bob', roles: [Role.User] }) })
    authService.grantAdmin.mockRejectedValue(
      new domain.UserNotFoundError('user-1')
    )

    const res = await app.request(
      '/grant-admin',
      form({ username: 'bob' }, cookie)
    )

    expect(res.status).toBe(404)
    expect(await res.text()).toContain('no longer exists')
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
