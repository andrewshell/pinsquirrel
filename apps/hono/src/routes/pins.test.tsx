/**
 * Characterization tests for the public pin routes.
 *
 * These pin down current behavior ahead of deduplicating `pins.tsx` and
 * `private.tsx`, which share 558 identical lines. They assert what the code
 * does today, not what it ought to do — where behavior looks questionable it is
 * captured and labelled rather than corrected, so the refactor stays provably
 * behavior-preserving.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import {
  Pagination,
  DuplicatePinError,
  ValidationError,
  PinNotFoundError,
  UnauthorizedPinAccessError,
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

vi.mock('../lib/services', () => ({
  pinService: {
    getPin: (...a: unknown[]) => svc.getPin(...a) as unknown,
    createPin: (...a: unknown[]) => svc.createPin(...a) as unknown,
    updatePin: (...a: unknown[]) => svc.updatePin(...a) as unknown,
    deletePin: (...a: unknown[]) => svc.deletePin(...a) as unknown,
    getUserPinsWithPagination: (...a: unknown[]) =>
      svc.getUserPinsWithPagination(...a) as unknown,
    findByUrl: (...a: unknown[]) => svc.findByUrl(...a) as unknown,
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

import { pinsRoutes } from './pins'

describe('pins routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    session.getUser.mockResolvedValue(testUser)
    session.authUser.mockReturnValue(testUser)
    session.getFlash.mockReturnValue(null)
    svc.getUserTags.mockResolvedValue([makeTag()])
    svc.getUserPinsWithPagination.mockResolvedValue({
      pins: [makePin()],
      pagination: Pagination.fromTotalCount(1),
    })
    app = new Hono()
    app.route('/pins', pinsRoutes)
  })

  describe('GET / — list', () => {
    it('renders the list and excludes private pins from the filter', async () => {
      const res = await app.request('/pins')

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('Example Pin')

      const filter = svc.getUserPinsWithPagination.mock.calls[0][1]
      expect(filter).toMatchObject({ isPrivate: false })
    })

    it('uses a fixed page size of 25', async () => {
      await app.request('/pins')

      expect(svc.getUserPinsWithPagination.mock.calls[0][2]).toEqual({
        page: 1,
        pageSize: 25,
      })
    })

    it('maps query params onto the filter', async () => {
      await app.request('/pins?tag=foo&search=box&notags=true&page=3')

      const [, filter, options] = svc.getUserPinsWithPagination.mock.calls[0]
      expect(filter).toMatchObject({
        isPrivate: false,
        tag: 'foo',
        search: 'box',
        noTags: true,
      })
      expect(options).toMatchObject({ page: 3 })
    })

    it('maps unread=true/false onto readLater, and omits it otherwise', async () => {
      await app.request('/pins?unread=true')
      expect(svc.getUserPinsWithPagination.mock.calls[0][1]).toMatchObject({
        readLater: true,
      })

      svc.getUserPinsWithPagination.mockClear()
      await app.request('/pins?unread=false')
      expect(svc.getUserPinsWithPagination.mock.calls[0][1]).toMatchObject({
        readLater: false,
      })

      svc.getUserPinsWithPagination.mockClear()
      await app.request('/pins')
      expect(svc.getUserPinsWithPagination.mock.calls[0][1]).not.toHaveProperty(
        'readLater'
      )
    })

    it('defaults sorting to created/desc and honours overrides', async () => {
      await app.request('/pins')
      expect(svc.getUserPinsWithPagination.mock.calls[0][1]).toMatchObject({
        sortBy: 'created',
        sortDirection: 'desc',
      })

      svc.getUserPinsWithPagination.mockClear()
      await app.request('/pins?sort=title&direction=asc')
      expect(svc.getUserPinsWithPagination.mock.calls[0][1]).toMatchObject({
        sortBy: 'title',
        sortDirection: 'asc',
      })
    })

    it('returns only the content partial for HTMX requests', async () => {
      const full = await app.request('/pins')
      const partial = await app.request('/pins', {
        headers: { 'HX-Request': 'true' },
      })

      const fullHtml = await full.text()
      const partialHtml = await partial.text()

      expect(partial.status).toBe(200)
      expect(partialHtml).toContain('Example Pin')
      expect(partialHtml.length).toBeLessThan(fullHtml.length)
    })
  })

  describe('GET /new — create form', () => {
    it('renders the form', async () => {
      const res = await app.request('/pins/new')
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('form')
    })

    it('prefills from query params when the URL is not already saved', async () => {
      svc.findByUrl.mockResolvedValue(null)

      const res = await app.request(
        '/pins/new?url=https%3A%2F%2Fx.test%2Fa&title=Hello&tag=foo'
      )
      const html = await res.text()

      expect(res.status).toBe(200)
      expect(html).toContain('https://x.test/a')
      expect(html).toContain('Hello')
    })

    it('redirects to the existing pin when the URL is already saved', async () => {
      // Bookmarklet dedup: a prefill URL that already exists sends the user to
      // that pin's edit form instead of creating a duplicate.
      svc.findByUrl.mockResolvedValue(makePin({ id: 'pin-42' }))

      const res = await app.request('/pins/new?url=https%3A%2F%2Fx.test%2Fa')

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/pins/pin-42/edit')
      expect(svc.findByUrl.mock.calls[0][1]).toBe('https://x.test/a')
    })

    it('skips the dedup lookup when no url param is supplied', async () => {
      await app.request('/pins/new')

      expect(svc.findByUrl).not.toHaveBeenCalled()
    })
  })

  describe('POST /new — create', () => {
    it('creates a pin and redirects to the list', async () => {
      svc.createPin.mockResolvedValue(makePin())

      const res = await app.request(
        '/pins/new',
        formBody({
          url: 'https://x.test/a',
          title: 'Hello',
          description: 'Desc',
          tags: 'foo, bar',
        })
      )

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/pins')
      expect(svc.createPin).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: testUser.id,
          url: 'https://x.test/a',
          title: 'Hello',
          description: 'Desc',
          tagNames: ['foo', 'bar'],
        })
      )
    })

    it('reads isPrivate from the submitted form', async () => {
      svc.createPin.mockResolvedValue(makePin())

      await app.request(
        '/pins/new',
        formBody({ url: 'https://x.test/a', title: 'T', isPrivate: 'true' })
      )

      expect(svc.createPin.mock.calls[0][1]).toMatchObject({ isPrivate: true })
    })

    it('treats readLater as true only for the literal string "true"', async () => {
      svc.createPin.mockResolvedValue(makePin())

      await app.request(
        '/pins/new',
        formBody({ url: 'https://x.test/a', title: 'T', readLater: 'on' })
      )

      expect(svc.createPin.mock.calls[0][1]).toMatchObject({ readLater: false })
    })

    it('sends null, not empty string, for an omitted description', async () => {
      // Reaches the database as a nullable column, so the distinction matters.
      svc.createPin.mockResolvedValue(makePin())

      await app.request(
        '/pins/new',
        formBody({ url: 'https://x.test/a', title: 'T', description: '' })
      )

      expect(svc.createPin.mock.calls[0][1]).toMatchObject({
        description: null,
      })
    })

    it('drops empty tags and trims whitespace', async () => {
      svc.createPin.mockResolvedValue(makePin())

      await app.request(
        '/pins/new',
        formBody({ url: 'https://x.test/a', title: 'T', tags: ' foo , , bar ' })
      )

      expect(svc.createPin.mock.calls[0][1]).toMatchObject({
        tagNames: ['foo', 'bar'],
      })
    })

    it('sets a success flash on create', async () => {
      svc.createPin.mockResolvedValue(makePin())

      await app.request(
        '/pins/new',
        formBody({ url: 'https://x.test/a', title: 'T' })
      )

      expect(session.setFlash).toHaveBeenCalledWith(
        'success',
        expect.stringContaining('created')
      )
    })

    it('re-renders the form without redirecting when the URL is a duplicate', async () => {
      svc.createPin.mockRejectedValue(new DuplicatePinError('https://x.test/a'))

      const res = await app.request(
        '/pins/new',
        formBody({ url: 'https://x.test/a', title: 'T' })
      )

      expect(res.status).toBe(200)
      expect(res.headers.get('Location')).toBeNull()
    })

    it('re-renders the form on a validation error', async () => {
      svc.createPin.mockRejectedValue(new ValidationError({ url: ['invalid'] }))

      const res = await app.request(
        '/pins/new',
        formBody({ url: 'nope', title: 'T' })
      )

      expect(res.status).toBe(200)
    })

    it('uses HX-Redirect instead of a 302 for HTMX submissions', async () => {
      svc.createPin.mockResolvedValue(makePin())

      const res = await app.request('/pins/new', {
        ...formBody({ url: 'https://x.test/a', title: 'T' }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'HX-Request': 'true',
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('HX-Redirect')).toBe('/pins')
    })
  })

  describe('GET /:id/edit — edit form', () => {
    it('renders the form for an existing pin', async () => {
      svc.getPin.mockResolvedValue(makePin({ title: 'Existing' }))

      const res = await app.request('/pins/pin-1/edit')

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('Existing')
      expect(svc.getPin).toHaveBeenCalledWith(expect.anything(), 'pin-1')
    })
  })

  describe('POST /:id/edit — update', () => {
    beforeEach(() => {
      svc.getPin.mockResolvedValue(makePin())
      svc.updatePin.mockResolvedValue(makePin())
    })

    it('updates and redirects to the list', async () => {
      const res = await app.request(
        '/pins/pin-1/edit',
        formBody({ url: 'https://x.test/b', title: 'Updated' })
      )

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/pins')
      expect(svc.updatePin).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: 'pin-1', title: 'Updated' })
      )
    })

    it('preserves list filters in the redirect target', async () => {
      const res = await app.request(
        '/pins/pin-1/edit?tag=foo&page=2',
        formBody({ url: 'https://x.test/b', title: 'Updated' })
      )

      expect(res.headers.get('Location')).toBe('/pins?tag=foo&page=2')
    })

    it('takes userId from the existing pin, not the session', async () => {
      svc.getPin.mockResolvedValue(makePin({ userId: 'owner-9' }))

      await app.request(
        '/pins/pin-1/edit',
        formBody({ url: 'https://x.test/b', title: 'Updated' })
      )

      expect(svc.updatePin.mock.calls[0][1]).toMatchObject({
        userId: 'owner-9',
      })
    })
  })

  describe('POST /:id/toggle-read', () => {
    it('flips readLater and returns just the card', async () => {
      svc.getPin.mockResolvedValue(makePin({ readLater: false }))
      svc.updatePin.mockResolvedValue(makePin({ readLater: true }))

      const res = await app.request('/pins/pin-1/toggle-read', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      expect(svc.updatePin.mock.calls[0][1]).toMatchObject({ readLater: true })

      const html = await res.text()
      expect(html).toContain('Example Pin')
      expect(html).not.toContain('<html')
    })

    it('carries the referer query string into the re-rendered card', async () => {
      svc.getPin.mockResolvedValue(makePin())
      svc.updatePin.mockResolvedValue(makePin())

      const res = await app.request('/pins/pin-1/toggle-read', {
        method: 'POST',
        headers: { Referer: 'https://app.test/pins?tag=foo' },
      })

      expect(await res.text()).toContain('tag=foo')
    })

    it('tolerates a malformed referer', async () => {
      svc.getPin.mockResolvedValue(makePin())
      svc.updatePin.mockResolvedValue(makePin())

      const res = await app.request('/pins/pin-1/toggle-read', {
        method: 'POST',
        headers: { Referer: 'not-a-url' },
      })

      expect(res.status).toBe(200)
    })
  })

  describe('GET /:id/delete-confirm — inline confirmation', () => {
    it('returns the confirmation fragment', async () => {
      svc.getPin.mockResolvedValue(makePin())

      const res = await app.request('/pins/pin-1/delete-confirm')

      expect(res.status).toBe(200)
      expect(await res.text()).not.toContain('<html')
    })

    it('strips view from the delete action but keeps it on cancel', async () => {
      // `view` is pulled out of the query string and passed separately as
      // viewSize. The delete action therefore carries only the list filters,
      // while the cancel link re-appends view so the restored card renders at
      // the size the user was looking at.
      svc.getPin.mockResolvedValue(makePin())

      const html = await (
        await app.request('/pins/pin-1/delete-confirm?view=compact&tag=foo')
      ).text()

      expect(html).toContain('hx-delete="/pins/pin-1?tag=foo"')
      expect(html).toContain('/pins/pin-1/card?tag=foo&amp;view=compact')
    })

    it('404s for a missing pin', async () => {
      svc.getPin.mockRejectedValue(new PinNotFoundError('pin-1'))

      const res = await app.request('/pins/pin-1/delete-confirm')

      expect(res.status).toBe(404)
    })

    it('404s rather than 403 when the pin belongs to someone else', async () => {
      svc.getPin.mockRejectedValue(new UnauthorizedPinAccessError('pin-1'))

      const res = await app.request('/pins/pin-1/delete-confirm')

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /:id', () => {
    it('deletes the pin and returns the refreshed list partial', async () => {
      svc.deletePin.mockResolvedValue(true)

      const res = await app.request('/pins/pin-1', { method: 'DELETE' })

      expect(svc.deletePin).toHaveBeenCalledWith(expect.anything(), 'pin-1')
      expect(res.status).toBe(200)

      const html = await res.text()
      expect(html).toContain('Example Pin')
      expect(html).not.toContain('<html')
    })

    it('re-applies the current filters when rebuilding the list', async () => {
      svc.deletePin.mockResolvedValue(true)

      await app.request('/pins/pin-1?tag=foo&unread=true', {
        method: 'DELETE',
      })

      expect(svc.getUserPinsWithPagination.mock.calls[0][1]).toMatchObject({
        isPrivate: false,
        tag: 'foo',
        readLater: true,
      })
    })
  })

  describe('GET|POST /:id/delete — full-page delete', () => {
    it('renders the confirmation page', async () => {
      svc.getPin.mockResolvedValue(makePin())

      const res = await app.request('/pins/pin-1/delete')

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('Example Pin')
    })

    it('deletes and redirects to the list on POST', async () => {
      svc.getPin.mockResolvedValue(makePin())
      svc.deletePin.mockResolvedValue(true)

      const res = await app.request('/pins/pin-1/delete', { method: 'POST' })

      expect(svc.deletePin).toHaveBeenCalledWith(expect.anything(), 'pin-1')
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/pins')
    })
  })

  describe('GET /:id/card', () => {
    it('returns a bare card fragment', async () => {
      svc.getPin.mockResolvedValue(makePin())

      const res = await app.request('/pins/pin-1/card')
      const html = await res.text()

      expect(res.status).toBe(200)
      expect(html).toContain('Example Pin')
      expect(html).not.toContain('<html')
    })
  })

  describe('base URL wiring', () => {
    it('renders card links against /pins', async () => {
      svc.getPin.mockResolvedValue(makePin())

      const html = await (await app.request('/pins/pin-1/card')).text()

      expect(html).toContain('/pins/pin-1')
      expect(html).not.toContain('/private/pins/pin-1')
    })
  })
})
