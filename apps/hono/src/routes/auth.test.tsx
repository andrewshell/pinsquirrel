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
  isLimited: vi.fn(),
  hit: vi.fn(),
  reset: vi.fn(),
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

// The RateLimiter class has its own unit tests; what matters here is that the
// routes consult it and honour the answer, so the seam is driven directly.
vi.mock('../middleware/rate-limit', () => ({
  signinLimiter: {
    isLimited: (...a: unknown[]): boolean => limiter.isLimited(...a) as boolean,
    hit: (...a: unknown[]): unknown => limiter.hit(...a) as unknown,
    reset: (...a: unknown[]): unknown => limiter.reset(...a) as unknown,
  },
  signupLimiter: {},
  forgotPasswordLimiter: {},
  signinRateLimitKey: (_c: unknown, username: string) => `ip:${username}`,
  rateLimitByIp: (): MiddlewareHandler => async (c, next) => {
    if (limiter.ipLimited() as boolean) return c.text('Too many requests', 429)
    await next()
  },
}))

vi.mock('../lib/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  safeError: (e: unknown) => ({ message: String(e) }),
}))

import { authRoutes } from './auth'

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
    limiter.isLimited.mockReturnValue(false)
    limiter.ipLimited.mockReturnValue(false)
    app = new Hono()
    app.route('/', authRoutes)
  })

  describe('signed-in visitors are bounced off the auth pages', () => {
    it.each([
      '/signin',
      '/signup',
      '/forgot-password',
      '/reset-password/tok-1',
    ])('redirects %s to /pins when already authenticated', async (path) => {
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

      it.each([
        ['//evil.test/pwn', 'protocol-relative URL to another host'],
        ['https://evil.test', 'absolute URL'],
        ['evil.test', 'bare host'],
        ['', 'empty value'],
      ])('ignores %s (%s) and falls back to /pins', async (redirectTo) => {
        const res = await app.request(
          '/signin',
          form({ username: 'a', password: 'p', redirectTo })
        )

        expect(res.headers.get('Location')).toBe('/pins')
      })
    })

    describe('rate limiting', () => {
      it('returns 429 without attempting a login when limited', async () => {
        limiter.isLimited.mockReturnValue(true)

        const res = await app.request(
          '/signin',
          form({ username: 'alice', password: 'pw' })
        )

        expect(res.status).toBe(429)
        expect(auth.login).not.toHaveBeenCalled()
      })

      it('keys the limiter on the submitted username', async () => {
        auth.login.mockResolvedValue({ id: 'user-1' })

        await app.request('/signin', form({ username: 'alice', password: 'p' }))

        expect(limiter.isLimited).toHaveBeenCalledWith('ip:alice')
      })

      it('clears the limiter on a successful sign-in', async () => {
        auth.login.mockResolvedValue({ id: 'user-1' })

        await app.request('/signin', form({ username: 'alice', password: 'p' }))

        expect(limiter.reset).toHaveBeenCalledWith('ip:alice')
        expect(limiter.hit).not.toHaveBeenCalled()
      })

      it('counts a failed attempt only for wrong credentials', async () => {
        auth.login.mockRejectedValue(new InvalidCredentialsError())

        await app.request('/signin', form({ username: 'alice', password: 'x' }))

        expect(limiter.hit).toHaveBeenCalledWith('ip:alice')
      })

      it.each([
        ['validation error', () => new ValidationError({ username: ['bad'] })],
        ['unexpected error', () => new Error('boom')],
      ])('does not count a failed attempt for a %s', async (_label, make) => {
        // Only wrong credentials should burn an attempt. Counting validation or
        // infrastructure failures would let a broken dependency lock users out.
        auth.login.mockRejectedValue(make())

        await app.request('/signin', form({ username: 'alice', password: 'x' }))

        expect(limiter.hit).not.toHaveBeenCalled()
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
      auth.register.mockResolvedValue({ emailFailed: false })

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

    it('derives the reset and signin URLs from the request origin', async () => {
      auth.register.mockResolvedValue({ emailFailed: false })

      await app.request(
        'http://app.test/signup',
        form({ username: 'a', email: 'a@example.test' })
      )

      expect(auth.register).toHaveBeenCalledWith(
        expect.objectContaining({
          resetUrl: 'http://app.test/reset-password',
          signinUrl: 'http://app.test/signin',
          signupUrl: 'http://app.test/signup',
        })
      )
    })

    it('still reports success when the confirmation email fails', async () => {
      auth.register.mockResolvedValue({ emailFailed: true })

      const res = await app.request(
        '/signup',
        form({ username: 'a', email: 'a@example.test' })
      )
      const html = await res.text()

      expect(res.status).toBe(200)
      expect(html).toContain('trouble sending')
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
      auth.register.mockRejectedValue(
        new ValidationError({ email: ['invalid'] })
      )

      const res = await app.request(
        '/signup',
        form({ username: 'a', email: 'nope' })
      )

      expect(res.status).toBe(400)
    })
  })

  describe('POST /forgot-password', () => {
    it('renders the success state, not merely a 200', async () => {
      auth.requestPasswordReset.mockResolvedValue(undefined)

      const res = await app.request(
        '/forgot-password',
        form({ email: 'nobody@example.test' })
      )

      expect(res.status).toBe(200)
      expect(auth.requestPasswordReset).toHaveBeenCalled()
      expect(await res.text()).toContain('Check Your Email')
    })

    it('answers identically for a known and an unknown address', async () => {
      // Enumeration safety: the service deliberately resolves the same way for
      // both, and the route must not branch on the result. Asserting the two
      // bodies are byte-identical is the property; a status-only assertion
      // would pass even if the page said "no such account".
      auth.requestPasswordReset.mockResolvedValue(undefined)
      const known = await (
        await app.request('/forgot-password', form({ email: 'a@example.test' }))
      ).text()

      auth.requestPasswordReset.mockResolvedValue(undefined)
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
      auth.requestPasswordReset.mockRejectedValue(
        new ValidationError({ email: ['invalid'] })
      )

      const res = await app.request('/forgot-password', form({ email: 'nope' }))

      expect(res.status).toBe(400)
    })

    it('returns 500 for an unexpected failure', async () => {
      auth.requestPasswordReset.mockRejectedValue(new Error('smtp down'))

      const res = await app.request(
        '/forgot-password',
        form({ email: 'a@example.test' })
      )

      expect(res.status).toBe(500)
    })
  })

  describe('reset-password', () => {
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
    it.each([
      ['POST', { method: 'POST' }],
      ['GET', {}],
    ])('destroys the session and redirects on %s', async (_m, init) => {
      const res = await app.request('/signout', init)

      expect(session.destroy).toHaveBeenCalled()
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/signin')
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
})
