import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TagService } from './tag.js'
import type {
  TagRepository,
  Tag,
  TagWithCount,
  User,
} from '@pinsquirrel/domain'
import {
  AccessControl,
  Role,
  TagNotFoundError,
  UnauthorizedTagAccessError,
  UserStatus,
  ValidationError,
} from '@pinsquirrel/domain'

const owner: User = {
  id: 'owner-id',
  username: 'owner',
  passwordHash: 'x',
  emailHash: null,
  emailEncrypted: null,
  roles: [Role.User],
  status: UserStatus.Active,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const otherUser: User = {
  ...owner,
  id: 'other-id',
  username: 'other',
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1',
    userId: 'owner-id',
    name: 'foo',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

const tag = makeTag()

/** A tag belonging to somebody else — the case every ownership check exists for. */
const foreignTag = makeTag({ id: 'tag-x', userId: 'other-id' })

let service: TagService
let mockRepo: TagRepository

beforeEach(() => {
  mockRepo = {
    findById: vi.fn(),
    findByUserId: vi.fn(),
    findByUserIdAndName: vi.fn(),
    fetchOrCreateByNames: vi.fn(),
    findByUserIdWithPinCount: vi.fn(),
    mergeTags: vi.fn(),
    deleteTagsWithNoPins: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as TagRepository
  service = new TagService(mockRepo)
})

describe('TagService.getUserTags', () => {
  it('returns the caller’s own tags', async () => {
    vi.mocked(mockRepo.findByUserId).mockResolvedValue([tag])

    await expect(
      service.getUserTags(new AccessControl(owner), 'owner-id')
    ).resolves.toEqual([tag])
    expect(mockRepo.findByUserId).toHaveBeenCalledWith('owner-id')
  })

  it('hands back nothing when asked for someone else’s tags', async () => {
    // Tags are private to their owner, so asking for another user's id can
    // never produce a readable tag — the repository is never asked.
    vi.mocked(mockRepo.findByUserId).mockResolvedValue([tag, foreignTag])

    await expect(
      service.getUserTags(new AccessControl(otherUser), 'owner-id')
    ).resolves.toEqual([])
    expect(mockRepo.findByUserId).not.toHaveBeenCalled()
  })

  it('returns nothing for an unauthenticated caller without querying', async () => {
    vi.mocked(mockRepo.findByUserId).mockResolvedValue([tag, foreignTag])

    await expect(
      service.getUserTags(new AccessControl(null), 'owner-id')
    ).resolves.toEqual([])
    expect(mockRepo.findByUserId).not.toHaveBeenCalled()
  })
})

describe('TagService.getUserTagById', () => {
  it('returns the tag when owned by the caller', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(tag)
    const ac = new AccessControl(owner)
    await expect(service.getUserTagById(ac, 'tag-1')).resolves.toEqual(tag)
  })

  it('throws TagNotFoundError when the tag does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null)
    const ac = new AccessControl(owner)
    await expect(service.getUserTagById(ac, 'tag-1')).rejects.toBeInstanceOf(
      TagNotFoundError
    )
  })

  it('throws TagNotFoundError when the tag belongs to a different user', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(tag)
    const ac = new AccessControl(otherUser)
    await expect(service.getUserTagById(ac, 'tag-1')).rejects.toBeInstanceOf(
      TagNotFoundError
    )
  })

  it('throws TagNotFoundError for unauthenticated callers', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(tag)
    const ac = new AccessControl(null)
    await expect(service.getUserTagById(ac, 'tag-1')).rejects.toBeInstanceOf(
      TagNotFoundError
    )
  })

  // The constructor templates the id into the message. Passing it a finished
  // sentence produced `Tag with ID "Tag with ID "tag-1" not found" not found`.
  it('names the tag once in the message', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null)
    const ac = new AccessControl(owner)

    await expect(service.getUserTagById(ac, 'tag-1')).rejects.toThrow(
      new TagNotFoundError('tag-1')
    )
  })
})

describe('TagService.getUserTagsWithCount', () => {
  const counted: TagWithCount = { ...tag, pinCount: 3 }
  const foreignCounted: TagWithCount = { ...foreignTag, pinCount: 9 }

  it('returns counts for the caller’s own tags', async () => {
    vi.mocked(mockRepo.findByUserIdWithPinCount).mockResolvedValue([counted])

    await expect(
      service.getUserTagsWithCount(new AccessControl(owner), 'owner-id')
    ).resolves.toEqual([counted])
  })

  it('passes the pin filter through to the repository', async () => {
    vi.mocked(mockRepo.findByUserIdWithPinCount).mockResolvedValue([])

    await service.getUserTagsWithCount(new AccessControl(owner), 'owner-id', {
      isPrivate: true,
    })

    expect(mockRepo.findByUserIdWithPinCount).toHaveBeenCalledWith('owner-id', {
      isPrivate: true,
    })
  })

  it('hands back nothing when asked for someone else’s tags', async () => {
    vi.mocked(mockRepo.findByUserIdWithPinCount).mockResolvedValue([
      counted,
      foreignCounted,
    ])

    await expect(
      service.getUserTagsWithCount(new AccessControl(otherUser), 'owner-id')
    ).resolves.toEqual([])
    expect(mockRepo.findByUserIdWithPinCount).not.toHaveBeenCalled()
  })

  it('returns nothing for an unauthenticated caller without querying', async () => {
    vi.mocked(mockRepo.findByUserIdWithPinCount).mockResolvedValue([counted])

    await expect(
      service.getUserTagsWithCount(new AccessControl(null), 'owner-id')
    ).resolves.toEqual([])
    expect(mockRepo.findByUserIdWithPinCount).not.toHaveBeenCalled()
  })
})

describe('TagService.createTag', () => {
  it('creates a tag for the caller', async () => {
    vi.mocked(mockRepo.create).mockResolvedValue(tag)

    await expect(
      service.createTag(new AccessControl(owner), {
        userId: 'owner-id',
        name: 'foo',
      })
    ).resolves.toEqual(tag)
    expect(mockRepo.create).toHaveBeenCalledWith({
      userId: 'owner-id',
      name: 'foo',
    })
  })

  it('refuses to create a tag owned by someone else', async () => {
    await expect(
      service.createTag(new AccessControl(owner), {
        userId: 'other-id',
        name: 'foo',
      })
    ).rejects.toBeInstanceOf(UnauthorizedTagAccessError)
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it('refuses an unauthenticated caller', async () => {
    await expect(
      service.createTag(new AccessControl(null), {
        userId: 'owner-id',
        name: 'foo',
      })
    ).rejects.toBeInstanceOf(UnauthorizedTagAccessError)
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it('normalises the name to trimmed lowercase before storing', async () => {
    vi.mocked(mockRepo.create).mockResolvedValue(tag)

    await service.createTag(new AccessControl(owner), {
      userId: 'owner-id',
      name: '  FooBar  ',
    })

    expect(mockRepo.create).toHaveBeenCalledWith({
      userId: 'owner-id',
      name: 'foobar',
    })
  })

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['over 50 characters', 'x'.repeat(51)],
    // Written as an escape on purpose: a literal NUL in the source is
    // invisible, reads as a space, and does not survive tooling that
    // rewrites the file.
    ['containing a control character', 'foo\x00bar'],
  ])('rejects a name that is %s', async (_label, name) => {
    await expect(
      service.createTag(new AccessControl(owner), { userId: 'owner-id', name })
    ).rejects.toBeInstanceOf(ValidationError)
    expect(mockRepo.create).not.toHaveBeenCalled()
  })

  it('checks ownership before validating the name', async () => {
    // Order matters: an unauthorized caller should be told they are
    // unauthorized, not handed a validation error that confirms nothing.
    await expect(
      service.createTag(new AccessControl(owner), {
        userId: 'other-id',
        name: '',
      })
    ).rejects.toBeInstanceOf(UnauthorizedTagAccessError)
  })
})

describe('TagService.mergeTags', () => {
  const targetTag = makeTag({ id: 'target' })
  const sourceA = makeTag({ id: 'src-a' })
  const sourceB = makeTag({ id: 'src-b' })

  it('merges when the caller owns the target and every source', async () => {
    vi.mocked(mockRepo.findById).mockImplementation((id: string) =>
      Promise.resolve(
        { target: targetTag, 'src-a': sourceA, 'src-b': sourceB }[id] ?? null
      )
    )

    await service.mergeTags(
      new AccessControl(owner),
      ['src-a', 'src-b'],
      'target'
    )

    expect(mockRepo.mergeTags).toHaveBeenCalledWith(
      'owner-id',
      ['src-a', 'src-b'],
      'target'
    )
  })

  it('refuses an unauthenticated caller', async () => {
    await expect(
      service.mergeTags(new AccessControl(null), ['src-a'], 'target')
    ).rejects.toBeInstanceOf(UnauthorizedTagAccessError)
    expect(mockRepo.findById).not.toHaveBeenCalled()
    expect(mockRepo.mergeTags).not.toHaveBeenCalled()
  })

  it('throws when the target tag does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null)

    await expect(
      service.mergeTags(new AccessControl(owner), ['src-a'], 'target')
    ).rejects.toBeInstanceOf(TagNotFoundError)
    expect(mockRepo.mergeTags).not.toHaveBeenCalled()
  })

  it('says which tag is missing, and says it once', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null)

    await expect(
      service.mergeTags(new AccessControl(owner), ['src-a'], 'target')
    ).rejects.toThrow(
      new TagNotFoundError('target', 'Target tag with ID "target" not found')
    )
  })

  it('says which source tag is missing', async () => {
    vi.mocked(mockRepo.findById).mockImplementation((id: string) =>
      Promise.resolve(id === 'target' ? targetTag : null)
    )

    await expect(
      service.mergeTags(new AccessControl(owner), ['missing'], 'target')
    ).rejects.toThrow(
      new TagNotFoundError('missing', 'Source tag with ID "missing" not found')
    )
  })

  it('refuses to merge into a target owned by someone else', async () => {
    // The sources are deliberately owned by the caller. If they were not, the
    // source-ownership loop would throw too and this test would pass even with
    // the target check deleted — which is exactly what mutation testing caught.
    vi.mocked(mockRepo.findById).mockImplementation((id: string) =>
      Promise.resolve({ 'tag-x': foreignTag, 'src-a': sourceA }[id] ?? null)
    )

    await expect(
      service.mergeTags(new AccessControl(owner), ['src-a'], 'tag-x')
    ).rejects.toBeInstanceOf(UnauthorizedTagAccessError)
    expect(mockRepo.mergeTags).not.toHaveBeenCalled()
  })

  it('throws when any source tag does not exist', async () => {
    vi.mocked(mockRepo.findById).mockImplementation((id: string) =>
      Promise.resolve(id === 'target' ? targetTag : null)
    )

    await expect(
      service.mergeTags(new AccessControl(owner), ['missing'], 'target')
    ).rejects.toBeInstanceOf(TagNotFoundError)
    expect(mockRepo.mergeTags).not.toHaveBeenCalled()
  })

  it('refuses when ANY source belongs to someone else, not just the first', async () => {
    // The loop must check every source. A check that stopped after the first
    // would let a foreign tag ride along in a multi-tag merge — the exact
    // hole this ownership loop exists to close.
    vi.mocked(mockRepo.findById).mockImplementation((id: string) =>
      Promise.resolve(
        { target: targetTag, 'src-a': sourceA, 'tag-x': foreignTag }[id] ?? null
      )
    )

    await expect(
      service.mergeTags(new AccessControl(owner), ['src-a', 'tag-x'], 'target')
    ).rejects.toBeInstanceOf(UnauthorizedTagAccessError)
    expect(mockRepo.mergeTags).not.toHaveBeenCalled()
  })

  it('validates every source before performing the merge', async () => {
    vi.mocked(mockRepo.findById).mockImplementation((id: string) =>
      Promise.resolve(
        { target: targetTag, 'src-a': sourceA, 'src-b': sourceB }[id] ?? null
      )
    )

    await service.mergeTags(
      new AccessControl(owner),
      ['src-a', 'src-b'],
      'target'
    )

    // Target plus both sources — nothing merged on a partial check.
    expect(mockRepo.findById).toHaveBeenCalledTimes(3)
  })

  it('merges under the caller’s id, not an id supplied by the request', async () => {
    vi.mocked(mockRepo.findById).mockImplementation((id: string) =>
      Promise.resolve({ target: targetTag, 'src-a': sourceA }[id] ?? null)
    )

    await service.mergeTags(new AccessControl(owner), ['src-a'], 'target')

    expect(mockRepo.mergeTags).toHaveBeenCalledWith(
      'owner-id',
      ['src-a'],
      'target'
    )
  })

  describe('input validation', () => {
    // These three rules were enforced by the web form's handler, so nothing
    // else calling mergeTags — a CLI, a future API — was covered by them.
    it('rejects an empty source list', async () => {
      await expect(
        service.mergeTags(new AccessControl(owner), [], 'target')
      ).rejects.toBeInstanceOf(ValidationError)
      expect(mockRepo.mergeTags).not.toHaveBeenCalled()
    })

    it('rejects a blank destination', async () => {
      await expect(
        service.mergeTags(new AccessControl(owner), ['src-a'], '')
      ).rejects.toBeInstanceOf(ValidationError)
      expect(mockRepo.mergeTags).not.toHaveBeenCalled()
    })

    // Merging a tag into itself would delete it and strand its pins.
    it('rejects a destination that is also a source', async () => {
      await expect(
        service.mergeTags(
          new AccessControl(owner),
          ['src-a', 'target'],
          'target'
        )
      ).rejects.toBeInstanceOf(ValidationError)
      expect(mockRepo.mergeTags).not.toHaveBeenCalled()
    })

    it('validates before touching the repository at all', async () => {
      await expect(
        service.mergeTags(new AccessControl(owner), [], 'target')
      ).rejects.toBeInstanceOf(ValidationError)
      expect(mockRepo.findById).not.toHaveBeenCalled()
    })

    it('reports the offending field', async () => {
      await expect(
        service.mergeTags(new AccessControl(owner), [], 'target')
      ).rejects.toMatchObject({
        fields: { sourceTagIds: ['Please select at least one source tag.'] },
      })
    })
  })
})

describe('TagService.deleteTag', () => {
  it('deletes a tag the caller owns', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(tag)
    vi.mocked(mockRepo.delete).mockResolvedValue(true)

    await service.deleteTag(new AccessControl(owner), 'tag-1')

    expect(mockRepo.delete).toHaveBeenCalledWith('tag-1')
  })

  it('throws when the tag does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null)

    await expect(
      service.deleteTag(new AccessControl(owner), 'tag-1')
    ).rejects.toBeInstanceOf(TagNotFoundError)
    expect(mockRepo.delete).not.toHaveBeenCalled()
  })

  it('names the tag once when it does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null)

    await expect(
      service.deleteTag(new AccessControl(owner), 'tag-1')
    ).rejects.toThrow(new TagNotFoundError('tag-1'))
  })

  it('refuses to delete a tag owned by someone else', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(foreignTag)

    await expect(
      service.deleteTag(new AccessControl(owner), 'tag-x')
    ).rejects.toBeInstanceOf(UnauthorizedTagAccessError)
    expect(mockRepo.delete).not.toHaveBeenCalled()
  })

  it('refuses an unauthenticated caller', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(tag)

    await expect(
      service.deleteTag(new AccessControl(null), 'tag-1')
    ).rejects.toBeInstanceOf(UnauthorizedTagAccessError)
    expect(mockRepo.delete).not.toHaveBeenCalled()
  })

  it('throws when the repository reports nothing was deleted', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(tag)
    vi.mocked(mockRepo.delete).mockResolvedValue(false)

    await expect(
      service.deleteTag(new AccessControl(owner), 'tag-1')
    ).rejects.toBeInstanceOf(TagNotFoundError)
  })
})

describe('TagService.deleteTagsWithNoPins', () => {
  it('cleans up the caller’s own orphan tags', async () => {
    await service.deleteTagsWithNoPins(new AccessControl(owner), 'owner-id')

    expect(mockRepo.deleteTagsWithNoPins).toHaveBeenCalledWith('owner-id')
  })

  it('refuses to clean up another user’s tags', async () => {
    await expect(
      service.deleteTagsWithNoPins(new AccessControl(owner), 'other-id')
    ).rejects.toBeInstanceOf(UnauthorizedTagAccessError)
    expect(mockRepo.deleteTagsWithNoPins).not.toHaveBeenCalled()
  })

  it('refuses an unauthenticated caller', async () => {
    await expect(
      service.deleteTagsWithNoPins(new AccessControl(null), 'owner-id')
    ).rejects.toBeInstanceOf(UnauthorizedTagAccessError)
    expect(mockRepo.deleteTagsWithNoPins).not.toHaveBeenCalled()
  })
})
