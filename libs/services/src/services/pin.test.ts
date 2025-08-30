import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { PinService } from './pin.js'
import type {
  PinRepository,
  Pin,
  User,
  AccessControl,
} from '@pinsquirrel/domain'
import {
  PinNotFoundError,
  UnauthorizedPinAccessError,
  DuplicatePinError,
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
      canCreateAs: (userId: string) => !!user && user.id === userId,
      canRead: ag => !!user && user.id === ('userId' in ag ? ag.userId : ag.id),
      canUpdate: ag =>
        !!user && user.id === ('userId' in ag ? ag.userId : ag.id),
      canDelete: ag =>
        !!user && user.id === ('userId' in ag ? ag.userId : ag.id),
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

    pinService = new PinService(mockPinRepository as unknown as PinRepository)
  })

  describe('createPin', () => {
    it('should create a pin with valid data', async () => {
      mockPinRepository.findByUserIdAndUrl.mockResolvedValue(null)
      mockPinRepository.create.mockResolvedValue(mockPin)

      const result = await pinService.createPin(
        createMockAccessControl(mockUser),
        {
          userId: mockUser.id,
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
          userId: mockUser.id,
          url: 'https://example.com',
          title: 'Example',
          description: null,
          readLater: false,
          tagNames: [],
        })
      ).rejects.toThrow(DuplicatePinError)
    })

    it('should throw validation error for invalid URL', async () => {
      await expect(
        pinService.createPin(createMockAccessControl(mockUser), {
          userId: mockUser.id,
          url: 'not-a-url',
          title: 'Example',
          description: null,
          readLater: false,
          tagNames: [],
        })
      ).rejects.toThrow('Must be a valid URL')
    })

    it('should create a pin without tags', async () => {
      mockPinRepository.findByUserIdAndUrl.mockResolvedValue(null)
      mockPinRepository.create.mockResolvedValue(mockPin)

      const result = await pinService.createPin(
        createMockAccessControl(mockUser),
        {
          userId: mockUser.id,
          url: 'https://example.com',
          title: 'Example',
          description: null,
          readLater: false,
          tagNames: [],
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
          userId: mockUser.id,
          url: 'https://example.com',
          title: 'Example',
          description: null,
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
          userId: 'user-123',
          url: 'https://example.com',
          title: 'Updated Title',
          description: 'Description',
          readLater: false,
          tagNames: ['javascript'],
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
          userId: 'user-123',
          url: 'https://example.com',
          title: 'Updated',
          description: null,
          readLater: false,
          tagNames: [],
        })
      ).rejects.toThrow(UnauthorizedPinAccessError)
    })

    it('should throw PinNotFoundError if pin does not exist', async () => {
      mockPinRepository.findById.mockResolvedValue(null)

      await expect(
        pinService.updatePin(createMockAccessControl(mockUser), {
          id: 'pin-123',
          userId: 'user-123',
          url: 'https://example.com',
          title: 'Updated',
          description: null,
          readLater: false,
          tagNames: [],
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
          userId: 'user-123',
          url: 'https://existing.com',
          title: 'Example',
          description: 'Description',
          readLater: false,
          tagNames: ['javascript'],
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
          userId: 'user-123',
          url: 'https://example.com', // Same as current URL
          title: 'Updated Title',
          description: 'Description',
          readLater: false,
          tagNames: ['javascript'],
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
          userId: 'user-123',
          url: 'https://example.com',
          title: 'Updated Title',
          description: 'Description',
          readLater: false,
          tagNames: [],
        }
      )

      expect(result.title).toBe('Updated Title')
    })

    it('should throw validation error for invalid input', async () => {
      await expect(
        pinService.updatePin(createMockAccessControl(mockUser), {
          id: 'pin-123',
          userId: 'user-123',
          url: 'invalid-url',
          title: 'Example',
          description: null,
          readLater: false,
          tagNames: [],
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
          userId: 'user-123',
          url: 'https://example.com',
          title: 'Updated with Tags',
          description: 'Description',
          readLater: false,
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
          userId: 'user-123',
          url: 'https://example.com',
          title: 'Updated Title',
          description: 'Description',
          readLater: false,
          tagNames: ['javascript'],
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
})
