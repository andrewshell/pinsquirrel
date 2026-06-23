import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TagService } from './tag.js'
import type { TagRepository, Tag, User } from '@pinsquirrel/domain'
import {
  AccessControl,
  Role,
  TagNotFoundError,
  UserStatus,
} from '@pinsquirrel/domain'

describe('TagService.getUserTagById', () => {
  let service: TagService
  let mockRepo: TagRepository

  const owner: User = {
    id: 'owner-id',
    username: 'owner',
    passwordHash: 'x',
    emailHash: null,
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

  const tag: Tag = {
    id: 'tag-1',
    userId: 'owner-id',
    name: 'foo',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

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
})
