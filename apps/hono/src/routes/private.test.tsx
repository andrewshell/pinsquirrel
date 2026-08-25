/**
 * Characterization tests for the private pin routes.
 *
 * Deliberately mirrors `pins.test.tsx` section for section: the two route files
 * share 558 identical lines, so the suites should read the same too. Where this
 * file asserts something `pins.test.tsx` does not — or asserts it differently —
 * that is a genuine behavioral divergence between the two routers, and each one
 * is called out inline. Those are the cases a shared route factory has to keep.
 *
 * `requirePrivateUnlock` is exercised for real rather than stubbed, since the
 * unlock gate is the one piece of behavior with no counterpart in `pins.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import {
  Pagination,
  DuplicatePinError,
  InvalidCredentialsError,
  PinNotFoundError,
} from '@pinsquirrel/domain'
import {
  testUser,
  makePin,
  makeTag,
  createServiceMocks,
  createSessionMocks,
  fakeSessionManager,
  formBody,
} from '../test-support/pin-routes'

const svc = createServiceMocks()
const session = createSessionMocks()

const unlockLimiter = {
  isLimited: vi.fn(),
  hit: vi.fn(),
  reset: vi.fn(),
}

// The RateLimiter class has its own unit tests; what matters here is that the
// unlock route consults it and honours the answer, so the seam is driven
// directly - same approach as auth.test.tsx.
vi.mock('../middleware/rate-limit', () => ({
  privateUnlockLimiter: {
    isLimited: (...a: unknown[]): boolean =>
      unlockLimiter.isLimited(...a) as boolean,
    hit: (...a: unknown[]): unknown => unlockLimiter.hit(...a) as unknown,
    reset: (...a: unknown[]): unknown => unlockLimiter.reset(...a) as unknown,
  },
}))

vi.mock('../lib/services', () => ({
  authService: {
    login: (...a: unknown[]) => svc.login(...a) as unknown,
  },
  pinService: {
    getPin: (...a: unknown[]) => svc.getPin(...a) as unknown,
    createPin: (...a: unknown[]) => svc.createPin(...a) as unknown,
    updatePin: (...a: unknown[]) => svc.updatePin(...a) as unknown,
    deletePin: (...a: unknown[]) => svc.deletePin(...a) as unknown,
    getUserPinsWithPagination: (...a: unknown[]) =>
      svc.getUserPinsWithPagination(...a) as unknown,
  },
  tagService: {
    getUserTags: (...a: unknown[]) => svc.getUserTags(...a) as unknown,
  },
}))

vi.mock('../middleware/session', () => ({
  requireAuth: (): MiddlewareHandler => async (_c, next) => {
    await next()
  },
  getSessionManager: () => fakeSessionManager(session),
  // requireAuth resolves the user; the suites drive that seam through the same
  // session.getUser mock so the fixtures stay shared with the real middleware.
  getAuthUser: () => session.authUser() as unknown,
}))

import { privateRoutes } from './private'

describe('private routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    session.getUser.mockResolvedValue(testUser)
    session.authUser.mockReturnValue(testUser)
    session.getFlash.mockReturnValue(null)
    session.isPrivateUnlocked.mockReturnValue(true)
    unlockLimiter.isLimited.mockReturnValue(false)
    svc.getUserTags.mockResolvedValue([makeTag()])
    svc.getUserPinsWithPagination.mockResolvedValue({
      pins: [makePin({ isPrivate: true })],
      pagination: Pagination.fromTotalCount(1),
    })
    app = new Hono()
    app.route('/private', privateRoutes)
  })

  // ---- No counterpart in pins.tsx -----------------------------------------

  describe('unlock gate', () => {
    it('redirects pin routes to /private/unlock while locked', async () => {
      session.isPrivateUnlocked.mockReturnValue(false)

      const res = await app.request('/private/pins')

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/private/unlock')
      expect(svc.getUserPinsWithPagination).not.toHaveBeenCalled()
    })

    // Sub-routes need their own assertions, not just the list. Verified by
    // mutation: deleting `use('/pins/*', requirePrivateUnlock())` while only
    // the list was covered went undetected — every pin detail route would have
    // been reachable while locked, with a green suite.
    //
    // (The companion `use('/pins', ...)` registration is redundant on Hono
    // 4.13 — a `/pins/*` middleware already runs for a bare `/pins` request,
    // confirmed by probe. Harmless, but not load-bearing.)
    it.each([
      ['/private/pins/new', 'GET'],
      ['/private/pins/pin-1/edit', 'GET'],
      ['/private/pins/pin-1/card', 'GET'],
      ['/private/pins/pin-1/delete', 'GET'],
    ])('gates %s while locked', async path => {
      session.isPrivateUnlocked.mockReturnValue(false)

      const res = await app.request(path)

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/private/unlock')
      expect(svc.getPin).not.toHaveBeenCalled()
      expect(svc.getUserTags).not.toHaveBeenCalled()
    })

    it('gates mutating sub-routes while locked', async () => {
      session.isPrivateUnlocked.mockReturnValue(false)

      const created = await app.request(
        '/private/pins/new',
        formBody({ url: 'https://x.test/a', title: 'T' })
      )
      const deleted = await app.request('/private/pins/pin-1', {
        method: 'DELETE',
      })

      expect(created.status).toBe(302)
      expect(deleted.status).toBe(302)
      expect(svc.createPin).not.toHaveBeenCalled()
      expect(svc.deletePin).not.toHaveBeenCalled()
    })

    it('uses HX-Redirect for HTMX requests while locked', async () => {
      session.isPrivateUnlocked.mockReturnValue(false)

      const res = await app.request('/private/pins', {
        headers: { 'HX-Request': 'true' },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('HX-Redirect')).toBe('/private/unlock')
    })

    it('renders the unlock form when locked', async () => {
      session.isPrivateUnlocked.mockReturnValue(false)

      const res = await app.request('/private/unlock')

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('password')
    })

    it('skips the unlock form when already unlocked', async () => {
      const res = await app.request('/private/unlock')

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/private/pins')
    })

    it('unlocks on a correct password', async () => {
      svc.login.mockResolvedValue(testUser)

      const res = await app.request(
        '/private/unlock',
        formBody({ password: 'correct-horse' })
      )

      expect(svc.login).toHaveBeenCalledWith({
        username: testUser.username,
        password: 'correct-horse',
      })
      expect(session.unlockPrivateMode).toHaveBeenCalled()
      expect(res.headers.get('Location')).toBe('/private/pins')
    })

    it('re-renders with an error on a wrong password, without unlocking', async () => {
      svc.login.mockRejectedValue(new InvalidCredentialsError())

      const res = await app.request(
        '/private/unlock',
        formBody({ password: 'wrong' })
      )

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('Invalid password')
      expect(session.unlockPrivateMode).not.toHaveBeenCalled()
    })

    // Unlock checks the account password on every POST, so without a limit it
    // is an unbounded password-guessing oracle for anyone holding the session
    // cookie. Keyed on the user id, not the IP: the attacker already has the
    // session, so the address proves nothing and rotating it must not help.
    describe('rate limiting', () => {
      it('returns 429 without checking the password when limited', async () => {
        unlockLimiter.isLimited.mockReturnValue(true)

        const res = await app.request(
          '/private/unlock',
          formBody({ password: 'guess' })
        )

        expect(res.status).toBe(429)
        expect(svc.login).not.toHaveBeenCalled()
        expect(session.unlockPrivateMode).not.toHaveBeenCalled()
      })

      it('keys the limiter on the user id', async () => {
        svc.login.mockResolvedValue(testUser)

        await app.request('/private/unlock', formBody({ password: 'p' }))

        expect(unlockLimiter.isLimited).toHaveBeenCalledWith(testUser.id)
      })

      it('counts a wrong password against the limiter', async () => {
        svc.login.mockRejectedValue(new InvalidCredentialsError())

        await app.request('/private/unlock', formBody({ password: 'wrong' }))

        expect(unlockLimiter.hit).toHaveBeenCalledWith(testUser.id)
      })

      it('clears the limiter on a correct password', async () => {
        svc.login.mockResolvedValue(testUser)

        await app.request('/private/unlock', formBody({ password: 'right' }))

        expect(unlockLimiter.reset).toHaveBeenCalledWith(testUser.id)
        expect(unlockLimiter.hit).not.toHaveBeenCalled()
      })
    })

    it('locks and redirects to the public list', async () => {
      const res = await app.request('/private/lock', { method: 'POST' })

      expect(session.lockPrivateMode).toHaveBeenCalled()
      expect(res.headers.get('Location')).toBe('/pins')
    })

    it('returns 204 for a ?beacon=1 lock (tab close)', async () => {
      const res = await app.request('/private/lock?beacon=1', {
        method: 'POST',
      })

      expect(res.status).toBe(204)
      expect(session.lockPrivateMode).toHaveBeenCalled()
    })
  })

  // ---- Mirrors pins.test.tsx ----------------------------------------------

  describe('GET /pins — list', () => {
    it('forces the filter to private pins', async () => {
      const res = await app.request('/private/pins')

      expect(res.status).toBe(200)
      expect(svc.getUserPinsWithPagination.mock.calls[0][1]).toMatchObject({
        isPrivate: true,
      })
    })

    it('uses a fixed page size of 25, as the public list does', async () => {
      await app.request('/private/pins')

      expect(svc.getUserPinsWithPagination.mock.calls[0][2]).toEqual({
        page: 1,
        pageSize: 25,
      })
    })

    it('maps query params onto the filter, as the public list does', async () => {
      await app.request('/private/pins?tag=foo&search=box&notags=true&page=3')

      const [, filter, options] = svc.getUserPinsWithPagination.mock.calls[0]
      expect(filter).toMatchObject({
        isPrivate: true,
        tag: 'foo',
        search: 'box',
        noTags: true,
      })
      expect(options).toMatchObject({ page: 3 })
    })

    it('returns only the content partial for HTMX requests', async () => {
      const full = await app.request('/private/pins')
      const partial = await app.request('/private/pins', {
        headers: { 'HX-Request': 'true' },
      })

      expect(partial.status).toBe(200)
      expect((await partial.text()).length).toBeLessThan(
        (await full.text()).length
      )
    })
  })

  describe('GET /pins/new — create form', () => {
    it('renders the form', async () => {
      const res = await app.request('/private/pins/new')

      expect(res.status).toBe(200)
    })

    // DIVERGENCE: the public GET /pins/new looks the prefill URL up and
    // redirects to the existing pin's edit page (bookmarklet dedup). The
    // private form has no such lookup, so a duplicate URL is only caught on
    // submit. A shared factory must keep this optional, not unify it.
    it('does NOT perform the bookmarklet dedup lookup', async () => {
      await app.request('/private/pins/new?url=https%3A%2F%2Fx.test%2Fa')

      expect(svc.getUserPinsWithPagination).not.toHaveBeenCalled()
    })
  })

  describe('POST /pins/new — create', () => {
    it('creates a pin and redirects to the private list', async () => {
      svc.createPin.mockResolvedValue(makePin({ isPrivate: true }))

      const res = await app.request(
        '/private/pins/new',
        formBody({ url: 'https://x.test/a', title: 'Hello', tags: 'foo, bar' })
      )

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/private/pins')
      expect(svc.createPin).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: testUser.id,
          url: 'https://x.test/a',
          title: 'Hello',
          tagNames: ['foo', 'bar'],
        })
      )
    })

    // DIVERGENCE (create): isPrivate is hardcoded true and the submitted form
    // value is ignored. Compare the edit handler below, which honours it.
    it('forces isPrivate true, ignoring the submitted value', async () => {
      svc.createPin.mockResolvedValue(makePin({ isPrivate: true }))

      await app.request(
        '/private/pins/new',
        formBody({ url: 'https://x.test/a', title: 'T', isPrivate: 'false' })
      )

      expect(svc.createPin.mock.calls[0][1]).toMatchObject({ isPrivate: true })
    })

    it('flashes the private-specific success message', async () => {
      // Distinct from the public list's 'Pin created successfully!'. It is a
      // createPinRoutes option now, so it would be easy to unify by accident.
      svc.createPin.mockResolvedValue(makePin({ isPrivate: true }))

      await app.request(
        '/private/pins/new',
        formBody({ url: 'https://x.test/a', title: 'T' })
      )

      expect(session.setFlash).toHaveBeenCalledWith(
        'success',
        'Private pin created successfully!'
      )
    })

    it('re-renders the form without redirecting on a duplicate URL', async () => {
      svc.createPin.mockRejectedValue(new DuplicatePinError('https://x.test/a'))

      const res = await app.request(
        '/private/pins/new',
        formBody({ url: 'https://x.test/a', title: 'T' })
      )

      expect(res.status).toBe(200)
      expect(res.headers.get('Location')).toBeNull()
    })

    // The "Edit instead?" escape hatch must stay inside private mode; a link
    // to /pins/:id/edit walks the user out of it.
    it('points the duplicate-URL link at the private edit form', async () => {
      svc.createPin.mockRejectedValue(
        new DuplicatePinError('https://x.test/a', {
          id: 'pin-9',
          createdAt: new Date('2024-01-01'),
        })
      )

      const res = await app.request(
        '/private/pins/new',
        formBody({ url: 'https://x.test/a', title: 'T' })
      )

      const html = await res.text()
      expect(html).toContain('/private/pins/pin-9/edit')
      expect(html).not.toContain('"/pins/pin-9/edit"')
    })

    it('uses HX-Redirect instead of a 302 for HTMX submissions', async () => {
      svc.createPin.mockResolvedValue(makePin())

      const res = await app.request('/private/pins/new', {
        ...formBody({ url: 'https://x.test/a', title: 'T' }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'HX-Request': 'true',
        },
      })

      expect(res.headers.get('HX-Redirect')).toBe('/private/pins')
    })
  })

  describe('POST /pins/:id/edit — update', () => {
    beforeEach(() => {
      svc.getPin.mockResolvedValue(makePin({ isPrivate: true }))
      svc.updatePin.mockResolvedValue(makePin({ isPrivate: true }))
    })

    it('updates and redirects to the private list', async () => {
      const res = await app.request(
        '/private/pins/pin-1/edit',
        formBody({ url: 'https://x.test/b', title: 'Updated' })
      )

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/private/pins')
      expect(svc.updatePin).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: 'pin-1', title: 'Updated' })
      )
    })

    // DIVERGENCE (edit): unlike create above, the edit handler reads isPrivate
    // from the form — so a pin can be made public from inside the private view.
    // Asymmetric with create by design or by accident; pinned here either way.
    it('honours the submitted isPrivate, allowing a pin to be made public', async () => {
      await app.request(
        '/private/pins/pin-1/edit',
        formBody({ url: 'https://x.test/b', title: 'T', isPrivate: 'false' })
      )

      expect(svc.updatePin.mock.calls[0][1]).toMatchObject({
        isPrivate: false,
      })
    })

    it('preserves list filters in the redirect target', async () => {
      const res = await app.request(
        '/private/pins/pin-1/edit?tag=foo&page=2',
        formBody({ url: 'https://x.test/b', title: 'Updated' })
      )

      expect(res.headers.get('Location')).toBe('/private/pins?tag=foo&page=2')
    })
  })

  describe('POST /pins/:id/toggle-read', () => {
    it('flips readLater and returns just the card', async () => {
      svc.getPin.mockResolvedValue(makePin({ readLater: false }))
      svc.updatePin.mockResolvedValue(makePin({ readLater: true }))

      const res = await app.request('/private/pins/pin-1/toggle-read', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      expect(svc.updatePin.mock.calls[0][1]).toMatchObject({ readLater: true })
      expect(await res.text()).not.toContain('<html')
    })

    it('preserves the pin’s existing isPrivate when toggling', async () => {
      svc.getPin.mockResolvedValue(makePin({ isPrivate: true }))
      svc.updatePin.mockResolvedValue(makePin({ isPrivate: true }))

      await app.request('/private/pins/pin-1/toggle-read', { method: 'POST' })

      expect(svc.updatePin.mock.calls[0][1]).toMatchObject({ isPrivate: true })
    })
  })

  describe('GET /pins/:id/delete-confirm — inline confirmation', () => {
    it('returns the confirmation fragment against the private base URL', async () => {
      svc.getPin.mockResolvedValue(makePin({ isPrivate: true }))

      const html = await (
        await app.request('/private/pins/pin-1/delete-confirm')
      ).text()

      expect(html).toContain('/private/pins/pin-1')
      expect(html).not.toContain('<html')
    })

    it('404s for a missing pin', async () => {
      svc.getPin.mockRejectedValue(new PinNotFoundError('pin-1'))

      const res = await app.request('/private/pins/pin-1/delete-confirm')

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /pins/:id', () => {
    it('deletes the pin and returns the refreshed list partial', async () => {
      svc.deletePin.mockResolvedValue(true)

      const res = await app.request('/private/pins/pin-1', { method: 'DELETE' })

      expect(svc.deletePin).toHaveBeenCalledWith(expect.anything(), 'pin-1')
      expect(res.status).toBe(200)
      expect(await res.text()).not.toContain('<html')
    })

    it('keeps the list private when rebuilding after delete', async () => {
      svc.deletePin.mockResolvedValue(true)

      await app.request('/private/pins/pin-1?tag=foo', { method: 'DELETE' })

      expect(svc.getUserPinsWithPagination.mock.calls[0][1]).toMatchObject({
        isPrivate: true,
        tag: 'foo',
      })
    })
  })

  describe('GET|POST /pins/:id/delete — full-page delete', () => {
    it('renders the confirmation page', async () => {
      svc.getPin.mockResolvedValue(makePin({ isPrivate: true }))

      const res = await app.request('/private/pins/pin-1/delete')

      expect(res.status).toBe(200)
    })

    it('deletes and redirects to the private list on POST', async () => {
      svc.getPin.mockResolvedValue(makePin({ isPrivate: true }))
      svc.deletePin.mockResolvedValue(true)

      const res = await app.request('/private/pins/pin-1/delete', {
        method: 'POST',
      })

      expect(svc.deletePin).toHaveBeenCalledWith(expect.anything(), 'pin-1')
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/private/pins')
    })
  })

  describe('base URL wiring', () => {
    it('renders card links against /private/pins, not /pins', async () => {
      svc.getPin.mockResolvedValue(makePin())

      const html = await (await app.request('/private/pins/pin-1/card')).text()

      expect(html).toContain('/private/pins/pin-1')
    })
  })
})
