import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { PinService } from './pin.js'
import type {
  PinRepository,
  TagRepository,
  Pin,
  Tag,
  User,
  AccessControl,
} from '@pinsquirrel/domain'
import {
  PinNotFoundError,
  UnauthorizedPinAccessError,
  DuplicatePinError,
  TagNotFoundError,
  UnauthorizedTagAccessError,
  DuplicateTagError,
} from '@pinsquirrel/domain'

describe('PinService', () => {
  let pinService: PinService
  let mockPinRepository: {
    findById: Mock
    create: Mock
    update: Mock
    delete: Mock
    findByUserId: Mock
    findByUserIdAndUrl: Mock
    countByUserId: Mock
  }
  let mockTagRepository: {
    findById: Mock
    findAll: Mock
    create: Mock
    update: Mock
    delete: Mock
    findByUserId: Mock
    findByUserIdAndName: Mock
    fetchOrCreateByNames: Mock
    findByUserIdWithPinCount: Mock
    mergeTags: Mock
    deleteTagsWithNoPins: Mock
  }

  const mockTag: Tag = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: 'user-123',
    name: 'javascript',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  const mockPin: Pin = {
    id: 'pin-123',
    userId: 'user-123',
    url: 'https://example.com',
    title: 'Example',
    description: 'Description',
    readLater: false,
    tagNames: ['javascript'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    passwordHash: 'hash',
    emailHash: 'emailhash',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  // Helper to create mock AccessControl
  const createMockAccessControl = (
    user: User | null = mockUser
  ): AccessControl =>
    ({
      user,
      canCreate: () => !!user,
      canRead: ag => !!user && user.id === ag.userId,
      canUpdate: ag => !!user && user.id === ag.userId,
      canDelete: ag => !!user && user.id === ag.userId,
    }) as AccessControl

  beforeEach(() => {
    mockPinRepository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByUserId: vi.fn(),
      findByUserIdAndUrl: vi.fn(),
      countByUserId: vi.fn(),
    }

    mockTagRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByUserId: vi.fn(),
      findByUserIdAndName: vi.fn(),
      fetchOrCreateByNames: vi.fn(),
      findByUserIdWithPinCount: vi.fn(),
      mergeTags: vi.fn(),
      deleteTagsWithNoPins: vi.fn(),
    }

    pinService = new PinService(
      mockPinRepository as unknown as PinRepository,
      mockTagRepository as unknown as TagRepository
    )
  })

  describe('createPin', () => {
    it('should create a pin with valid data', async () => {
      mockPinRepository.findByUserIdAndUrl.mockResolvedValue(null)
      mockPinRepository.create.mockResolvedValue(mockPin)

      const result = await pinService.createPin(
        createMockAccessControl(mockUser),
        {
          url: 'https://example.com',
          title: 'Example',
          description: 'Description',
          readLater: false,
          tagNames: ['javascript'],
        }
      )

      expect(result).toEqual(mockPin)
      expect(mockPinRepository.findByUserIdAndUrl).toHaveBeenCalledWith(
        'user-123',
        'https://example.com'
      )
      expect(mockPinRepository.create).toHaveBeenCalledWith({
        userId: 'user-123',
        url: 'https://example.com',
        title: 'Example',
        description: 'Description',
        readLater: false,
        tagNames: ['javascript'],
      })
    })

    it('should throw DuplicatePinError if URL already exists for user', async () => {
      mockPinRepository.findByUserIdAndUrl.mockResolvedValue(mockPin)

      await expect(
        pinService.createPin(createMockAccessControl(mockUser), {
          url: 'https://example.com',
          title: 'Example',
          readLater: false,
        })
      ).rejects.toThrow(DuplicatePinError)
    })

    it('should throw validation error for invalid URL', async () => {
      await expect(
        pinService.createPin(createMockAccessControl(mockUser), {
          url: 'not-a-url',
          title: 'Example',
          readLater: false,
        })
      ).rejects.toThrow('Must be a valid URL')
    })

    it('should create a pin without tags', async () => {
      mockPinRepository.findByUserIdAndUrl.mockResolvedValue(null)
      mockPinRepository.create.mockResolvedValue(mockPin)

      const result = await pinService.createPin(
        createMockAccessControl(mockUser),
        {
          url: 'https://example.com',
          title: 'Example',
          readLater: false,
        }
      )

      expect(result).toEqual(mockPin)
    })

    it('should handle empty tagNames array', async () => {
      mockPinRepository.findByUserIdAndUrl.mockResolvedValue(null)
      mockPinRepository.create.mockResolvedValue(mockPin)

      const result = await pinService.createPin(
        createMockAccessControl(mockUser),
        {
          url: 'https://example.com',
          title: 'Example',
          readLater: false,
          tagNames: [],
        }
      )

      expect(result).toEqual(mockPin)
    })
  })

  describe('updatePin', () => {
    it('should update a pin with valid data', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue({
        ...mockPin,
        title: 'Updated Title',
      })

      const result = await pinService.updatePin(
        createMockAccessControl(mockUser),
        {
          id: 'pin-123',
          title: 'Updated Title',
        }
      )

      expect(result.title).toBe('Updated Title')
      expect(mockPinRepository.update).toHaveBeenCalledWith({
        id: 'pin-123',
        userId: 'user-123',
        url: 'https://example.com', // from existing pin
        title: 'Updated Title', // updated field
        description: 'Description', // from existing pin
        readLater: false, // from existing pin
        tagNames: ['javascript'], // from existing pin
      })
    })

    it('should throw UnauthorizedPinAccessError if user does not own the pin', async () => {
      const otherUserPin = { ...mockPin, userId: 'other-user' }
      mockPinRepository.findById.mockResolvedValue(otherUserPin)

      await expect(
        pinService.updatePin(createMockAccessControl(null), {
          id: 'pin-123',
          title: 'Updated',
        })
      ).rejects.toThrow(UnauthorizedPinAccessError)
    })

    it('should throw PinNotFoundError if pin does not exist', async () => {
      mockPinRepository.findById.mockResolvedValue(null)

      await expect(
        pinService.updatePin(createMockAccessControl(mockUser), {
          id: 'pin-123',
          title: 'Updated',
        })
      ).rejects.toThrow(PinNotFoundError)
    })

    it('should validate URL updates do not create duplicates', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.findByUserIdAndUrl.mockResolvedValue({
        ...mockPin,
        id: 'pin-456',
      })

      await expect(
        pinService.updatePin(createMockAccessControl(mockUser), {
          id: 'pin-123',
          url: 'https://existing.com',
        })
      ).rejects.toThrow(DuplicatePinError)
    })

    it('should allow updating URL to same current URL', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue({
        ...mockPin,
        title: 'Updated Title',
      })

      const result = await pinService.updatePin(
        createMockAccessControl(mockUser),
        {
          id: 'pin-123',
          url: 'https://example.com', // Same as current URL
          title: 'Updated Title',
        }
      )

      expect(result.title).toBe('Updated Title')
      expect(mockPinRepository.findByUserIdAndUrl).not.toHaveBeenCalled()
    })

    it('should handle empty tagNames array', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue({
        ...mockPin,
        title: 'Updated Title',
      })

      const result = await pinService.updatePin(
        createMockAccessControl(mockUser),
        {
          id: 'pin-123',
          title: 'Updated Title',
          tagNames: [],
        }
      )

      expect(result.title).toBe('Updated Title')
      expect(mockTagRepository.fetchOrCreateByNames).not.toHaveBeenCalled()
    })

    it('should throw validation error for invalid input', async () => {
      await expect(
        pinService.updatePin(createMockAccessControl(mockUser), {
          id: 'pin-123',
          url: 'invalid-url',
        })
      ).rejects.toThrow('Must be a valid URL')
    })

    it('should update pin with tagNames', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue({
        ...mockPin,
        title: 'Updated with Tags',
      })

      const result = await pinService.updatePin(
        createMockAccessControl(mockUser),
        {
          id: 'pin-123',
          title: 'Updated with Tags',
          tagNames: ['javascript', 'typescript'],
        }
      )

      expect(result.title).toBe('Updated with Tags')
    })

    it('should throw PinNotFoundError if update returns null', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue(null)

      await expect(
        pinService.updatePin(createMockAccessControl(mockUser), {
          id: 'pin-123',
          title: 'Updated Title',
        })
      ).rejects.toThrow(PinNotFoundError)
    })
  })

  describe('deletePin', () => {
    it('should delete a pin owned by the user', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.delete.mockResolvedValue(true)

      await pinService.deletePin(createMockAccessControl(mockUser), 'pin-123')

      expect(mockPinRepository.delete).toHaveBeenCalledWith('pin-123')
    })

    it('should throw PinNotFoundError if pin does not exist', async () => {
      mockPinRepository.findById.mockResolvedValue(null)

      await expect(
        pinService.deletePin(createMockAccessControl(mockUser), 'pin-123')
      ).rejects.toThrow(PinNotFoundError)
    })

    it('should throw UnauthorizedPinAccessError if user does not own the pin', async () => {
      const otherUserPin = { ...mockPin, userId: 'other-user' }
      mockPinRepository.findById.mockResolvedValue(otherUserPin)

      await expect(
        pinService.deletePin(createMockAccessControl(mockUser), 'pin-123')
      ).rejects.toThrow(UnauthorizedPinAccessError)
    })
  })

  describe('getPin', () => {
    it('should return a pin owned by the user', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)

      const result = await pinService.getPin(
        createMockAccessControl(mockUser),
        'pin-123'
      )

      expect(result).toEqual(mockPin)
    })

    it('should throw PinNotFoundError if pin does not exist', async () => {
      mockPinRepository.findById.mockResolvedValue(null)

      await expect(
        pinService.getPin(createMockAccessControl(mockUser), 'pin-123')
      ).rejects.toThrow(PinNotFoundError)
    })

    it('should throw UnauthorizedPinAccessError if user does not own the pin', async () => {
      const otherUserPin = { ...mockPin, userId: 'other-user' }
      mockPinRepository.findById.mockResolvedValue(otherUserPin)

      await expect(
        pinService.getPin(createMockAccessControl(mockUser), 'pin-123')
      ).rejects.toThrow(UnauthorizedPinAccessError)
    })
  })

  describe('getUserPins', () => {
    it('should return all pins for a user', async () => {
      mockPinRepository.findByUserId.mockResolvedValue([mockPin])

      const result = await pinService.getUserPins(
        createMockAccessControl(mockUser),
        'user-123'
      )

      expect(result).toEqual([mockPin])
      expect(mockPinRepository.findByUserId).toHaveBeenCalledWith('user-123')
    })
  })

  describe('getReadLaterPins', () => {
    it('should return read later pins for a user', async () => {
      const readLaterPin = { ...mockPin, readLater: true }
      mockPinRepository.findByUserId.mockResolvedValue([readLaterPin])

      const result = await pinService.getReadLaterPins(
        createMockAccessControl(mockUser),
        'user-123'
      )

      expect(result).toEqual([readLaterPin])
      expect(mockPinRepository.findByUserId).toHaveBeenCalledWith('user-123', {
        readLater: true,
      })
    })
  })

  describe('getPinsByTag', () => {
    it('should return pins for a tag owned by the user', async () => {
      mockTagRepository.findById.mockResolvedValue(mockTag)
      mockPinRepository.findByUserId.mockResolvedValue([mockPin])

      const result = await pinService.getPinsByTag(
        createMockAccessControl(mockUser),
        'user-123',
        'tag-123'
      )

      expect(result).toEqual([mockPin])
      expect(mockTagRepository.findById).toHaveBeenCalledWith('tag-123')
      expect(mockPinRepository.findByUserId).toHaveBeenCalledWith('user-123', {
        tagId: 'tag-123',
      })
    })

    it('should throw TagNotFoundError if tag does not exist', async () => {
      mockTagRepository.findById.mockResolvedValue(null)

      await expect(
        pinService.getPinsByTag(
          createMockAccessControl(mockUser),
          'user-123',
          'tag-123'
        )
      ).rejects.toThrow(TagNotFoundError)
    })

    it('should throw UnauthorizedTagAccessError if user does not own the tag', async () => {
      const otherUserTag = { ...mockTag, userId: 'other-user' }
      mockTagRepository.findById.mockResolvedValue(otherUserTag)

      await expect(
        pinService.getPinsByTag(
          createMockAccessControl(mockUser),
          'user-123',
          'tag-123'
        )
      ).rejects.toThrow(UnauthorizedTagAccessError)
    })
  })

  describe('createTag', () => {
    it('should create a tag with valid data', async () => {
      mockTagRepository.findByUserIdAndName.mockResolvedValue(null)
      mockTagRepository.create.mockResolvedValue(mockTag)

      const result = await pinService.createTag(
        createMockAccessControl(mockUser),
        {
          name: 'javascript',
        }
      )

      expect(result).toEqual(mockTag)
      expect(mockTagRepository.create).toHaveBeenCalledWith({
        userId: 'user-123',
        name: 'javascript',
      })
    })

    it('should throw DuplicateTagError if tag name already exists for user', async () => {
      mockTagRepository.findByUserIdAndName.mockResolvedValue(mockTag)

      await expect(
        pinService.createTag(createMockAccessControl(mockUser), {
          name: 'javascript',
        })
      ).rejects.toThrow(DuplicateTagError)
    })

    it('should validate tag name', async () => {
      await expect(
        pinService.createTag(createMockAccessControl(mockUser), {
          name: 'invalid\x00tag',
        })
      ).rejects.toThrow('Tag name cannot contain control characters')
    })
  })

  describe('getUserTags', () => {
    it('should return all tags for a user', async () => {
      const mockTags = [
        mockTag,
        { ...mockTag, id: 'tag-456', name: 'typescript' },
      ]
      mockTagRepository.findByUserId.mockResolvedValue(mockTags)

      const result = await pinService.getUserTags(
        createMockAccessControl(mockUser),
        'user-123'
      )

      expect(result).toEqual(mockTags)
      expect(mockTagRepository.findByUserId).toHaveBeenCalledWith('user-123')
    })
  })

  describe('deleteTag', () => {
    it('should delete a tag owned by the user', async () => {
      mockTagRepository.findById.mockResolvedValue(mockTag)
      mockTagRepository.delete.mockResolvedValue(true)

      await pinService.deleteTag(createMockAccessControl(mockUser), 'tag-123')

      expect(mockTagRepository.delete).toHaveBeenCalledWith('tag-123')
    })

    it('should throw TagNotFoundError if tag does not exist', async () => {
      mockTagRepository.findById.mockResolvedValue(null)

      await expect(
        pinService.deleteTag(createMockAccessControl(mockUser), 'tag-123')
      ).rejects.toThrow(TagNotFoundError)
    })

    it('should throw UnauthorizedTagAccessError if user does not own the tag', async () => {
      const otherUserTag = { ...mockTag, userId: 'other-user' }
      mockTagRepository.findById.mockResolvedValue(otherUserTag)

      await expect(
        pinService.deleteTag(createMockAccessControl(mockUser), 'tag-123')
      ).rejects.toThrow(UnauthorizedTagAccessError)
    })
  })
})
