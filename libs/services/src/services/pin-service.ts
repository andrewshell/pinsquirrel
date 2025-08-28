import type {
  Pin,
  PinRepository,
  Tag,
  TagRepository,
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
import type {
  CreatePinInput,
  CreateTagInput,
  UpdatePinInput,
} from '../validation/pin.js'
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

  /**
   * Create a pin from raw form data
   */
  async createPinFromFormData(
    userId: string,
    formData: Record<string, unknown>
  ): Promise<Pin> {
    // Validate and convert form data
    const errors: Record<string, string[]> = {}

    // Required: url
    const url = formData.url
    if (!url || typeof url !== 'string') {
      errors.url = ['URL is required']
    }

    // Required: title
    const title = formData.title
    if (!title || typeof title !== 'string') {
      errors.title = ['Title is required']
    }

    // Optional: description
    const description = formData.description
    if (
      description !== undefined &&
      description !== null &&
      typeof description !== 'string'
    ) {
      errors.description = ['Description must be a string']
    }

    // Optional: readLater (convert string to boolean)
    let readLater = false
    if (formData.readLater !== undefined && formData.readLater !== null) {
      if (typeof formData.readLater === 'boolean') {
        readLater = formData.readLater
      } else if (typeof formData.readLater === 'string') {
        readLater =
          formData.readLater === 'true' ||
          formData.readLater === 'on' ||
          formData.readLater === '1'
      } else {
        errors.readLater = ['Read Later must be a boolean value']
      }
    }

    // Optional: tagNames (convert to array)
    let tagNames: string[] = []
    if (formData.tagNames !== undefined && formData.tagNames !== null) {
      if (Array.isArray(formData.tagNames)) {
        const allStrings = formData.tagNames.every(
          tag => typeof tag === 'string'
        )
        if (allStrings) {
          tagNames = formData.tagNames as string[]
        } else {
          errors.tagNames = ['All tag names must be strings']
        }
      } else if (typeof formData.tagNames === 'string') {
        tagNames = [formData.tagNames]
      } else {
        errors.tagNames = [
          'Tag names must be an array of strings or a single string',
        ]
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
    }

    return this.createPin(userId, {
      url: url as string,
      title: title as string,
      description: (description as string) || '',
      readLater,
      tagNames,
    })
  }

  /**
   * Update a pin from raw form data
   */
  async updatePinFromFormData(
    userId: string,
    pinId: string,
    formData: Record<string, unknown>
  ): Promise<Pin> {
    // Validate and convert form data
    const errors: Record<string, string[]> = {}
    const updateData: Partial<UpdatePinInput> = {}

    // Optional: url
    if (formData.url !== undefined) {
      const url = formData.url
      if (url !== null && typeof url !== 'string') {
        errors.url = ['URL must be a string']
      } else if (url) {
        updateData.url = url
      }
    }

    // Optional: title
    if (formData.title !== undefined) {
      const title = formData.title
      if (title !== null && typeof title !== 'string') {
        errors.title = ['Title must be a string']
      } else if (title) {
        updateData.title = title
      }
    }

    // Optional: description
    if (formData.description !== undefined) {
      const description = formData.description
      if (description !== null && typeof description !== 'string') {
        errors.description = ['Description must be a string']
      } else {
        updateData.description = description || ''
      }
    }

    // Optional: readLater
    if (formData.readLater !== undefined) {
      if (typeof formData.readLater === 'boolean') {
        updateData.readLater = formData.readLater
      } else if (typeof formData.readLater === 'string') {
        updateData.readLater =
          formData.readLater === 'true' ||
          formData.readLater === 'on' ||
          formData.readLater === '1'
      } else {
        errors.readLater = ['Read Later must be a boolean value']
      }
    }

    if (formData.tagNames !== undefined) {
      if (formData.tagNames === null) {
        updateData.tagNames = []
      } else if (Array.isArray(formData.tagNames)) {
        const allStrings = formData.tagNames.every(
          tag => typeof tag === 'string'
        )
        if (allStrings) {
          updateData.tagNames = formData.tagNames as string[]
        } else {
          errors.tagNames = ['All tag names must be strings']
        }
      } else if (typeof formData.tagNames === 'string') {
        updateData.tagNames = [formData.tagNames]
      } else {
        errors.tagNames = [
          'Tag names must be an array of strings or a single string',
        ]
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
    }

    return this.updatePin(userId, pinId, updateData)
  }

  async createPin(userId: string, data: CreatePinInput): Promise<Pin> {
    // Validate input
    const validationResult = createPinDataSchema.safeParse(data)
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
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
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
