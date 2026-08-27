/**
 * Characterization tests for the tag merge routes.
 *
 * The merge form's three validation rules live in the handler rather than in
 * TagService, so nothing but the web form enforces them. These assert what the
 * route does today, before those rules move into the service.
 *
 * GET /tags (the cloud page) is not covered here — it is untouched by that
 * change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import type { TagRepository } from '@pinsquirrel/domain'
import { Pagination } from '@pinsquirrel/domain'
import { TagService } from '@pinsquirrel/services'
import { makeTag, testUser } from '../test-support/pin-routes'

const repo = {
  findById: vi.fn(),
  findByUserIdWithPinCount: vi.fn(),
  mergeTags: vi.fn(),
  deleteTagsWithNoPins: vi.fn(),
}

const pins = {
  getUserPinsWithPagination: vi.fn(),
}

const session = {
  getFlash: vi.fn(),
  setFlash: vi.fn(),
}

// A real TagService over a mocked repository. The merge rules moved into the
// service, so mocking the service wholesale would stop these tests exercising
// the very thing they exist to pin down.
vi.mock('../lib/services', () => ({
  pinService: {
    getUserPinsWithPagination: (...a: unknown[]) =>
      pins.getUserPinsWithPagination(...a) as unknown,
  },
  tagService: new TagService({
    findById: (...a: unknown[]) => repo.findById(...a) as unknown,
    findByUserIdWithPinCount: (...a: unknown[]) =>
      repo.findByUserIdWithPinCount(...a) as unknown,
    mergeTags: (...a: unknown[]) => repo.mergeTags(...a) as unknown,
    deleteTagsWithNoPins: (...a: unknown[]) =>
      repo.deleteTagsWithNoPins(...a) as unknown,
  } as unknown as TagRepository),
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

import { tagsRoutes } from './tags'

function tagWithCount(id: string, name: string, pinCount = 3) {
  return { ...makeTag({ id, name }), pinCount }
}

const app = new Hono()
app.route('/tags', tagsRoutes)

function postMerge(fields: Record<string, string>): Promise<Response> {
  return app.request('/tags/merge', {
    method: 'POST',
    body: new URLSearchParams(fields),
  }) as Promise<Response>
}

describe('tag merge routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.getFlash.mockReturnValue(null)
    repo.findByUserIdWithPinCount.mockResolvedValue([
      tagWithCount('tag-a', 'alpha'),
      tagWithCount('tag-b', 'beta'),
      tagWithCount('tag-c', 'gamma'),
    ])
    // Ownership lookups inside mergeTags.
    repo.findById.mockImplementation((id: string) =>
      Promise.resolve(makeTag({ id, name: id }))
    )
  })

  // A GET that writes: crawlers and link prefetch triggered the cleanup, and
  // it raced a concurrent createPin between the tag insert and the link
  // insert. Orphans are now collected where they are made, in PinService.
  describe('GET /tags', () => {
    beforeEach(() => {
      pins.getUserPinsWithPagination.mockResolvedValue({
        pins: [],
        pagination: Pagination.fromTotalCount(0),
      })
    })

    it('deletes nothing', async () => {
      const res = await app.request('/tags')

      expect(res.status).toBe(200)
      expect(repo.deleteTagsWithNoPins).not.toHaveBeenCalled()
    })

    // The header's desktop nav is the shared @pinsquirrel/ui NavLink, which
    // marks the section you are in; Pins, which you are not in, stays plain.
    it('marks the Tags link as the current page', async () => {
      const html = await (await app.request('/tags')).text()

      expect(html).toMatch(/href="\/tags"[^>]*aria-current="page"/)
      expect(html).not.toMatch(/href="\/pins"[^>]*aria-current="page"/)
    })
  })

  describe('GET /tags/merge', () => {
    it('lists only tags that have pins', async () => {
      repo.findByUserIdWithPinCount.mockResolvedValue([
        tagWithCount('tag-a', 'alpha', 3),
        tagWithCount('tag-empty', 'unused', 0),
      ])

      const res = await app.request('/tags/merge')
      const html = await res.text()

      expect(res.status).toBe(200)
      expect(html).toContain('alpha')
      expect(html).not.toContain('unused')
    })
  })

  describe('POST /tags/merge validation', () => {
    it('rejects a merge with no source tags', async () => {
      const res = await postMerge({ destinationTagId: 'tag-c' })

      expect(await res.text()).toContain(
        'Please select at least one source tag.'
      )
      expect(repo.mergeTags).not.toHaveBeenCalled()
    })

    it('rejects a merge with no destination tag', async () => {
      const res = await postMerge({ sourceTagIds: 'tag-a,tag-b' })

      expect(await res.text()).toContain('Please select a destination tag.')
      expect(repo.mergeTags).not.toHaveBeenCalled()
    })

    // Merging a tag into itself would delete it and reassign its pins to
    // nothing, so the destination must be distinct from every source.
    it('rejects a destination that is also a source', async () => {
      const res = await postMerge({
        sourceTagIds: 'tag-a,tag-c',
        destinationTagId: 'tag-c',
      })

      expect(await res.text()).toContain(
        'Destination tag cannot be one of the source tags.'
      )
      expect(repo.mergeTags).not.toHaveBeenCalled()
    })
  })

  describe('POST /tags/merge success', () => {
    it('merges the selected sources into the destination', async () => {
      repo.mergeTags.mockResolvedValue(undefined)

      const res = await postMerge({
        sourceTagIds: 'tag-a,tag-b',
        destinationTagId: 'tag-c',
      })

      expect(repo.mergeTags).toHaveBeenCalledWith(
        testUser.id,
        ['tag-a', 'tag-b'],
        'tag-c'
      )
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/tags')
      expect(session.setFlash).toHaveBeenCalledWith(
        'success',
        'Tags merged successfully!'
      )
    })

    // The hidden input carries the selection as one comma-separated value.
    it('splits the comma-separated source list', async () => {
      repo.mergeTags.mockResolvedValue(undefined)

      await postMerge({
        sourceTagIds: 'tag-a,tag-b',
        destinationTagId: 'tag-c',
      })

      expect(repo.mergeTags.mock.calls[0][1]).toEqual(['tag-a', 'tag-b'])
    })

    it('accepts a single source tag', async () => {
      repo.mergeTags.mockResolvedValue(undefined)

      await postMerge({ sourceTagIds: 'tag-a', destinationTagId: 'tag-c' })

      expect(repo.mergeTags.mock.calls[0][1]).toEqual(['tag-a'])
    })
  })

  describe('POST /tags/merge failure', () => {
    it('re-renders with an error when the merge throws', async () => {
      repo.mergeTags.mockRejectedValue(new Error('db down'))

      const res = await postMerge({
        sourceTagIds: 'tag-a',
        destinationTagId: 'tag-c',
      })

      expect(res.status).toBe(500)
      expect(await res.text()).toContain(
        'Failed to merge tags. Please try again.'
      )
    })
  })
})
