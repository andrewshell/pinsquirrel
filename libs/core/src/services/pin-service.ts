import type { PinRepository } from '../interfaces/pin-repository.js'
import type { TagRepository } from '../interfaces/tag-repository.js'
import type { Pin } from '../entities/pin.js'
import type { Tag } from '../entities/tag.js'
import type {
  CreatePinInput,
  UpdatePinInput,
  CreateTagInput,
} from '../validation/pin-schemas.js'
import {
  createPinDataSchema,
  updatePinDataSchema,
  createTagDataSchema,
} from '../validation/pin-schemas.js'
import {
  PinNotFoundError,
  UnauthorizedPinAccessError,
  DuplicatePinError,
  TagNotFoundError,
  UnauthorizedTagAccessError,
  DuplicateTagError,
} from '../errors/pin-errors.js'

export class PinService {
  constructor(
    private readonly pinRepository: PinRepository,
    private readonly tagRepository: TagRepository
  ) {}

  async createPin(userId: string, data: CreatePinInput): Promise<Pin> {
    // Validate input
    const validationResult = createPinDataSchema.safeParse(data)
    if (!validationResult.success) {
      throw new Error(
        `Invalid ${validationResult.error.issues[0]?.path.join('.')}: ${validationResult.error.issues[0]?.message}`
      )
    }

    // Check for duplicate URL
    const existingPin = await this.pinRepository.findByUserIdAndUrl(
      userId,
      data.url
    )
    if (existingPin) {
      throw new DuplicatePinError(data.url)
    }

    // Handle tags using bulk fetch/create
    if (data.tagNames && data.tagNames.length > 0) {
      await this.tagRepository.fetchOrCreateByNames(userId, data.tagNames)
    }

    // Create pin
    const pin = await this.pinRepository.create({
      userId,
      url: data.url,
      title: data.title,
      description: data.description,
      readLater: data.readLater ?? false,
      tagNames: data.tagNames,
    })

    return pin
  }

  async updatePin(
    userId: string,
    pinId: string,
    data: UpdatePinInput
  ): Promise<Pin> {
    // Validate input
    const validationResult = updatePinDataSchema.safeParse(data)
    if (!validationResult.success) {
      throw new Error(
        `Invalid ${validationResult.error.issues[0]?.path.join('.')}: ${validationResult.error.issues[0]?.message}`
      )
    }

    // Get pin and check ownership
    const pin = await this.pinRepository.findById(pinId)
    if (!pin) {
      throw new PinNotFoundError(pinId)
    }
    if (pin.userId !== userId) {
      throw new UnauthorizedPinAccessError(pinId)
    }

    // Check for duplicate URL if updating URL
    if (data.url && data.url !== pin.url) {
      const existingPin = await this.pinRepository.findByUserIdAndUrl(
        userId,
        data.url
      )
      if (existingPin && existingPin.id !== pinId) {
        throw new DuplicatePinError(data.url)
      }
    }

    // Handle tags using bulk fetch/create if updating tags
    if (data.tagNames !== undefined && data.tagNames.length > 0) {
      await this.tagRepository.fetchOrCreateByNames(userId, data.tagNames)
    }

    // Update pin
    const updatedPin = await this.pinRepository.update(pinId, data)
    if (!updatedPin) {
      throw new PinNotFoundError(pinId)
    }

    return updatedPin
  }

  async deletePin(userId: string, pinId: string): Promise<void> {
    // Get pin and check ownership
    const pin = await this.pinRepository.findById(pinId)
    if (!pin) {
      throw new PinNotFoundError(pinId)
    }
    if (pin.userId !== userId) {
      throw new UnauthorizedPinAccessError(pinId)
    }

    // Delete pin
    await this.pinRepository.delete(pinId)
  }

  async getPin(userId: string, pinId: string): Promise<Pin> {
    const pin = await this.pinRepository.findById(pinId)
    if (!pin) {
      throw new PinNotFoundError(pinId)
    }
    if (pin.userId !== userId) {
      throw new UnauthorizedPinAccessError(pinId)
    }
    return pin
  }

  async getUserPins(userId: string): Promise<Pin[]> {
    return await this.pinRepository.findByUserId(userId)
  }

  async getReadLaterPins(userId: string): Promise<Pin[]> {
    return await this.pinRepository.findByUserId(userId, { readLater: true })
  }

  async getPinsByTag(userId: string, tagId: string): Promise<Pin[]> {
    // Validate tag ownership
    const tag = await this.tagRepository.findById(tagId)
    if (!tag) {
      throw new TagNotFoundError(tagId)
    }
    if (tag.userId !== userId) {
      throw new UnauthorizedTagAccessError(tagId)
    }

    return await this.pinRepository.findByUserId(userId, { tagId })
  }

  async createTag(userId: string, data: CreateTagInput): Promise<Tag> {
    // Validate input
    const validationResult = createTagDataSchema.safeParse(data)
    if (!validationResult.success) {
      throw new Error(
        `Invalid ${validationResult.error.issues[0]?.path.join('.')}: ${validationResult.error.issues[0]?.message}`
      )
    }

    // Check for duplicate tag name
    const existingTag = await this.tagRepository.findByUserIdAndName(
      userId,
      data.name
    )
    if (existingTag) {
      throw new DuplicateTagError(data.name)
    }

    // Create tag
    const tag = await this.tagRepository.create({
      userId,
      name: data.name,
    })

    return tag
  }

  async getUserTags(userId: string): Promise<Tag[]> {
    return await this.tagRepository.findByUserId(userId)
  }

  async deleteTag(userId: string, tagId: string): Promise<void> {
    // Get tag and check ownership
    const tag = await this.tagRepository.findById(tagId)
    if (!tag) {
      throw new TagNotFoundError(tagId)
    }
    if (tag.userId !== userId) {
      throw new UnauthorizedTagAccessError(tagId)
    }

    // Delete tag
    await this.tagRepository.delete(tagId)
  }
}
