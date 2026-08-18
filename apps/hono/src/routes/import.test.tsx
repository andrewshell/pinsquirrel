/**
 * Characterization tests for the Pinboard import route.
 *
 * The import is a long single handler with six validation gates and a
 * per-pin loop that swallows failures to keep going. Nothing verified any of
 * it. These assert what it does today — including a couple of choices that look
 * like oversights and are flagged inline rather than changed here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { DuplicatePinError } from '@pinsquirrel/domain'
import { testUser } from '../test-support/pin-routes'

const svc = {
  createPin: vi.fn(),
  updateCreatedAt: vi.fn(),
}

const session = {
  getFlash: vi.fn(),
  setFlash: vi.fn(),
}

vi.mock('../lib/services', () => ({
  pinService: {
    createPin: (...a: unknown[]) => svc.createPin(...a) as unknown,
  },
  pinRepository: {
    updateCreatedAt: (...a: unknown[]) => svc.updateCreatedAt(...a) as unknown,
  },
}))

vi.mock('../middleware/session', () => ({
  requireAuth: (): MiddlewareHandler => async (_c, next) => {
    await next()
  },
  getAuthUser: () => testUser,
  getSessionManager: () => ({
    getFlash: (...a: unknown[]) => session.getFlash(...a) as unknown,
    setFlash: (...a: unknown[]) => session.setFlash(...a) as unknown,
  }),
}))

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
  safeError: (e: unknown) => ({ message: String(e) }),
}))

import { importRoutes } from './import'

interface PinboardPin {
  href: string
  description: string
  extended: string
  meta: string
  hash: string
  time: string
  shared: string
  toread: string
  tags: string
}

function pinboardPin(overrides: Partial<PinboardPin> = {}): PinboardPin {
  return {
    href: 'https://example.test/a',
    description: 'Example',
    extended: '',
    meta: '',
    hash: '',
    time: '2024-01-01T00:00:00Z',
    shared: 'yes',
    toread: 'no',
    tags: '',
    ...overrides,
  }
}

/** Build a multipart upload the way the browser form does. */
function upload(content: string, name = 'export.json'): RequestInit {
  const body = new FormData()
  body.append('file', new File([content], name, { type: 'application/json' }))
  return { method: 'POST', body }
}

function uploadPins(pins: Partial<PinboardPin>[]): RequestInit {
  return upload(JSON.stringify(pins.map(pinboardPin)))
}

describe('import routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    session.getFlash.mockReturnValue(null)
    svc.createPin.mockResolvedValue(undefined)
    app = new Hono()
    app.route('/import', importRoutes)
  })

  describe('GET /import', () => {
    it('renders the upload form', async () => {
      const res = await app.request('/import')

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('form')
    })
  })

  describe('validation gates', () => {
    // Every gate re-renders the page with an inline error and a 200 — not a
    // 400. Pinned as-is: the form is a full page, and the status is what the
    // browser shows, but it does mean a failed import is indistinguishable
    // from a successful page load to anything but a human.
    it('rejects a request with no file', async () => {
      const res = await app.request('/import', {
        method: 'POST',
        body: new FormData(),
      })

      expect(res.status).toBe(200)
      expect(await res.text()).toContain('Please select a file to import')
      expect(svc.createPin).not.toHaveBeenCalled()
    })

    it('rejects a non-.json filename', async () => {
      const res = await app.request(
        '/import',
        upload(JSON.stringify([pinboardPin()]), 'export.txt')
      )

      expect(await res.text()).toContain('Please upload a JSON file')
      expect(svc.createPin).not.toHaveBeenCalled()
    })

    it('rejects a file over the 10MB limit', async () => {
      const oversized = 'x'.repeat(10 * 1024 * 1024 + 1)

      const res = await app.request('/import', upload(oversized))

      expect(await res.text()).toContain('File size exceeds 10MB limit')
      expect(svc.createPin).not.toHaveBeenCalled()
    })

    it('rejects malformed JSON', async () => {
      const res = await app.request('/import', upload('{not json'))

      expect(await res.text()).toContain('Invalid JSON file format')
      expect(svc.createPin).not.toHaveBeenCalled()
    })

    it.each([
      ['an empty array', '[]'],
      ['a JSON object', '{"href":"x"}'],
    ])('rejects %s as not a Pinboard export', async (_label, content) => {
      const res = await app.request('/import', upload(content))

      expect(await res.text()).toContain(
        'File does not appear to be a valid Pinboard export'
      )
      expect(svc.createPin).not.toHaveBeenCalled()
    })

    it.each([['href'], ['description'], ['time']])(
      'rejects an export whose first entry is missing %s',
      async (field) => {
        const res = await app.request(
          '/import',
          upload(JSON.stringify([{ ...pinboardPin(), [field]: '' }]))
        )

        expect(await res.text()).toContain(
          'File structure does not match Pinboard export format'
        )
        expect(svc.createPin).not.toHaveBeenCalled()
      }
    )

    it('only inspects the first entry, so later malformed rows still import', async () => {
      // The shape check is a sample of one. A later row missing href reaches
      // createPin and fails there, handled by the per-pin catch below.
      await app.request(
        '/import',
        upload(JSON.stringify([pinboardPin(), { ...pinboardPin(), href: '' }]))
      )

      expect(svc.createPin).toHaveBeenCalledTimes(2)
    })
  })

  describe('field mapping', () => {
    it('maps a pin onto createPin', async () => {
      await app.request(
        '/import',
        uploadPins([
          {
            href: 'https://example.test/a',
            description: 'Title',
            extended: 'Notes',
            time: '2024-03-04T05:06:07Z',
          },
        ])
      )

      expect(svc.createPin).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: testUser.id,
          url: 'https://example.test/a',
          title: 'Title',
          description: 'Notes',
          createdAt: new Date('2024-03-04T05:06:07Z'),
          updatedAt: new Date('2024-03-04T05:06:07Z'),
        })
      )
    })

    it('splits tags on spaces, not commas', async () => {
      // Pinboard's export uses space-separated tags, so a comma stays part of
      // the tag text rather than acting as a separator.
      await app.request('/import', uploadPins([{ tags: 'foo bar  baz' }]))

      expect(svc.createPin.mock.calls[0][1]).toMatchObject({
        tagNames: ['foo', 'bar', 'baz'],
      })
    })

    it('yields no tags for an empty tag string', async () => {
      await app.request('/import', uploadPins([{ tags: '' }]))

      expect(svc.createPin.mock.calls[0][1]).toMatchObject({ tagNames: [] })
    })

    it('falls back to the URL when the title is blank', async () => {
      await app.request(
        '/import',
        uploadPins([{ href: 'https://example.test/x', description: '   ' }])
      )

      expect(svc.createPin.mock.calls[0][1]).toMatchObject({
        title: 'https://example.test/x',
      })
    })

    it('truncates a long title to 200 characters', async () => {
      await app.request(
        '/import',
        uploadPins([{ description: 'x'.repeat(250) }])
      )

      expect(svc.createPin.mock.calls[0][1].title).toHaveLength(200)
    })

    it('truncates a long description to 1000 characters', async () => {
      await app.request('/import', uploadPins([{ extended: 'y'.repeat(1500) }]))

      expect(svc.createPin.mock.calls[0][1].description).toHaveLength(1000)
    })

    it('maps an empty extended field to null', async () => {
      await app.request('/import', uploadPins([{ extended: '' }]))

      expect(svc.createPin.mock.calls[0][1]).toMatchObject({
        description: null,
      })
    })

    it('sets readLater only for toread="yes"', async () => {
      await app.request(
        '/import',
        uploadPins([{ toread: 'yes' }, { toread: 'no' }, { toread: '' }])
      )

      expect(svc.createPin.mock.calls[0][1].readLater).toBe(true)
      expect(svc.createPin.mock.calls[1][1].readLater).toBe(false)
      expect(svc.createPin.mock.calls[2][1].readLater).toBe(false)
    })

    it('lands every pin in the main list, whatever Pinboard’s shared flag says', async () => {
      // Pinboard's `shared` controls whether a bookmark is visible on the
      // public web; PinSquirrel publishes nothing, so it has no counterpart
      // here and is dropped. `isPrivate` is a different axis — an extra tier
      // *within* an already-login-only account, hidden from the main list and
      // gated behind a password re-entry. Mapping `shared: "no"` onto it would
      // put those pins behind the unlock gate, which is not what the flag meant.
      await app.request(
        '/import',
        uploadPins([{ shared: 'no' }, { shared: 'yes' }])
      )

      expect(svc.createPin.mock.calls[0][1]).toMatchObject({ isPrivate: false })
      expect(svc.createPin.mock.calls[1][1]).toMatchObject({ isPrivate: false })
    })
  })

  describe('duplicates', () => {
    it('skips a duplicate and keeps importing', async () => {
      svc.createPin
        .mockRejectedValueOnce(new DuplicatePinError('https://example.test/a'))
        .mockResolvedValueOnce(undefined)

      const res = await app.request(
        '/import',
        uploadPins([
          { href: 'https://example.test/a' },
          { href: 'https://example.test/b' },
        ])
      )

      expect(res.status).toBe(302)
      expect(session.setFlash).toHaveBeenCalledWith(
        'success',
        expect.stringContaining('skipped 1 duplicate)')
      )
    })

    it('back-dates an existing pin when the Pinboard copy is older', async () => {
      svc.createPin.mockRejectedValue(
        new DuplicatePinError('https://example.test/a', {
          id: 'pin-9',
          createdAt: new Date('2024-06-01'),
        })
      )

      await app.request(
        '/import',
        uploadPins([{ time: '2020-01-01T00:00:00Z' }])
      )

      expect(svc.updateCreatedAt).toHaveBeenCalledWith(
        'pin-9',
        new Date('2020-01-01T00:00:00Z')
      )
    })

    it('leaves the existing pin alone when the Pinboard copy is newer', async () => {
      svc.createPin.mockRejectedValue(
        new DuplicatePinError('https://example.test/a', {
          id: 'pin-9',
          createdAt: new Date('2020-01-01'),
        })
      )

      await app.request(
        '/import',
        uploadPins([{ time: '2024-06-01T00:00:00Z' }])
      )

      expect(svc.updateCreatedAt).not.toHaveBeenCalled()
    })

    it('still counts the pin as skipped when back-dating fails', async () => {
      svc.createPin.mockRejectedValue(
        new DuplicatePinError('https://example.test/a', {
          id: 'pin-9',
          createdAt: new Date('2024-06-01'),
        })
      )
      svc.updateCreatedAt.mockRejectedValue(new Error('db down'))

      const res = await app.request(
        '/import',
        uploadPins([{ time: '2020-01-01T00:00:00Z' }])
      )

      expect(res.status).toBe(302)
      expect(session.setFlash).toHaveBeenCalledWith(
        'success',
        expect.stringContaining('skipped 1 duplicate)')
      )
    })
  })

  describe('per-pin failures', () => {
    it('skips a failing pin and imports the rest', async () => {
      svc.createPin
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(undefined)

      const res = await app.request(
        '/import',
        uploadPins([{ href: 'https://a.test' }, { href: 'https://b.test' }])
      )

      expect(res.status).toBe(302)
      // The failed pin counts as neither imported nor skipped — it vanishes
      // from the summary entirely, so 2 uploaded reports as 1 imported.
      expect(session.setFlash).toHaveBeenCalledWith(
        'success',
        expect.stringContaining('imported 1 pins')
      )
    })
  })

  describe('summary message', () => {
    it('reports imported count and unique tag count', async () => {
      await app.request(
        '/import',
        uploadPins([{ tags: 'a b' }, { tags: 'b c' }])
      )

      expect(session.setFlash).toHaveBeenCalledWith(
        'success',
        'Successfully imported 2 pins with 3 unique tags'
      )
    })

    it('omits the skipped clause when nothing was skipped', async () => {
      await app.request('/import', uploadPins([{}]))

      const message = session.setFlash.mock.calls[0][1] as string
      expect(message).not.toContain('skipped')
    })

    it('pluralises the duplicate count', async () => {
      svc.createPin.mockRejectedValue(
        new DuplicatePinError('https://example.test/a')
      )

      await app.request('/import', uploadPins([{}, {}]))

      expect(session.setFlash).toHaveBeenCalledWith(
        'success',
        expect.stringContaining('skipped 2 duplicates)')
      )
    })

    it('redirects to /pins on success', async () => {
      const res = await app.request('/import', uploadPins([{}]))

      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/pins')
    })
  })
})
