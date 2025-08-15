import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { PinService } from './pin-service.js'
import type { PinRepository } from '../interfaces/pin-repository.js'
import type { TagRepository } from '../interfaces/tag-repository.js'
import type { Pin } from '../entities/pin.js'
import type { Tag } from '../entities/tag.js'
import {
  PinNotFoundError,
  UnauthorizedPinAccessError,
  DuplicatePinError,
  TagNotFoundError,
  UnauthorizedTagAccessError,
  DuplicateTagError,
} from '../errors/pin-errors.js'

describe('PinService', () => {
  let pinService: PinService
  let mockPinRepository: {
    findById: Mock
    findAll: Mock
    create: Mock
    update: Mock
    delete: Mock
    findByUserId: Mock
    findByUserIdAndTag: Mock
    findByUserIdAndReadLater: Mock
    findByUserIdAndUrl: Mock
  }
  let mockTagRepository: {
    findById: Mock
    findAll: Mock
    create: Mock
    update: Mock
    delete: Mock
    findByUserId: Mock
    findByUserIdAndName: Mock
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
    contentPath: null,
    imagePath: null,
    tags: [mockTag],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  beforeEach(() => {
    mockPinRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findByUserId: vi.fn(),
      findByUserIdAndTag: vi.fn(),
      findByUserIdAndReadLater: vi.fn(),
      findByUserIdAndUrl: vi.fn(),
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
    }

    pinService = new PinService(
      mockPinRepository as unknown as PinRepository,
      mockTagRepository as unknown as TagRepository
    )
  })

  describe('createPin', () => {
    it('should create a pin with valid data', async () => {
      mockPinRepository.findByUserIdAndUrl.mockResolvedValue(null)
      mockTagRepository.fetchOrCreateByNames.mockResolvedValue([mockTag])
      mockPinRepository.create.mockResolvedValue(mockPin)

      const result = await pinService.createPin('user-123', {
        url: 'https://example.com',
        title: 'Example',
        description: 'Description',
        tagNames: ['javascript'],
      })

      expect(result).toEqual(mockPin)
      expect(mockPinRepository.findByUserIdAndUrl).toHaveBeenCalledWith(
        'user-123',
        'https://example.com'
      )
      expect(mockTagRepository.fetchOrCreateByNames).toHaveBeenCalledWith(
        'user-123',
        ['javascript']
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
        pinService.createPin('user-123', {
          url: 'https://example.com',
          title: 'Example',
        })
      ).rejects.toThrow(DuplicatePinError)
    })

    it('should throw validation error for invalid URL', async () => {
      await expect(
        pinService.createPin('user-123', {
          url: 'not-a-url',
          title: 'Example',
        })
      ).rejects.toThrow('Invalid url')
    })

    it('should create a pin without tags', async () => {
      mockPinRepository.findByUserIdAndUrl.mockResolvedValue(null)
      mockPinRepository.create.mockResolvedValue(mockPin)

      const result = await pinService.createPin('user-123', {
        url: 'https://example.com',
        title: 'Example',
      })

      expect(result).toEqual(mockPin)
      expect(mockTagRepository.fetchOrCreateByNames).not.toHaveBeenCalled()
    })

    it('should handle empty tagNames array', async () => {
      mockPinRepository.findByUserIdAndUrl.mockResolvedValue(null)
      mockPinRepository.create.mockResolvedValue(mockPin)

      const result = await pinService.createPin('user-123', {
        url: 'https://example.com',
        title: 'Example',
        tagNames: [],
      })

      expect(result).toEqual(mockPin)
      expect(mockTagRepository.fetchOrCreateByNames).not.toHaveBeenCalled()
    })
  })

  describe('updatePin', () => {
    it('should update a pin with valid data', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue({
        ...mockPin,
        title: 'Updated Title',
      })

      const result = await pinService.updatePin('user-123', 'pin-123', {
        title: 'Updated Title',
      })

      expect(result.title).toBe('Updated Title')
      expect(mockPinRepository.update).toHaveBeenCalledWith('pin-123', {
        title: 'Updated Title',
      })
    })

    it('should throw UnauthorizedPinAccessError if user does not own the pin', async () => {
      const otherUserPin = { ...mockPin, userId: 'other-user' }
      mockPinRepository.findById.mockResolvedValue(otherUserPin)

      await expect(
        pinService.updatePin('user-123', 'pin-123', {
          title: 'Updated',
        })
      ).rejects.toThrow(UnauthorizedPinAccessError)
    })

    it('should throw PinNotFoundError if pin does not exist', async () => {
      mockPinRepository.findById.mockResolvedValue(null)

      await expect(
        pinService.updatePin('user-123', 'pin-123', {
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
        pinService.updatePin('user-123', 'pin-123', {
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

      const result = await pinService.updatePin('user-123', 'pin-123', {
        url: 'https://example.com', // Same as current URL
        title: 'Updated Title',
      })

      expect(result.title).toBe('Updated Title')
      expect(mockPinRepository.findByUserIdAndUrl).not.toHaveBeenCalled()
    })

    it('should handle empty tagNames array', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue({
        ...mockPin,
        title: 'Updated Title',
      })

      const result = await pinService.updatePin('user-123', 'pin-123', {
        title: 'Updated Title',
        tagNames: [],
      })

      expect(result.title).toBe('Updated Title')
      expect(mockTagRepository.fetchOrCreateByNames).not.toHaveBeenCalled()
    })

    it('should throw validation error for invalid input', async () => {
      await expect(
        pinService.updatePin('user-123', 'pin-123', {
          url: 'invalid-url',
        })
      ).rejects.toThrow('Invalid url')
    })

    it('should update pin with tagNames', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockTagRepository.fetchOrCreateByNames.mockResolvedValue([mockTag])
      mockPinRepository.update.mockResolvedValue({
        ...mockPin,
        title: 'Updated with Tags',
      })

      const result = await pinService.updatePin('user-123', 'pin-123', {
        title: 'Updated with Tags',
        tagNames: ['javascript', 'typescript'],
      })

      expect(result.title).toBe('Updated with Tags')
      expect(mockTagRepository.fetchOrCreateByNames).toHaveBeenCalledWith(
        'user-123',
        ['javascript', 'typescript']
      )
    })

    it('should throw PinNotFoundError if update returns null', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue(null)

      await expect(
        pinService.updatePin('user-123', 'pin-123', {
          title: 'Updated Title',
        })
      ).rejects.toThrow(PinNotFoundError)
    })
  })

  describe('deletePin', () => {
    it('should delete a pin owned by the user', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.delete.mockResolvedValue(true)

      await pinService.deletePin('user-123', 'pin-123')

      expect(mockPinRepository.delete).toHaveBeenCalledWith('pin-123')
    })

    it('should throw PinNotFoundError if pin does not exist', async () => {
      mockPinRepository.findById.mockResolvedValue(null)

      await expect(pinService.deletePin('user-123', 'pin-123')).rejects.toThrow(
        PinNotFoundError
      )
    })

    it('should throw UnauthorizedPinAccessError if user does not own the pin', async () => {
      const otherUserPin = { ...mockPin, userId: 'other-user' }
      mockPinRepository.findById.mockResolvedValue(otherUserPin)

      await expect(pinService.deletePin('user-123', 'pin-123')).rejects.toThrow(
        UnauthorizedPinAccessError
      )
    })
  })

  describe('getPin', () => {
    it('should return a pin owned by the user', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)

      const result = await pinService.getPin('user-123', 'pin-123')

      expect(result).toEqual(mockPin)
    })

    it('should throw PinNotFoundError if pin does not exist', async () => {
      mockPinRepository.findById.mockResolvedValue(null)

      await expect(pinService.getPin('user-123', 'pin-123')).rejects.toThrow(
        PinNotFoundError
      )
    })

    it('should throw UnauthorizedPinAccessError if user does not own the pin', async () => {
      const otherUserPin = { ...mockPin, userId: 'other-user' }
      mockPinRepository.findById.mockResolvedValue(otherUserPin)

      await expect(pinService.getPin('user-123', 'pin-123')).rejects.toThrow(
        UnauthorizedPinAccessError
      )
    })
  })

  describe('getUserPins', () => {
    it('should return all pins for a user', async () => {
      mockPinRepository.findByUserId.mockResolvedValue([mockPin])

      const result = await pinService.getUserPins('user-123')

      expect(result).toEqual([mockPin])
      expect(mockPinRepository.findByUserId).toHaveBeenCalledWith('user-123')
    })
  })

  describe('getReadLaterPins', () => {
    it('should return read later pins for a user', async () => {
      const readLaterPin = { ...mockPin, readLater: true }
      mockPinRepository.findByUserIdAndReadLater.mockResolvedValue([
        readLaterPin,
      ])

      const result = await pinService.getReadLaterPins('user-123')

      expect(result).toEqual([readLaterPin])
      expect(mockPinRepository.findByUserIdAndReadLater).toHaveBeenCalledWith(
        'user-123',
        true
      )
    })
  })

  describe('getPinsByTag', () => {
    it('should return pins for a tag owned by the user', async () => {
      mockTagRepository.findById.mockResolvedValue(mockTag)
      mockPinRepository.findByUserIdAndTag.mockResolvedValue([mockPin])

      const result = await pinService.getPinsByTag('user-123', 'tag-123')

      expect(result).toEqual([mockPin])
      expect(mockTagRepository.findById).toHaveBeenCalledWith('tag-123')
      expect(mockPinRepository.findByUserIdAndTag).toHaveBeenCalledWith(
        'user-123',
        'tag-123'
      )
    })

    it('should throw TagNotFoundError if tag does not exist', async () => {
      mockTagRepository.findById.mockResolvedValue(null)

      await expect(
        pinService.getPinsByTag('user-123', 'tag-123')
      ).rejects.toThrow(TagNotFoundError)
    })

    it('should throw UnauthorizedTagAccessError if user does not own the tag', async () => {
      const otherUserTag = { ...mockTag, userId: 'other-user' }
      mockTagRepository.findById.mockResolvedValue(otherUserTag)

      await expect(
        pinService.getPinsByTag('user-123', 'tag-123')
      ).rejects.toThrow(UnauthorizedTagAccessError)
    })
  })

  describe('createTag', () => {
    it('should create a tag with valid data', async () => {
      mockTagRepository.findByUserIdAndName.mockResolvedValue(null)
      mockTagRepository.create.mockResolvedValue(mockTag)

      const result = await pinService.createTag('user-123', {
        name: 'javascript',
      })

      expect(result).toEqual(mockTag)
      expect(mockTagRepository.create).toHaveBeenCalledWith({
        userId: 'user-123',
        name: 'javascript',
      })
    })

    it('should throw DuplicateTagError if tag name already exists for user', async () => {
      mockTagRepository.findByUserIdAndName.mockResolvedValue(mockTag)

      await expect(
        pinService.createTag('user-123', { name: 'javascript' })
      ).rejects.toThrow(DuplicateTagError)
    })

    it('should validate tag name', async () => {
      await expect(
        pinService.createTag('user-123', { name: 'invalid tag name' })
      ).rejects.toThrow('Invalid name')
    })
  })

  describe('getUserTags', () => {
    it('should return all tags for a user', async () => {
      const mockTags = [
        mockTag,
        { ...mockTag, id: 'tag-456', name: 'typescript' },
      ]
      mockTagRepository.findByUserId.mockResolvedValue(mockTags)

      const result = await pinService.getUserTags('user-123')

      expect(result).toEqual(mockTags)
      expect(mockTagRepository.findByUserId).toHaveBeenCalledWith('user-123')
    })
  })

  describe('deleteTag', () => {
    it('should delete a tag owned by the user', async () => {
      mockTagRepository.findById.mockResolvedValue(mockTag)
      mockTagRepository.delete.mockResolvedValue(true)

      await pinService.deleteTag('user-123', 'tag-123')

      expect(mockTagRepository.delete).toHaveBeenCalledWith('tag-123')
    })

    it('should throw TagNotFoundError if tag does not exist', async () => {
      mockTagRepository.findById.mockResolvedValue(null)

      await expect(pinService.deleteTag('user-123', 'tag-123')).rejects.toThrow(
        TagNotFoundError
      )
    })

    it('should throw UnauthorizedTagAccessError if user does not own the tag', async () => {
      const otherUserTag = { ...mockTag, userId: 'other-user' }
      mockTagRepository.findById.mockResolvedValue(otherUserTag)

      await expect(pinService.deleteTag('user-123', 'tag-123')).rejects.toThrow(
        UnauthorizedTagAccessError
      )
    })
  })

  describe('updatePinContent', () => {
    it('should update pin content path', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue({
        ...mockPin,
        contentPath: '/new/content.md',
      })

      await pinService.updatePinContent(
        'user-123',
        'pin-123',
        '/new/content.md'
      )

      expect(mockPinRepository.update).toHaveBeenCalledWith('pin-123', {
        contentPath: '/new/content.md',
      })
    })

    it('should allow setting content path to null', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue({
        ...mockPin,
        contentPath: null,
      })

      await pinService.updatePinContent('user-123', 'pin-123', null)

      expect(mockPinRepository.update).toHaveBeenCalledWith('pin-123', {
        contentPath: null,
      })
    })

    it('should throw PinNotFoundError if pin does not exist', async () => {
      mockPinRepository.findById.mockResolvedValue(null)

      await expect(
        pinService.updatePinContent('user-123', 'pin-123', '/new/content.md')
      ).rejects.toThrow(PinNotFoundError)
    })

    it('should throw UnauthorizedPinAccessError if user does not own the pin', async () => {
      const otherUserPin = { ...mockPin, userId: 'other-user' }
      mockPinRepository.findById.mockResolvedValue(otherUserPin)

      await expect(
        pinService.updatePinContent('user-123', 'pin-123', '/new/content.md')
      ).rejects.toThrow(UnauthorizedPinAccessError)
    })

    it('should throw validation error for invalid content path', async () => {
      const invalidPath = 'a'.repeat(501) // Exceeds max length

      await expect(
        pinService.updatePinContent('user-123', 'pin-123', invalidPath)
      ).rejects.toThrow('Invalid content path')
    })
  })

  describe('updatePinImage', () => {
    it('should update pin image path', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue({
        ...mockPin,
        imagePath: '/new/image.jpg',
      })

      await pinService.updatePinImage('user-123', 'pin-123', '/new/image.jpg')

      expect(mockPinRepository.update).toHaveBeenCalledWith('pin-123', {
        imagePath: '/new/image.jpg',
      })
    })

    it('should allow setting image path to null', async () => {
      mockPinRepository.findById.mockResolvedValue(mockPin)
      mockPinRepository.update.mockResolvedValue({
        ...mockPin,
        imagePath: null,
      })

      await pinService.updatePinImage('user-123', 'pin-123', null)

      expect(mockPinRepository.update).toHaveBeenCalledWith('pin-123', {
        imagePath: null,
      })
    })

    it('should throw PinNotFoundError if pin does not exist', async () => {
      mockPinRepository.findById.mockResolvedValue(null)

      await expect(
        pinService.updatePinImage('user-123', 'pin-123', '/new/image.jpg')
      ).rejects.toThrow(PinNotFoundError)
    })

    it('should throw UnauthorizedPinAccessError if user does not own the pin', async () => {
      const otherUserPin = { ...mockPin, userId: 'other-user' }
      mockPinRepository.findById.mockResolvedValue(otherUserPin)

      await expect(
        pinService.updatePinImage('user-123', 'pin-123', '/new/image.jpg')
      ).rejects.toThrow(UnauthorizedPinAccessError)
    })

    it('should throw validation error for invalid image path', async () => {
      const invalidPath = 'a'.repeat(501) // Exceeds max length

      await expect(
        pinService.updatePinImage('user-123', 'pin-123', invalidPath)
      ).rejects.toThrow('Invalid image path')
    })
  })
})
