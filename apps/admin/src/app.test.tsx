/**
 * Route tests for the admin app.
 *
 * `createApp(config)` takes its config as an argument, so each test builds an
 * app around the fixture it needs — including which key file the environment
 * points at. The database and the mail provider are mocked; sessions, signed
 * cookies, the unlock gate and the private-key handling all run for real,
 * because those gates are exactly what these routes depend on.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  generateKeyPair,
  serializeRawPrivateKey,
  wrapPrivateKey,
} from '@pinsquirrel/crypto'
import {
  Role,
  UserStatus,
  InvalidCredentialsError,
  AccessNotGrantedError,
  MissingRoleError,
  ValidationError,
  UserNotFoundError,
  UserNotEligibleError,
  CannotRevokeOwnRoleError,
  AccessControl,
} from '@pinsquirrel/domain'
import type { Hono } from 'hono'
import type { User } from '@pinsquirrel/domain'
import type { AdminConfig, AdminEnvironment } from './config.js'
import { createApp } from './app.js'
import { loginLimiter } from './rate-limit.js'

const userService = {
  getUserByUsername: vi.fn(),
  listByStatus: vi.fn(),
}

const authService = {
  login: vi.fn(),
  grantAccess: vi.fn(),
  grantRole: vi.fn(),
  revokeRole: vi.fn(),
}

vi.mock('./runtime.js', () => ({
  getRuntime: () => ({ userService, authService }),
}))

// The shared Mailgun service is stubbed at the class, so these tests still
// observe the send without a network call. `configuredWith` records the config
// the app built the client from, which used to be sendBulk's first argument.
const mailer = { sendBulk: vi.fn(), configuredWith: vi.fn() }

vi.mock('@pinsquirrel/mailgun', () => ({
  MailgunEmailService: class {
    constructor(config: unknown) {
      mailer.configuredWith(config)
    }
    sendBulk(...args: unknown[]) {
      return mailer.sendBulk(...args) as unknown
    }
  },
}))

// Only the sealed-email half is mocked: the waitlist rows are fixtures, but
// the key handling under /unlock is what several tests are about.
const crypto = { openSealedEmail: vi.fn() }

vi.mock('@pinsquirrel/crypto', async importActual => ({
  ...(await importActual<typeof import('@pinsquirrel/crypto')>()),
  openSealedEmail: (...args: unknown[]) =>
    crypto.openSealedEmail(...args) as unknown,
}))

const tempDir = mkdtempSync(join(tmpdir(), 'admin-test-'))
const rawKeyPath = join(tempDir, 'raw-key.json')
const encryptedKeyPath = join(tempDir, 'encrypted-key.json')
const PASSPHRASE = 'open sesame'

/** The private key the two fixture files hold, for asserting on decrypts. */
let privateKey: string

beforeAll(async () => {
  const pair = await generateKeyPair()
  privateKey = pair.privateKey
  writeFileSync(rawKeyPath, serializeRawPrivateKey(privateKey))
  writeFileSync(encryptedKeyPath, await wrapPrivateKey(privateKey, PASSPHRASE))
})

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

const mailgun = {
  apiKey: 'key-test',
  domain: 'mg.example.com',
  fromEmail: 'noreply@example.com',
}

/**
 * A two-environment config: one keyed, one not.
 *
 * The overrides apply to the keyed environment — it is the one whose key file
 * the unlock tests vary. "keyless" models a server running without
 * EMAIL_PUBLIC_KEY: nothing is sealed, so the console has no key to hold.
 */
function makeConfig(env: Partial<AdminEnvironment> = {}): AdminConfig {
  return {
    sessionSecret: 'test-secret-that-is-long-enough-to-sign-with',
    environments: [
      {
        name: 'test',
        label: 'Test Env',
        databaseUrl: 'mysql://user:pass@localhost:3306/test',
        privateKeyPath: rawKeyPath,
        mailgun,
        ...env,
      },
      {
        name: 'keyless',
        label: 'Keyless Env',
        databaseUrl: 'mysql://user:pass@localhost:3306/keyless',
        mailgun,
      },
    ],
  }
}

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

/**
 * Sign in to the keyless environment.
 *
 * No unlock step: there is no key file, so the session is complete as soon as
 * the cookie is set — which is the behaviour most of these tests are about.
 */
async function signInKeyless(): Promise<string> {
  authService.login.mockResolvedValue(adminUser)

  const res = await app.request('/login', {
    method: 'POST',
    body: new URLSearchParams({
      environment: 'keyless',
      username: 'root',
      password: 'correct-horse',
    }),
  })

  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error('sign-in did not set a session cookie')
  return setCookie.split(';')[0]
}

/**
 * Answer getUserByUsername for the signed-in admin, and nobody else.
 *
 * The app re-reads its own account each request to build the AccessControl it
 * passes to the services; every other lookup goes through listByStatus.
 */
function mockAdminLookup(): void {
  userService.getUserByUsername.mockImplementation((name: string) =>
    Promise.resolve(name === adminUser.username ? adminUser : null)
  )
}

function form(fields: Record<string, string>, cookie: string): RequestInit {
  return {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: { Cookie: cookie },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  loginLimiter.reset('unknown:root')
  loginLimiter.reset('unknown:alice')
  app = createApp(makeConfig())
  userService.listByStatus.mockResolvedValue([])
  mockAdminLookup()
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

  // The credentials this form takes are a production admin's. Without a
  // counter, an attacker with the URL can guess at them as fast as the process
  // will answer.
  it('locks out after five failed attempts on the same username', async () => {
    authService.login.mockRejectedValue(new InvalidCredentialsError())

    for (let i = 0; i < 5; i++) {
      const res = await app.request('/login', {
        method: 'POST',
        body: new URLSearchParams({
          environment: 'test',
          username: 'root',
          password: `guess-${i}`,
        }),
      })
      expect(res.status).toBe(400)
    }

    authService.login.mockClear()
    const res = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'root',
        password: 'guess-5',
      }),
    })

    expect(res.status).toBe(429)
    expect(await res.text()).toMatch(/too many/i)
    // The database is never asked, so the lockout costs the attacker a round
    // trip and costs the target nothing.
    expect(authService.login).not.toHaveBeenCalled()
  })

  // Otherwise one operator fat-fingering their password would lock the console
  // for the rest of the window even after they get it right.
  it('clears the counter once the sign-in succeeds', async () => {
    authService.login.mockRejectedValue(new InvalidCredentialsError())
    for (let i = 0; i < 4; i++) {
      await app.request('/login', {
        method: 'POST',
        body: new URLSearchParams({
          environment: 'test',
          username: 'root',
          password: `guess-${i}`,
        }),
      })
    }

    authService.login.mockResolvedValue(adminUser)
    const ok = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'root',
        password: 'correct-horse',
      }),
    })
    expect(ok.status).toBe(302)

    authService.login.mockRejectedValue(new InvalidCredentialsError())
    const after = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'root',
        password: 'guess-again',
      }),
    })
    expect(after.status).toBe(400)
  })

  it('marks the session cookie Secure in production', async () => {
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      authService.login.mockResolvedValue(adminUser)

      const res = await app.request('/login', {
        method: 'POST',
        body: new URLSearchParams({
          environment: 'test',
          username: 'root',
          password: 'correct-horse',
        }),
      })

      expect(res.headers.get('set-cookie')).toContain('Secure')
    } finally {
      process.env.NODE_ENV = previous
    }
  })

  it('does not mark the cookie Secure outside production', async () => {
    authService.login.mockResolvedValue(adminUser)

    const res = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'root',
        password: 'correct-horse',
      }),
    })

    expect(res.headers.get('set-cookie')).not.toContain('Secure')
  })

  // The catch-all renders "Could not connect to this environment", which is a
  // guess. Whatever actually happened has to reach the operator's console or
  // it is gone.
  it('logs an unexpected failure instead of swallowing it', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = new Error('connection reset')
    authService.login.mockRejectedValue(boom)

    const res = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'root',
        password: 'correct-horse',
      }),
    })

    expect(res.status).toBe(400)
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('login'), boom)
    logged.mockRestore()
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
    ['a wrong password', () => new InvalidCredentialsError()],
    ['a malformed submission', () => new ValidationError({})],
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
    ['without the Admin role', () => new MissingRoleError()],
    ['still on the waitlist', () => new AccessNotGrantedError()],
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
    authService.login.mockRejectedValue(new InvalidCredentialsError())

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

  /** The key the session holds, as seen by the sealed-email call. */
  function keyUsedForDecrypt(): unknown {
    return crypto.openSealedEmail.mock.calls[0][1]
  }

  it('unlocks a raw key file without prompting', async () => {
    const cookie = await signInOnly()
    userService.listByStatus.mockResolvedValue([makeUser()])

    const res = await app.request('/unlock', { headers: { Cookie: cookie } })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/waitlist')

    await app.request('/waitlist', { headers: { Cookie: cookie } })
    expect(keyUsedForDecrypt()).toBe(privateKey)
  })

  it('prompts for a passphrase when the key file is encrypted', async () => {
    app = createApp(makeConfig({ privateKeyPath: encryptedKeyPath }))
    const cookie = await signInOnly()

    const res = await app.request('/unlock', { headers: { Cookie: cookie } })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Passphrase')
  })

  it('leaves the session locked while the passphrase is outstanding', async () => {
    app = createApp(makeConfig({ privateKeyPath: encryptedKeyPath }))
    const cookie = await signInOnly()
    await app.request('/unlock', { headers: { Cookie: cookie } })

    const res = await app.request('/waitlist', { headers: { Cookie: cookie } })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/unlock')
  })

  it('names the unreadable key file when it cannot be opened', async () => {
    app = createApp(makeConfig({ privateKeyPath: '/nonexistent/key.json' }))
    const cookie = await signInOnly()

    const res = await app.request('/unlock', { headers: { Cookie: cookie } })

    expect(res.status).toBe(500)
    expect(await res.text()).toContain('/nonexistent/key.json')
  })

  it('unlocks an encrypted key with the submitted passphrase', async () => {
    app = createApp(makeConfig({ privateKeyPath: encryptedKeyPath }))
    const cookie = await signInOnly()
    userService.listByStatus.mockResolvedValue([makeUser()])

    const res = await app.request(
      '/unlock',
      form({ passphrase: PASSPHRASE }, cookie)
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/waitlist')

    await app.request('/waitlist', { headers: { Cookie: cookie } })
    expect(keyUsedForDecrypt()).toBe(privateKey)
  })

  it('rejects a wrong passphrase and keeps the session locked', async () => {
    app = createApp(makeConfig({ privateKeyPath: encryptedKeyPath }))
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
      body: new URLSearchParams({ passphrase: PASSPHRASE }),
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
  })
})

/**
 * An environment whose server runs without EMAIL_PUBLIC_KEY.
 *
 * Nothing is sealed there, so the console has no key to unlock — and a gate
 * with nothing behind it would lock the operator out of an environment they
 * are otherwise entitled to administer.
 */
describe('keyless environment', () => {
  it('lands a sign-in on the waitlist rather than the unlock step', async () => {
    authService.login.mockResolvedValue(adminUser)

    const res = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'keyless',
        username: 'root',
        password: 'correct-horse',
      }),
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/waitlist')
  })

  it('sends the root path to the waitlist', async () => {
    const cookie = await signInKeyless()

    const res = await app.request('/', { headers: { Cookie: cookie } })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/waitlist')
  })

  it.each([
    ['GET', () => ({ headers: { Cookie: '' } })],
    ['POST', () => ({ method: 'POST' })],
  ])('turns a %s /unlock away, having nothing to unlock', async (_l, init) => {
    const cookie = await signInKeyless()

    const res = await app.request('/unlock', {
      ...init(),
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/waitlist')
  })

  it('serves the waitlist without an unlocked key', async () => {
    const cookie = await signInKeyless()
    userService.listByStatus.mockResolvedValue([makeUser()])

    const res = await app.request('/waitlist', { headers: { Cookie: cookie } })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('alice')
  })

  // A row sealed by a server that had a key, listed by a console that has
  // none. Saying "(no sealed email)" would claim the address was never
  // collected; the address is there, and this console cannot open it.
  it('marks a sealed email locked and an absent one absent', async () => {
    const cookie = await signInKeyless()
    userService.listByStatus.mockResolvedValue([
      makeUser({ id: 'a', username: 'alice' }),
      makeUser({ id: 'b', username: 'bob', emailEncrypted: null }),
    ])

    const res = await app.request('/waitlist', { headers: { Cookie: cookie } })
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('(locked)')
    expect(body).toContain('(no sealed email)')
    expect(body).not.toContain('(decrypt failed)')
    expect(crypto.openSealedEmail).not.toHaveBeenCalled()
  })

  it('serves the users page without an unlocked key', async () => {
    const cookie = await signInKeyless()

    const res = await app.request('/users', { headers: { Cookie: cookie } })

    expect(res.status).toBe(200)
  })

  it('grants access without an unlocked key', async () => {
    const cookie = await signInKeyless()
    authService.grantAccess.mockResolvedValue(
      makeUser({ status: UserStatus.Active })
    )

    const res = await app.request(
      '/grant-access',
      form({ userId: 'user-1' }, cookie)
    )

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Granted access to alice')
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
    expect(mailer.configuredWith).toHaveBeenCalledWith(
      expect.objectContaining({ domain: 'mg.example.com' })
    )
    expect(mailer.sendBulk).toHaveBeenCalledWith(
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
    userService.listByStatus.mockRejectedValue(new MissingRoleError())

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

  // Role changes belong with the accounts they apply to, which is the Users
  // page — a box here could only be filled in from memory.
  it('carries no role form', async () => {
    const cookie = await signIn()

    const res = await app.request('/waitlist', { headers: { Cookie: cookie } })
    const body = await res.text()

    expect(body).not.toContain('/roles/grant')
    expect(body).not.toContain('/roles/revoke')
  })
})

describe('GET /', () => {
  // Two sections now sit behind the session, so where the root lands is a
  // decision rather than the only option: the waitlist is the queue that
  // needs working, the users list is a reference. Post-unlock lands there
  // too, so there is one answer to "where does signing in put me".
  it('lands an unlocked session on the waitlist', async () => {
    const cookie = await signIn()

    const res = await app.request('/', { headers: { Cookie: cookie } })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/waitlist')
  })

  it('sends a locked session to /unlock and a stranger to /login', async () => {
    app = createApp(makeConfig({ privateKeyPath: encryptedKeyPath }))
    authService.login.mockResolvedValue(adminUser)
    const login = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'root',
        password: 'correct-horse',
      }),
    })
    const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''

    const locked = await app.request('/', { headers: { Cookie: cookie } })
    expect(locked.headers.get('location')).toBe('/unlock')

    const stranger = await app.request('/')
    expect(stranger.headers.get('location')).toBe('/login')
  })
})

describe('GET /users', () => {
  const activeUser = makeUser({
    id: 'user-2',
    username: 'bob',
    roles: [Role.User],
    status: UserStatus.Active,
  })

  it('lists active users with a column per role', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([activeUser, adminUser])

    const res = await app.request('/users', { headers: { Cookie: cookie } })
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('bob')
    for (const role of Object.values(Role)) {
      expect(body).toContain(`>${role}</th>`)
    }
    // bob lacks Admin, so his row offers it; he holds User, so that one is
    // offered back the other way.
    expect(body).toContain('action="/roles/grant"')
    expect(body).toContain('action="/roles/revoke"')
  })

  // The signed-in admin's own row is the one the service will refuse, so the
  // page marks it and drops the buttons that would earn the refusal.
  it('offers the signed-in admin no revoke on their own row', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([adminUser])

    const res = await app.request('/users', { headers: { Cookie: cookie } })
    const row = (await res.text()).split('<tbody>')[1]

    expect(row).toContain('(you)')
    expect(row).not.toContain('action="/roles/revoke"')
  })

  // Listing is Admin-gated inside UserService, so the app hands it the
  // signed-in account's AccessControl rather than deciding the rule here.
  it('asks for the active users as the signed-in admin', async () => {
    const cookie = await signIn()

    await app.request('/users', { headers: { Cookie: cookie } })

    expect(userService.listByStatus).toHaveBeenCalledWith(
      new AccessControl(adminUser),
      UserStatus.Active
    )
  })

  it('reports a database failure without throwing', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockRejectedValue(new Error('connection lost'))

    const res = await app.request('/users', { headers: { Cookie: cookie } })

    expect(res.status).toBe(500)
    expect(await res.text()).toContain('reach the Test Env database')
  })

  it('redirects to /login when unauthenticated', async () => {
    const res = await app.request('/users')

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
    expect(userService.listByStatus).not.toHaveBeenCalled()
  })

  // The page itself needs no private key, but the console is one session:
  // signing in without unlocking lands on /unlock wherever you point it.
  it('redirects to /unlock while the session is locked', async () => {
    app = createApp(makeConfig({ privateKeyPath: encryptedKeyPath }))
    authService.login.mockResolvedValue(adminUser)
    const login = await app.request('/login', {
      method: 'POST',
      body: new URLSearchParams({
        environment: 'test',
        username: 'root',
        password: 'correct-horse',
      }),
    })
    const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? ''

    const res = await app.request('/users', { headers: { Cookie: cookie } })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/unlock')
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
    // The grant carries the signed-in admin's own AccessControl, so the
    // service decides the rule rather than trusting this app's session gate.
    expect(authService.grantAccess).toHaveBeenCalledWith(
      new AccessControl(adminUser),
      'user-1'
    )
    expect(await res.text()).toContain('Granted access to alice')
  })

  it('returns 404 when the target was deleted before the grant', async () => {
    const cookie = await signIn()
    authService.grantAccess.mockRejectedValue(new UserNotFoundError('ghost'))

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
      new UserNotEligibleError(
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

describe('POST /roles/grant', () => {
  /** An active account without the Admin role — a row on the Users page. */
  const target = makeUser({
    id: 'user-2',
    username: 'bob',
    roles: [Role.User],
    status: UserStatus.Active,
  })

  it('grants the named role to the selected user', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([target])
    authService.grantRole.mockResolvedValue({
      ...target,
      roles: [Role.User, Role.Admin],
    })

    const res = await app.request(
      '/roles/grant',
      form({ userId: target.id, role: Role.Admin }, cookie)
    )

    expect(res.status).toBe(200)
    // The grant carries the signed-in admin's own AccessControl, so the
    // service decides the rule rather than trusting this app's session gate.
    expect(authService.grantRole).toHaveBeenCalledWith(
      new AccessControl(adminUser),
      target.id,
      Role.Admin
    )
    expect(await res.text()).toContain('Granted the Admin role to bob')
  })

  // The button is not rendered for a row that already has the role, so this
  // only happens from a stale page — but grantRole is idempotent and cannot
  // tell the two outcomes apart afterwards, so the row is read first.
  it('reports no change for a user who already holds the role', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([adminUser])

    const res = await app.request(
      '/roles/grant',
      form({ userId: adminUser.id, role: Role.Admin }, cookie)
    )

    expect(res.status).toBe(200)
    expect(authService.grantRole).not.toHaveBeenCalled()
    expect(await res.text()).toContain('root already has the Admin role')
  })

  it('rejects a submission with no user without touching the database', async () => {
    const cookie = await signIn()

    const res = await app.request(
      '/roles/grant',
      form({ userId: '', role: Role.Admin }, cookie)
    )

    expect(res.status).toBe(400)
    expect(authService.grantRole).not.toHaveBeenCalled()
  })

  // The role arrives as a form field, so it is whatever the client sent. Only
  // a value the enum actually names reaches the service.
  it('rejects a role the enum does not name', async () => {
    const cookie = await signIn()

    const res = await app.request(
      '/roles/grant',
      form({ userId: target.id, role: 'Superuser' }, cookie)
    )

    expect(res.status).toBe(400)
    expect(authService.grantRole).not.toHaveBeenCalled()
    expect(await res.text()).toContain('not a role')
  })

  it('returns 404 when the target was deleted before the grant', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([target])
    authService.grantRole.mockRejectedValue(new UserNotFoundError(target.id))

    const res = await app.request(
      '/roles/grant',
      form({ userId: target.id, role: Role.Admin }, cookie)
    )

    expect(res.status).toBe(404)
    expect(await res.text()).toContain('no longer exists')
  })

  it('reports an unexpected failure as a 500', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([target])
    authService.grantRole.mockRejectedValue(new Error('connection reset'))

    const res = await app.request(
      '/roles/grant',
      form({ userId: target.id, role: Role.Admin }, cookie)
    )

    expect(res.status).toBe(500)
    expect(await res.text()).toContain('reach the Test Env database')
  })

  it('redirects to /login when unauthenticated', async () => {
    const res = await app.request('/roles/grant', {
      method: 'POST',
      body: new URLSearchParams({ userId: 'user-2', role: Role.Admin }),
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
    expect(authService.grantRole).not.toHaveBeenCalled()
  })
})

describe('POST /roles/revoke', () => {
  /** An active account holding both roles — every revoke has something to do. */
  const target = makeUser({
    id: 'user-2',
    username: 'bob',
    roles: [Role.User, Role.Admin],
    status: UserStatus.Active,
  })

  it('revokes the named role from the selected user', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([target])
    authService.revokeRole.mockResolvedValue({ ...target, roles: [Role.User] })

    const res = await app.request(
      '/roles/revoke',
      form({ userId: target.id, role: Role.Admin }, cookie)
    )

    expect(res.status).toBe(200)
    expect(authService.revokeRole).toHaveBeenCalledWith(
      new AccessControl(adminUser),
      target.id,
      Role.Admin
    )
    expect(await res.text()).toContain('Revoked the Admin role from bob')
  })

  // Losing the User role is a suspension: login() requires it. The notice says
  // so, because nothing else on the page would.
  it('says that revoking the User role suspends sign-in', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([target])
    authService.revokeRole.mockResolvedValue({ ...target, roles: [Role.Admin] })

    const res = await app.request(
      '/roles/revoke',
      form({ userId: target.id, role: Role.User }, cookie)
    )

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('can no longer sign in')
  })

  it('reports no change for a user who does not hold the role', async () => {
    const cookie = await signIn()
    const plain = makeUser({
      id: 'user-3',
      username: 'carol',
      roles: [Role.User],
      status: UserStatus.Active,
    })
    userService.listByStatus.mockResolvedValue([plain])

    const res = await app.request(
      '/roles/revoke',
      form({ userId: plain.id, role: Role.Admin }, cookie)
    )

    expect(res.status).toBe(200)
    expect(authService.revokeRole).not.toHaveBeenCalled()
    expect(await res.text()).toContain('carol does not have the Admin role')
  })

  // The page hides the button, but the post is still reachable — and the
  // service, not this app, is what actually refuses it.
  it('reports the service refusing a self-revoke', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([adminUser])
    authService.revokeRole.mockRejectedValue(
      new CannotRevokeOwnRoleError(Role.Admin)
    )

    const res = await app.request(
      '/roles/revoke',
      form({ userId: adminUser.id, role: Role.Admin }, cookie)
    )

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('your own account')
  })

  it('rejects a role the enum does not name', async () => {
    const cookie = await signIn()

    const res = await app.request(
      '/roles/revoke',
      form({ userId: target.id, role: 'Superuser' }, cookie)
    )

    expect(res.status).toBe(400)
    expect(authService.revokeRole).not.toHaveBeenCalled()
  })

  it('returns 404 when the target was deleted before the revoke', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([target])
    authService.revokeRole.mockRejectedValue(new UserNotFoundError(target.id))

    const res = await app.request(
      '/roles/revoke',
      form({ userId: target.id, role: Role.Admin }, cookie)
    )

    expect(res.status).toBe(404)
    expect(await res.text()).toContain('no longer exists')
  })

  it('reports an unexpected failure as a 500', async () => {
    const cookie = await signIn()
    userService.listByStatus.mockResolvedValue([target])
    authService.revokeRole.mockRejectedValue(new Error('connection reset'))

    const res = await app.request(
      '/roles/revoke',
      form({ userId: target.id, role: Role.Admin }, cookie)
    )

    expect(res.status).toBe(500)
    expect(await res.text()).toContain('reach the Test Env database')
  })

  it('redirects to /login when unauthenticated', async () => {
    const res = await app.request('/roles/revoke', {
      method: 'POST',
      body: new URLSearchParams({ userId: 'user-2', role: Role.Admin }),
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login')
    expect(authService.revokeRole).not.toHaveBeenCalled()
  })
})

describe('/static', () => {
  // The pages link a stylesheet and a theme script; without this mount they
  // 404 and the console renders unstyled. Asserted on theme.js rather than
  // styles.css because the stylesheet is a build artefact and may not exist
  // yet, while the script is checked in.
  it('serves the static directory', async () => {
    const res = await app.request('/static/theme.js')

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('prefers-color-scheme: dark')
  })

  // The header renders a logo and an account menu; both are static files the
  // pages reference by URL, so a missing one is a broken page rather than a
  // failing test elsewhere.
  it('serves the dropdown script and the logo', async () => {
    const script = await app.request('/static/dropdown.js')
    expect(script.status).toBe(200)
    expect(await script.text()).toContain('data-dropdown')

    const logo = await app.request('/static/pinsquirrel.svg')
    expect(logo.status).toBe(200)
  })

  // Mounted before every session check, so a login page still gets its CSS
  // when the database is down.
  it('does not require a session', async () => {
    const res = await app.request('/static/theme.js')

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })
})
