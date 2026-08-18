/**
 * Characterization tests for the Pinboard export route.
 *
 * The route owns a wire format — the `hash` and `meta` md5 recipes, the
 * timestamp shape, the hardcoded `shared: 'no'`, and the exclusion of private
 * pins — and nothing verified any of it. These assert what it produces today,
 * so the format survives being moved out of the handler unchanged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { Pin } from '@pinsquirrel/domain'
import { PinboardService, md5, type PinService } from '@pinsquirrel/services'
import { testUser } from '../test-support/pin-routes'

const svc = {
  getUserPins: vi.fn(),
}

// A real PinboardService over a mocked PinService, so these stay end-to-end
// assertions about the bytes the route serves.
vi.mock('../lib/services', () => ({
  pinboardService: new PinboardService({
    getUserPins: (...a: unknown[]) => svc.getUserPins(...a) as unknown,
  } as unknown as PinService),
}))

vi.mock('../middleware/session', () => ({
  requireAuth: (): MiddlewareHandler => async (_c, next) => {
    await next()
  },
  getAuthUser: () => testUser,
}))

import { exportRoutes } from './export'

function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'pin-1',
    userId: testUser.id,
    url: 'https://example.test/a',
    title: 'Example',
    description: null,
    readLater: false,
    isPrivate: false,
    tagNames: [],
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

interface PinboardRow {
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

const app = new Hono()
app.route('/export', exportRoutes)

async function exportRows(): Promise<PinboardRow[]> {
  const res = await app.request('/export/pinboard.json')
  expect(res.status).toBe(200)
  return (await res.json()) as PinboardRow[]
}

describe('export routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('field mapping', () => {
    it('maps a pin onto the Pinboard shape', async () => {
      svc.getUserPins.mockResolvedValue([
        makePin({
          url: 'https://example.test/a',
          title: 'Example',
          description: 'Notes',
          tagNames: ['alpha', 'beta'],
          readLater: true,
        }),
      ])

      const [row] = await exportRows()

      expect(row.href).toBe('https://example.test/a')
      expect(row.description).toBe('Example')
      expect(row.extended).toBe('Notes')
      expect(row.tags).toBe('alpha beta')
      expect(row.toread).toBe('yes')
    })

    it('maps a null description to an empty string', async () => {
      svc.getUserPins.mockResolvedValue([makePin({ description: null })])

      const [row] = await exportRows()

      expect(row.extended).toBe('')
    })

    it('sets toread to no for a pin not marked read-later', async () => {
      svc.getUserPins.mockResolvedValue([makePin({ readLater: false })])

      const [row] = await exportRows()

      expect(row.toread).toBe('no')
    })

    // PinSquirrel has no per-pin shared flag; every exported row says 'no'
    // regardless of the pin, which is the inverse of what import ignores.
    it('always reports shared as no', async () => {
      svc.getUserPins.mockResolvedValue([makePin()])

      const [row] = await exportRows()

      expect(row.shared).toBe('no')
    })

    it('joins tags with spaces and yields an empty string for none', async () => {
      svc.getUserPins.mockResolvedValue([makePin({ tagNames: [] })])

      const [row] = await exportRows()

      expect(row.tags).toBe('')
    })
  })

  describe('wire format', () => {
    it('formats the timestamp without milliseconds', async () => {
      svc.getUserPins.mockResolvedValue([
        makePin({ createdAt: new Date('2024-03-05T06:07:08.000Z') }),
      ])

      const [row] = await exportRows()

      expect(row.time).toBe('2024-03-05T06:07:08Z')
    })

    it('hashes the URL for the hash field', async () => {
      svc.getUserPins.mockResolvedValue([
        makePin({ url: 'https://example.test/a' }),
      ])

      const [row] = await exportRows()

      expect(row.hash).toBe(md5('https://example.test/a'))
    })

    it('hashes url, title, description, tags and readLater for meta', async () => {
      svc.getUserPins.mockResolvedValue([
        makePin({
          url: 'https://example.test/a',
          title: 'Example',
          description: 'Notes',
          tagNames: ['alpha', 'beta'],
          readLater: true,
        }),
      ])

      const [row] = await exportRows()

      expect(row.meta).toBe(
        md5(
          [
            'https://example.test/a',
            'Example',
            'Notes',
            'alpha beta',
            'yes',
          ].join('\n')
        )
      )
    })

    it('treats a null description as an empty line in the meta hash', async () => {
      svc.getUserPins.mockResolvedValue([
        makePin({ url: 'u', title: 't', description: null, tagNames: [] }),
      ])

      const [row] = await exportRows()

      expect(row.meta).toBe(md5(['u', 't', '', '', 'no'].join('\n')))
    })
  })

  describe('private pins', () => {
    it('excludes private pins from the export', async () => {
      svc.getUserPins.mockResolvedValue([
        makePin({ id: 'public-1', url: 'https://example.test/public' }),
        makePin({
          id: 'private-1',
          url: 'https://example.test/private',
          isPrivate: true,
        }),
      ])

      const rows = await exportRows()

      expect(rows).toHaveLength(1)
      expect(rows[0].href).toBe('https://example.test/public')
    })

    it('returns an empty list when every pin is private', async () => {
      svc.getUserPins.mockResolvedValue([makePin({ isPrivate: true })])

      expect(await exportRows()).toEqual([])
    })
  })

  describe('response', () => {
    it('serves JSON as a dated attachment', async () => {
      svc.getUserPins.mockResolvedValue([makePin()])

      const res = await app.request('/export/pinboard.json')

      expect(res.headers.get('content-type')).toContain('application/json')
      expect(res.headers.get('content-disposition')).toMatch(
        /^attachment; filename="pinsquirrel_export_\d{4}-\d{2}-\d{2}\.json"$/
      )
    })
  })
})
