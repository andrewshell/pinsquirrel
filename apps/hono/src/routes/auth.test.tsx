/**
 * Characterization tests for the authentication routes.
 *
 * `auth.tsx` was the largest untested file in the app and the one carrying the
 * most security-relevant behavior: the open-redirect guard on sign-in, the
 * rate-limit interplay, the deliberate account-enumeration silence on sign-up
 * and forgot-password, and the status codes that distinguish "wrong password"
 * from "not allowed in yet".
 *
 * These assert what the code does today. Several of the behaviors below look
 * odd in isolation and are correct on purpose — those are called out inline so
 * nobody "fixes" them later.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import {
  ValidationError,
  InvalidCredentialsError,
  EmailVerificationRequiredError,
  MissingRoleError,
  AccessNotGrantedError,
  InvalidResetTokenError,
  ResetTokenExpiredError,
} from '@pinsquirrel/domain'

const auth = {
  login: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  validateResetToken: vi.fn(),
}

const session = {
  isAuthenticated: vi.fn(),
  getFlash: vi.fn(),
  create: vi.fn(),
  destroy: vi.fn(),
}

const limiter = {
  ipLimited: vi.fn(),
}

vi.mock('../lib/services', () => ({
  // login is the only method left on AuthenticationService; registration,
  // verification, and password recovery moved to AccountService.
  authService: {
    login: (...a: unknown[]) => auth.login(...a) as unknown,
  },
  accountService: {
    register: (...a: unknown[]) => auth.register(...a) as unknown,
    requestPasswordReset: (...a: unknown[]) =>
      auth.requestPasswordReset(...a) as unknown,
    resetPassword: (...a: unknown[]) => auth.resetPassword(...a) as unknown,
    validateResetToken: (...a: unknown[]) =>
      auth.validateResetToken(...a) as unknown,
  },
}))

vi.mock('../middleware/session', () => ({
  getSessionManager: () => ({
    isAuthenticated: (...a: unknown[]): boolean =>
      session.isAuthenticated(...a) as boolean,
    getFlash: (...a: unknown[]) => session.getFlash(...a) as unknown,
    create: (...a: unknown[]) => session.create(...a) as unknown,
    destroy: (...a: unknown[]) => session.destroy(...a) as unknown,
  }),
}))

vi.mock('../middleware/rate-limit', async importOriginal => ({
  ...(await importOriginal<typeof import('../middleware/rate-limit')>()),
  rateLimitByIp: (): MiddlewareHandler => async (c, next) => {
    if (limiter.ipLimited() as boolean) return c.text('Too many requests', 429)
    await next()
  },
}))

vi.mock('../lib/config', () => ({ baseUrl: 'https://pinsquirrel.test' }))

vi.mock('../lib/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  safeError: (e: unknown) => ({ message: String(e) }),
}))

import { authRoutes } from './auth'
import {
  signinIpLimiter,
  signinLimiter,
  signinUsernameLimiter,
} from '../middleware/rate-limit'
import { TEST_CLIENT_IP, exhaust } from '../test-support/rate-limit'

const SIGNIN_USERNAMES = ['a', 'alice', 'bob', 'spread-target']

function form(fields: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  }
}

describe('auth routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    session.isAuthenticated.mockReturnValue(false)
    session.getFlash.mockReturnValue(null)
    limiter.ipLimited.mockReturnValue(false)
    for (const username of SIGNIN_USERNAMES) {
      signinLimiter.reset(`${TEST_CLIENT_IP}:${username}`)
      signinUsernameLimiter.reset(username)
    }
    signinIpLimiter.reset(TEST_CLIENT_IP)
    app = new Hono()
    app.route('/', authRoutes)
  })

  describe('signed-in visitors are bounced off the auth pages', () => {
    it.each([
      '/signin',
      '/signup',
      '/forgot-password',
      '/reset-password/tok-1',
    ])('redirects %s to /pins when already authenticated', async path => {
      session.isAuthenticated.mockReturnValue(true)

      const res = await app.request(path)

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/pins')
    })

    it('does not validate the reset token when already authenticated', async () => {
      session.isAuthenticated.mockReturnValue(true)

      await app.request('/reset-password/tok-1')

      expect(auth.validateResetToken).not.toHaveBeenCalled()
    })
  })

  describe('POST /signin', () => {
    it('creates a session and redirects to /pins', async () => {
      auth.login.mockResolvedValue({ id: 'user-1' })

      const res = await app.request(
        '/signin',
        form({ username: 'alice', password: 'pw' })
      )

      expect(auth.login).toHaveBeenCalledWith({
        username: 'alice',
        password: 'pw',
      })
      expect(session.create).toHaveBeenCalledWith('user-1', false)
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/pins')
    })

    // parseBody() hands back a File for a multipart file part. Casting it to
    // string made it a truthy non-string that reached `.toLowerCase()` in the
    // rate limiter, so anyone could 500 the sign-in form with a curl -F.
    it('does not crash when a field arrives as an uploaded file', async () => {
      auth.login.mockRejectedValue(
        new ValidationError({ username: ['Username is required'] })
      )
      const body = new FormData()
      body.set('username', new File(['x'], 'username.txt'))
      body.set('password', 'pw')

      const res = await app.request('/signin', { method: 'POST', body })

      expect(res.status).toBe(400)
      expect(auth.login).toHaveBeenCalledWith({ username: '', password: 'pw' })
    })

    it('passes keepSignedIn only for the literal string "true"', async () => {
      auth.login.mockResolvedValue({ id: 'user-1' })

      await app.request(
        '/signin',
        form({ username: 'a', password: 'p', keepSignedIn: 'true' })
      )
      expect(session.create).toHaveBeenCalledWith('user-1', true)

      session.create.mockClear()
      await app.request(
        '/signin',
        form({ username: 'a', password: 'p', keepSignedIn: 'on' })
      )
      expect(session.create).toHaveBeenCalledWith('user-1', false)
    })

    describe('open-redirect guard', () => {
      // Only same-site absolute paths are honoured. `//evil.test` is the case
      // that matters: browsers read it as a protocol-relative URL to another
      // host, so a naive startsWith('/') check would hand off the session.
      beforeEach(() => auth.login.mockResolvedValue({ id: 'user-1' }))

      it('honours a relative path', async () => {
        const res = await app.request(
          '/signin',
          form({ username: 'a', password: 'p', redirectTo: '/tags?x=1' })
        )

        expect(res.headers.get('Location')).toBe('/tags?x=1')
      })

      it('honours a plain absolute path', async () => {
        const res = await app.request(
          '/signin',
          form({ username: 'a', password: 'p', redirectTo: '/ok/path' })
        )

        expect(res.headers.get('Location')).toBe('/ok/path')
      })

      it.each([
        ['//evil.test/pwn', 'protocol-relative URL to another host'],
        ['/\\evil.test/pwn', 'backslash form browsers normalise to //'],
        ['/\t/evil.test', 'tab-smuggled protocol-relative URL'],
        ['/.//evil.test/pwn', 'dot segment that resolves to //'],
        ['/%2e//evil.test', 'encoded dot segment that resolves to //'],
        ['/a/..//evil.test', 'parent segment that resolves to //'],
        ['https://evil.test', 'absolute URL'],
        ['evil.test', 'bare host'],
        ['', 'empty value'],
      ])('ignores %s (%s) and falls back to /pins', async redirectTo => {
        const res = await app.request(
          '/signin',
          form({ username: 'a', password: 'p', redirectTo })
        )

        expect(res.headers.get('Location')).toBe('/pins')
      })
    })

    describe('rate limiting', () => {
      const ACCOUNT_KEY = `${TEST_CLIENT_IP}:alice`

      async function signin(password = 'pw', username = 'alice') {
        return app.request('/signin', form({ username, password }))
      }

      async function failTimes(n: number, username = 'alice') {
        for (let i = 0; i < n; i++) await signin(`wrong-${i}`, username)
      }

      it('returns 429 without attempting a login once the account budget is spent', async () => {
        exhaust(signinLimiter, ACCOUNT_KEY)

        const res = await signin()

        expect(res.status).toBe(429)
        expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
        expect(auth.login).not.toHaveBeenCalled()
      })

      it('keys the account budget on the submitted username, case-insensitively', async () => {
        exhaust(signinLimiter, ACCOUNT_KEY)
        auth.login.mockResolvedValue({ id: 'user-1' })

        expect((await signin('pw', 'ALICE')).status).toBe(429)
        expect((await signin('pw', 'bob')).status).toBe(302)
      })

      it('lets at most the account budget reach the password check when attempts arrive together', async () => {
        auth.login.mockImplementation(
          () =>
            new Promise((_, reject) =>
              setTimeout(() => reject(new InvalidCredentialsError()), 10)
            )
        )

        const responses = await Promise.all(
          Array.from({ length: 10 }, (_, i) => signin(`guess-${i}`))
        )

        expect(auth.login).toHaveBeenCalledTimes(5)
        expect(responses.filter(r => r.status === 429)).toHaveLength(5)
      })

      it('gives the account its budget back on a successful sign-in', async () => {
        auth.login.mockRejectedValue(new InvalidCredentialsError())
        await failTimes(4)
        auth.login.mockResolvedValueOnce({ id: 'user-1' })
        await signin()

        await failTimes(4)
        const res = await signin()

        expect(res.status).toBe(400)
        expect(auth.login).toHaveBeenCalledTimes(10)
      })

      it.each([
        ['validation error', () => new ValidationError({ username: ['bad'] })],
        ['unexpected error', () => new Error('boom')],
        ['waitlisted account', () => new AccessNotGrantedError()],
      ])('does not spend the budget on a %s', async (_label, make) => {
        auth.login.mockRejectedValue(make())
        await failTimes(25)
        auth.login.mockResolvedValue({ id: 'user-1' })

        expect((await signin()).status).toBe(302)
      })

      it('returns 429 without attempting a login once the address budget is spent', async () => {
        exhaust(signinIpLimiter, TEST_CLIENT_IP)

        const res = await signin()

        expect(res.status).toBe(429)
        expect(auth.login).not.toHaveBeenCalled()
      })

      it('spends the address budget across usernames', async () => {
        auth.login.mockRejectedValue(new InvalidCredentialsError())
        for (let i = 0; i < 20; i++) {
          await signin('wrong', SIGNIN_USERNAMES[i % SIGNIN_USERNAMES.length])
        }

        expect((await signin('pw', 'bob')).status).toBe(429)
      })

      it('limits failed sign-ins for one username spread across many addresses', async () => {
        auth.login.mockRejectedValue(new InvalidCredentialsError())

        const statuses: number[] = []
        for (let i = 0; i < 100; i++) {
          const res = await app.request(
            '/signin',
            form({ username: 'spread-target', password: `guess-${i}` }),
            { incoming: { socket: { remoteAddress: `198.51.100.${i}` } } }
          )
          statuses.push(res.status)
        }

        expect(auth.login.mock.calls.length).toBeLessThan(100)
        expect(statuses).toContain(429)
      })

      it('does not give the address budget back on a successful sign-in', async () => {
        auth.login.mockRejectedValue(new InvalidCredentialsError())
        for (let i = 0; i < 19; i++) {
          await signin('wrong', SIGNIN_USERNAMES[i % SIGNIN_USERNAMES.length])
        }
        auth.login.mockResolvedValueOnce({ id: 'user-1' })
        await signin('pw', 'bob')

        await signin('wrong', 'bob')

        expect((await signin('pw', 'bob')).status).toBe(429)
      })
    })

    describe('failure status codes', () => {
      it.each([
        ['InvalidCredentialsError', () => new InvalidCredentialsError(), 400],
        [
          'EmailVerificationRequiredError',
          () => new EmailVerificationRequiredError(),
          400,
        ],
        ['ValidationError', () => new ValidationError({ u: ['bad'] }), 400],
        ['unexpected error', () => new Error('boom'), 400],
        ['MissingRoleError', () => new MissingRoleError(), 403],
        ['AccessNotGrantedError', () => new AccessNotGrantedError(), 403],
      ])('responds %s with %i', async (_label, make, status) => {
        auth.login.mockRejectedValue(make())

        const res = await app.request(
          '/signin',
          form({ username: 'a', password: 'p' })
        )

        expect(res.status).toBe(status)
        expect(session.create).not.toHaveBeenCalled()
      })

      it('echoes the username back but never the password', async () => {
        auth.login.mockRejectedValue(new InvalidCredentialsError())

        const res = await app.request(
          '/signin',
          form({ username: 'alice', password: 'hunter2' })
        )
        const html = await res.text()

        expect(html).toContain('alice')
        expect(html).not.toContain('hunter2')
      })

      it('gives the same generic message for a wrong password as an unknown user', async () => {
        // Both paths raise InvalidCredentialsError in the service, so the route
        // cannot leak which half was wrong even by accident.
        auth.login.mockRejectedValue(new InvalidCredentialsError())

        const html = await (
          await app.request('/signin', form({ username: 'a', password: 'p' }))
        ).text()

        expect(html).toContain('Invalid username or password')
      })
    })
  })

  describe('POST /signup', () => {
    it('registers and reports success', async () => {
      auth.register.mockReturnValue(undefined)

      const res = await app.request(
        '/signup',
        form({ username: 'alice', email: 'a@example.test' })
      )

      expect(res.status).toBe(200)
      expect(auth.register).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'alice', email: 'a@example.test' })
      )
      expect(await res.text()).toContain('waitlist')
    })

    it('builds the emailed links from the configured origin, not the request host', async () => {
      auth.register.mockReturnValue(undefined)

      await app.request(
        'http://app.test/signup',
        form({ username: 'a', email: 'a@example.test' })
      )

      expect(auth.register).toHaveBeenCalledWith(
        expect.objectContaining({
          resetUrl: 'https://pinsquirrel.test/reset-password',
          signinUrl: 'https://pinsquirrel.test/signin',
          signupUrl: 'https://pinsquirrel.test/signup',
        })
      )
    })

    it('returns 429 from the IP limiter without registering', async () => {
      limiter.ipLimited.mockReturnValue(true)

      const res = await app.request(
        '/signup',
        form({ username: 'a', email: 'a@example.test' })
      )

      expect(res.status).toBe(429)
      expect(auth.register).not.toHaveBeenCalled()
    })

    it('surfaces validation errors as 400', async () => {
      auth.register.mockImplementation(() => {
        throw new ValidationError({ email: ['invalid'] })
      })

      const res = await app.request(
        '/signup',
        form({ username: 'a', email: 'nope' })
      )

      expect(res.status).toBe(400)
    })
  })

  describe('POST /forgot-password', () => {
    it('renders the success state, not merely a 200', async () => {
      auth.requestPasswordReset.mockReturnValue(undefined)

      const res = await app.request(
        '/forgot-password',
        form({ email: 'nobody@example.test' })
      )

      expect(res.status).toBe(200)
      expect(auth.requestPasswordReset).toHaveBeenCalled()
      expect(await res.text()).toContain('Check Your Email')
    })

    it.each([
      ['http://app.test/forgot-password', 'a foreign host'],
      ['http://pinsquirrel.test/forgot-password', 'plain HTTP from the proxy'],
    ])(
      'builds the reset link from the configured origin for %s (%s)',
      async url => {
        auth.requestPasswordReset.mockReturnValue(undefined)

        await app.request(url, form({ email: 'a@example.test' }))

        expect(auth.requestPasswordReset).toHaveBeenCalledWith(
          expect.objectContaining({
            resetUrl: 'https://pinsquirrel.test/reset-password',
          })
        )
      }
    )

    it('answers identically for a known and an unknown address', async () => {
      // Enumeration safety: the service deliberately resolves the same way for
      // both, and the route must not branch on the result. Asserting the two
      // bodies are byte-identical is the property; a status-only assertion
      // would pass even if the page said "no such account".
      auth.requestPasswordReset.mockReturnValue(undefined)
      const known = await (
        await app.request('/forgot-password', form({ email: 'a@example.test' }))
      ).text()

      auth.requestPasswordReset.mockReturnValue(undefined)
      const unknown = await (
        await app.request('/forgot-password', form({ email: 'b@example.test' }))
      ).text()

      expect(unknown).toBe(known)
      expect(known).toContain('Check Your Email')
    })

    it('returns 429 from the IP limiter without sending anything', async () => {
      limiter.ipLimited.mockReturnValue(true)

      const res = await app.request(
        '/forgot-password',
        form({ email: 'a@example.test' })
      )

      expect(res.status).toBe(429)
      expect(auth.requestPasswordReset).not.toHaveBeenCalled()
    })

    it('surfaces validation errors as 400', async () => {
      auth.requestPasswordReset.mockImplementation(() => {
        throw new ValidationError({ email: ['invalid'] })
      })

      const res = await app.request('/forgot-password', form({ email: 'nope' }))

      expect(res.status).toBe(400)
    })

    it('returns 500 for an unexpected failure', async () => {
      auth.requestPasswordReset.mockImplementation(() => {
        throw new Error('smtp down')
      })

      const res = await app.request(
        '/forgot-password',
        form({ email: 'a@example.test' })
      )

      expect(res.status).toBe(500)
    })

    it('does not read a 429 out of an error message', async () => {
      // The route used to string-match error.message for 'Too many' and answer
      // 429. Rate limiting is the middleware's job - see the IP-limiter case
      // above - so a service error is just an error, whatever it happens to say.
      auth.requestPasswordReset.mockImplementation(() => {
        throw new Error('Too many open connections to the mail provider')
      })

      const res = await app.request(
        '/forgot-password',
        form({ email: 'a@example.test' })
      )

      expect(res.status).toBe(500)
    })
  })

  describe('reset-password', () => {
    it('states the same minimum length the service enforces', async () => {
      auth.validateResetToken.mockResolvedValue(true)

      const res = await app.request('/reset-password/tok-1')
      const text = (await res.text()).replace(/\s+/g, ' ')

      expect(text).toContain('at least 12 characters')
    })

    it('renders the form for a valid token', async () => {
      auth.validateResetToken.mockResolvedValue(true)

      const res = await app.request('/reset-password/tok-1')

      expect(res.status).toBe(200)
      expect(auth.validateResetToken).toHaveBeenCalledWith('tok-1')
    })

    it('renders the invalid-token page rather than 404 for a bad token', async () => {
      auth.validateResetToken.mockResolvedValue(false)

      const res = await app.request('/reset-password/bad')
      const html = await res.text()

      expect(res.status).toBe(200)
      expect(html).not.toContain('name="newPassword"')
    })

    it('rejects mismatched confirmation without touching the service', async () => {
      const res = await app.request(
        '/reset-password/tok-1',
        form({ newPassword: 'aaaaaaaa', confirmPassword: 'bbbbbbbb' })
      )

      expect(res.status).toBe(400)
      expect(auth.resetPassword).not.toHaveBeenCalled()
      expect(await res.text()).toContain('Passwords do not match')
    })

    it('resets and redirects to signin with the success flag', async () => {
      auth.resetPassword.mockResolvedValue(undefined)

      const res = await app.request(
        '/reset-password/tok-1',
        form({ newPassword: 'aaaaaaaa', confirmPassword: 'aaaaaaaa' })
      )

      expect(auth.resetPassword).toHaveBeenCalledWith({
        token: 'tok-1',
        newPassword: 'aaaaaaaa',
      })
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/signin?reset=success')
    })

    it.each([
      ['InvalidResetTokenError', () => new InvalidResetTokenError()],
      ['ResetTokenExpiredError', () => new ResetTokenExpiredError()],
    ])('shows the invalid-token page for %s', async (_label, make) => {
      auth.resetPassword.mockRejectedValue(make())

      const res = await app.request(
        '/reset-password/tok-1',
        form({ newPassword: 'aaaaaaaa', confirmPassword: 'aaaaaaaa' })
      )

      expect(res.status).toBe(200)
      expect(await res.text()).not.toContain('name="newPassword"')
    })

    it('surfaces a weak-password validation error as 400', async () => {
      auth.resetPassword.mockRejectedValue(
        new ValidationError({ newPassword: ['too short'] })
      )

      const res = await app.request(
        '/reset-password/tok-1',
        form({ newPassword: 'short', confirmPassword: 'short' })
      )

      expect(res.status).toBe(400)
    })

    it('returns 500 for an unexpected failure', async () => {
      auth.resetPassword.mockRejectedValue(new Error('db down'))

      const res = await app.request(
        '/reset-password/tok-1',
        form({ newPassword: 'aaaaaaaa', confirmPassword: 'aaaaaaaa' })
      )

      expect(res.status).toBe(500)
    })
  })

  describe('signout', () => {
    it('destroys the session and redirects on POST', async () => {
      const res = await app.request('/signout', { method: 'POST' })

      expect(session.destroy).toHaveBeenCalled()
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/signin')
    })

    it('does not destroy the session on GET', async () => {
      // csrf() does not cover GET, so a GET route here means an <img
      // src="/signout"> on any other site signs the user out.
      const res = await app.request('/signout')

      expect(session.destroy).not.toHaveBeenCalled()
      expect(res.status).toBe(404)
    })

    it('destroys the session even when not signed in', async () => {
      session.isAuthenticated.mockReturnValue(false)

      await app.request('/signout', { method: 'POST' })

      expect(session.destroy).toHaveBeenCalled()
    })
  })

  describe('GET /signin', () => {
    it('shows the reset-success banner only for ?reset=success', async () => {
      const withFlag = await (await app.request('/signin?reset=success')).text()
      const without = await (await app.request('/signin')).text()

      expect(withFlag).not.toBe(without)
    })

    it('carries redirectTo through to the form', async () => {
      const html = await (
        await app.request('/signin?redirectTo=%2Ftags')
      ).text()

      expect(html).toContain('/tags')
    })
  })

  // The extension's popup can land on any of these: a signed-out user pinning
  // a page hits sign-in, and the links between the auth pages have to keep the
  // popup in embed or the site's chrome appears in a 520px window.
  describe('embed mode', () => {
    it.each([
      ['/signin', 'name="username"'],
      ['/signup', 'name="email"'],
      ['/forgot-password', 'name="email"'],
    ])('renders %s without the chrome for ?embed=1', async (path, field) => {
      const html = await (await app.request(`${path}?embed=1`)).text()

      expect(html).toContain(field)
      expect(html).not.toContain('<header')
      expect(html).not.toContain('<footer')
      expect(html).toContain('name="embed" value="1"')
    })

    it('renders the reset form without the chrome for ?embed=1', async () => {
      auth.validateResetToken.mockResolvedValue(true)

      const html = await (
        await app.request('/reset-password/tok-1?embed=1')
      ).text()

      expect(html).toContain('name="newPassword"')
      expect(html).not.toContain('<header')
      expect(html).toContain('name="embed" value="1"')
    })

    it('keeps the chrome and no hidden field without the flag', async () => {
      const html = await (await app.request('/signin')).text()

      expect(html).toContain('<header')
      expect(html).not.toContain('name="embed"')
    })

    it('links between the auth pages with embed on', async () => {
      const signin = await (await app.request('/signin?embed=1')).text()
      const signup = await (await app.request('/signup?embed=1')).text()
      const forgot = await (
        await app.request('/forgot-password?embed=1')
      ).text()

      expect(signin).toContain('href="/signup?embed=1"')
      expect(signin).toContain('href="/forgot-password?embed=1"')
      expect(signup).toContain('href="/signin?embed=1"')
      expect(forgot).toContain('href="/signin?embed=1"')
    })

    it('links plainly without the flag', async () => {
      const signin = await (await app.request('/signin')).text()

      expect(signin).toContain('href="/signup"')
      expect(signin).toContain('href="/forgot-password"')
    })

    it('re-renders a failed sign-in in embed when the form said so', async () => {
      auth.login.mockRejectedValue(new InvalidCredentialsError())

      const res = await app.request(
        '/signin',
        form({ username: 'u', password: 'p', embed: '1' })
      )
      const html = await res.text()

      expect(res.status).toBe(400)
      expect(html).toContain('Invalid username or password')
      expect(html).not.toContain('<header')
      expect(html).toContain('name="embed" value="1"')
    })

    it('sends an embedded sign-in with nowhere to go to the pins in embed', async () => {
      auth.login.mockResolvedValue({ id: 'user-1' })
      session.create.mockResolvedValue(undefined)

      const res = await app.request(
        '/signin',
        form({ username: 'u', password: 'p', embed: '1' })
      )

      expect(res.headers.get('Location')).toBe('/pins?embed=1')
    })

    it('prefers redirectTo over the embed fallback', async () => {
      auth.login.mockResolvedValue({ id: 'user-1' })
      session.create.mockResolvedValue(undefined)

      const res = await app.request(
        '/signin',
        form({
          username: 'u',
          password: 'p',
          embed: '1',
          redirectTo: '/pins/new?url=x&embed=1',
        })
      )

      expect(res.headers.get('Location')).toBe('/pins/new?url=x&embed=1')
    })

    it('re-renders a failed sign-up in embed when the form said so', async () => {
      auth.register.mockImplementation(() => {
        throw new ValidationError({ email: ['bad'] })
      })

      const html = await (
        await app.request(
          '/signup',
          form({ username: 'u', email: 'x', embed: '1' })
        )
      ).text()

      expect(html).not.toContain('<header')
      expect(html).toContain('name="embed" value="1"')
    })

    it('renders the forgot-password success in embed when the form said so', async () => {
      auth.requestPasswordReset.mockReturnValue(undefined)

      const html = await (
        await app.request(
          '/forgot-password',
          form({ email: 'a@b.test', embed: '1' })
        )
      ).text()

      expect(html).toContain('Check Your Email')
      expect(html).not.toContain('<header')
      expect(html).toContain('href="/signin?embed=1"')
    })

    it('sends a reset done in embed to the embedded sign-in', async () => {
      auth.resetPassword.mockResolvedValue(undefined)

      const res = await app.request(
        '/reset-password/tok-1',
        form({
          newPassword: 'aaaaaaaa',
          confirmPassword: 'aaaaaaaa',
          embed: '1',
        })
      )

      expect(res.headers.get('Location')).toBe('/signin?reset=success&embed=1')
    })

    it('re-renders a mismatched reset in embed when the form said so', async () => {
      const html = await (
        await app.request(
          '/reset-password/tok-1',
          form({ newPassword: 'aaaaaaaa', confirmPassword: 'b', embed: '1' })
        )
      ).text()

      expect(html).toContain('Passwords do not match')
      expect(html).not.toContain('<header')
    })
  })
})
