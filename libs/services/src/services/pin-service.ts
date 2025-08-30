import type {
  AccessControl,
  CreatePinData,
  CreateTagData,
  Pin,
  PinRepository,
  ServiceCreatePinData,
  ServiceCreateTagData,
  ServiceUpdatePinData,
  Tag,
  TagRepository,
  UpdatePinData,
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

  async createPin(
    ac: AccessControl,
    input: ServiceCreatePinData
  ): Promise<Pin> {
    // Check if user can create pins
    if (!ac.canCreate()) {
      throw new UnauthorizedPinAccessError(
        'User must be authenticated to create pins'
      )
    }
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
      ac.user!.id,
      input.url
    )
    if (existingPin) {
      throw new DuplicatePinError(input.url)
    }

    // Create pin data (timestamps managed by repository)
    const createPinData: CreatePinData = {
      userId: ac.user!.id,
      url: input.url,
      title: input.title,
      description: input.description ?? null,
      readLater: input.readLater ?? false,
      tagNames: input.tagNames ?? [],
    }
    const pin = await this.pinRepository.create(createPinData)

    return pin
  }

  async updatePin(
    ac: AccessControl,
    input: ServiceUpdatePinData
  ): Promise<Pin> {
    // Check if user can update pins (basic auth check)
    if (!ac.user) {
      throw new UnauthorizedPinAccessError(
        'User must be authenticated to update pins'
      )
    }

    // Validate input using zod schema (extract only the update fields)
    const { id, tagNames, ...updateFields } = input
    const validationResult = updatePinDataSchema.safeParse({
      ...updateFields,
      tagNames,
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

    // Get pin and check ownership
    const existingPin = await this.pinRepository.findById(id)
    if (!existingPin) {
      throw new PinNotFoundError(id)
    }
    if (!ac.canUpdate(existingPin)) {
      throw new UnauthorizedPinAccessError(id)
    }

    // Check for duplicate URL if updating URL
    if (updateFields.url && updateFields.url !== existingPin.url) {
      const duplicatePin = await this.pinRepository.findByUserIdAndUrl(
        ac.user!.id,
        updateFields.url
      )
      if (duplicatePin && duplicatePin.id !== id) {
        throw new DuplicatePinError(updateFields.url)
      }
    }

    // Build complete update data by merging existing pin with updates
    // (timestamps managed by repository)
    const updateData: UpdatePinData = {
      id: existingPin.id,
      userId: existingPin.userId,
      url: updateFields.url ?? existingPin.url,
      title: updateFields.title ?? existingPin.title,
      description:
        updateFields.description !== undefined
          ? updateFields.description
          : existingPin.description,
      readLater: updateFields.readLater ?? existingPin.readLater,
      tagNames: tagNames !== undefined ? tagNames : existingPin.tagNames,
    }

    // Update pin
    const updatedPin = await this.pinRepository.update(updateData)
    if (!updatedPin) {
      throw new PinNotFoundError(id)
    }

    return updatedPin
  }

  async deletePin(ac: AccessControl, pinId: string): Promise<void> {
    // Get pin and check ownership
    const pin = await this.pinRepository.findById(pinId)
    if (!pin) {
      throw new PinNotFoundError(pinId)
    }
    if (!ac.canDelete(pin)) {
      throw new UnauthorizedPinAccessError(pinId)
    }

    // Delete pin
    await this.pinRepository.delete(pinId)
  }

  async getPin(ac: AccessControl, pinId: string): Promise<Pin> {
    const pin = await this.pinRepository.findById(pinId)
    if (!pin) {
      throw new PinNotFoundError(pinId)
    }
    if (!ac.canRead(pin)) {
      throw new UnauthorizedPinAccessError(pinId)
    }
    return pin
  }

  async getUserPins(ac: AccessControl, targetUserId: string): Promise<Pin[]> {
    // Future: could add public viewing logic here
    // For now, user can only view their own pins
    if (!ac.user || ac.user.id !== targetUserId) {
      return []
    }
    return await this.pinRepository.findByUserId(targetUserId)
  }

  async getReadLaterPins(
    ac: AccessControl,
    targetUserId: string
  ): Promise<Pin[]> {
    // Future: could add public viewing logic here
    // For now, user can only view their own pins
    if (!ac.user || ac.user.id !== targetUserId) {
      return []
    }
    return await this.pinRepository.findByUserId(targetUserId, {
      readLater: true,
    })
  }

  async getPinsByTag(
    ac: AccessControl,
    targetUserId: string,
    tagId: string
  ): Promise<Pin[]> {
    // Validate tag exists and user has access
    const tag = await this.tagRepository.findById(tagId)
    if (!tag) {
      throw new TagNotFoundError(tagId)
    }
    if (!ac.canRead(tag)) {
      throw new UnauthorizedTagAccessError(tagId)
    }

    // Future: could add public viewing logic here
    // For now, user can only view their own pins
    if (!ac.user || ac.user.id !== targetUserId) {
      return []
    }

    return await this.pinRepository.findByUserId(targetUserId, { tagId })
  }

  async createTag(ac: AccessControl, data: ServiceCreateTagData): Promise<Tag> {
    // Check if user can create tags
    if (!ac.canCreate()) {
      throw new UnauthorizedTagAccessError(
        'User must be authenticated to create tags'
      )
    }

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
      ac.user!.id,
      data.name
    )
    if (existingTag) {
      throw new DuplicateTagError(data.name)
    }

    // Create tag data with user ID from AccessControl
    const createTagData: CreateTagData = {
      userId: ac.user!.id,
      name: data.name,
    }

    // Create tag
    const tag = await this.tagRepository.create(createTagData)

    return tag
  }

  async getUserTags(ac: AccessControl, targetUserId: string): Promise<Tag[]> {
    // Future: could add public viewing logic here
    // For now, user can only view their own tags
    if (!ac.user || ac.user.id !== targetUserId) {
      return []
    }
    return await this.tagRepository.findByUserId(targetUserId)
  }

  async deleteTag(ac: AccessControl, tagId: string): Promise<void> {
    // Get tag and check ownership
    const tag = await this.tagRepository.findById(tagId)
    if (!tag) {
      throw new TagNotFoundError(tagId)
    }
    if (!ac.canDelete(tag)) {
      throw new UnauthorizedTagAccessError(tagId)
    }

    // Delete tag
    await this.tagRepository.delete(tagId)
  }
}
