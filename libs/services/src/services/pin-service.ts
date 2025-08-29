import type {
  CreatePinData,
  CreateTagData,
  Pin,
  PinRepository,
  Tag,
  TagRepository,
  UpdatePinInput,
} from '@pinsquirrel/domain'
import {
  DuplicatePinError,
  DuplicateTagError,
  PinNotFoundError,
  TagNotFoundError,
  UnauthorizedPinAccessError,
  UnauthorizedTagAccessError,
  ValidationError,
} from '@pinsquirrel/domain'
import {
  createPinDataSchema,
  createTagDataSchema,
  updatePinDataSchema,
} from '../validation/pin.js'

export class PinService {
  constructor(
    private readonly pinRepository: PinRepository,
    private readonly tagRepository: TagRepository
  ) {}

  async createPin(input: {
    userId: string
    url: string
    title: string
    description?: string | null
    readLater?: boolean
    tagNames?: string[]
  }): Promise<Pin> {
    // Validate input using zod schema
    const validationResult = createPinDataSchema.safeParse({
      url: input.url,
      title: input.title,
      description: input.description,
      readLater: input.readLater,
      tagNames: input.tagNames,
    })
    if (!validationResult.success) {
      const errors: Record<string, string[]> = {}
      for (const issue of validationResult.error.issues) {
        const field = issue.path.join('.') || 'unknown'
        if (!errors[field]) {
          errors[field] = []
        }
        errors[field].push(issue.message)
      }
      throw new ValidationError(errors)
    }

    // Check for duplicate URL
    const existingPin = await this.pinRepository.findByUserIdAndUrl(
      input.userId,
      input.url
    )
    if (existingPin) {
      throw new DuplicatePinError(input.url)
    }

    // Handle tags using bulk fetch/create
    if (input.tagNames && input.tagNames.length > 0) {
      await this.tagRepository.fetchOrCreateByNames(
        input.userId,
        input.tagNames
      )
    }

    // Create pin
    const createPinData: CreatePinData = {
      userId: input.userId,
      url: input.url,
      title: input.title,
      description: input.description ?? null,
      readLater: input.readLater ?? false,
      tagNames: input.tagNames ?? [],
    }
    const pin = await this.pinRepository.create(createPinData)

    return pin
  }

  async updatePin(input: UpdatePinInput): Promise<Pin> {
    // Validate input using zod schema (extract only the update fields)
    const { userId, pinId, ...updateFields } = input
    const validationResult = updatePinDataSchema.safeParse(updateFields)
    if (!validationResult.success) {
      const errors: Record<string, string[]> = {}
      for (const issue of validationResult.error.issues) {
        const field = issue.path.join('.') || 'unknown'
        if (!errors[field]) {
          errors[field] = []
        }
        errors[field].push(issue.message)
      }
      throw new ValidationError(errors)
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
    if (updateFields.url && updateFields.url !== pin.url) {
      const existingPin = await this.pinRepository.findByUserIdAndUrl(
        userId,
        updateFields.url
      )
      if (existingPin && existingPin.id !== pinId) {
        throw new DuplicatePinError(updateFields.url)
      }
    }

    // Handle tags using bulk fetch/create if updating tags
    if (
      updateFields.tagNames !== undefined &&
      updateFields.tagNames.length > 0
    ) {
      await this.tagRepository.fetchOrCreateByNames(
        userId,
        updateFields.tagNames
      )
    }

    // Update pin
    const updatedPin = await this.pinRepository.update(pinId, updateFields)
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

  async createTag(data: CreateTagData): Promise<Tag> {
    // Validate input
    const validationResult = createTagDataSchema.safeParse({ name: data.name })
    if (!validationResult.success) {
      const errors: Record<string, string[]> = {}
      for (const issue of validationResult.error.issues) {
        const field = issue.path.join('.') || 'unknown'
        if (!errors[field]) {
          errors[field] = []
        }
        errors[field].push(issue.message)
      }
      throw new ValidationError(errors)
    }

    // Check for duplicate tag name
    const existingTag = await this.tagRepository.findByUserIdAndName(
      data.userId,
      data.name
    )
    if (existingTag) {
      throw new DuplicateTagError(data.name)
    }

    // Create tag
    const tag = await this.tagRepository.create(data)

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
