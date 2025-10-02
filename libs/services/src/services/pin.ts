import type {
  AccessControl,
  CreatePinData,
  Pin,
  PinFilter,
  PinRepository,
  UpdatePinData,
  PaginationOptions,
} from '@pinsquirrel/domain'
import { Pagination } from '@pinsquirrel/domain'
import {
  DuplicatePinError,
  PinNotFoundError,
  UnauthorizedPinAccessError,
  ValidationError,
} from '@pinsquirrel/domain'
import { createPinDataSchema, updatePinDataSchema } from '../validation/pin.js'

export class PinService {
  constructor(private readonly pinRepository: PinRepository) {}

  async createPin(ac: AccessControl, input: CreatePinData): Promise<Pin> {
    // Check if user can create pins as the specified user
    if (!ac.canCreateAs(input.userId)) {
      throw new UnauthorizedPinAccessError(
        'User can only create pins for themselves'
      )
    }
    // Validate input using zod schema
    const validationResult = createPinDataSchema.safeParse({
      url: input.url,
      title: input.title,
      description: input.description,
      readLater: input.readLater,
      tagNames: input.tagNames,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
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
      throw new DuplicatePinError(input.url, {
        id: existingPin.id,
        createdAt: existingPin.createdAt,
      })
    }

    // Create pin data (timestamps can be provided or will default to now in repository)
    const createPinData: CreatePinData = {
      userId: input.userId,
      url: input.url,
      title: input.title,
      description: input.description ?? null,
      readLater: input.readLater ?? false,
      tagNames: input.tagNames ?? [],
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    }
    const pin = await this.pinRepository.create(createPinData)

    return pin
  }

  async updatePin(ac: AccessControl, input: UpdatePinData): Promise<Pin> {
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
        input.userId,
        updateFields.url
      )
      if (duplicatePin && duplicatePin.id !== id) {
        throw new DuplicatePinError(updateFields.url, {
          id: duplicatePin.id,
          createdAt: duplicatePin.createdAt,
        })
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

  /**
   * Get user pins with pagination and filtering
   */
  async getUserPinsWithPagination(
    ac: AccessControl,
    filter?: PinFilter,
    paginationOptions?: PaginationOptions
  ): Promise<{
    pins: Pin[]
    pagination: Pagination
    totalCount: number
  }> {
    if (!ac.user) {
      throw new UnauthorizedPinAccessError(
        'User must be authenticated to view pins'
      )
    }

    // Get total count for pagination calculation
    const totalCount = await this.pinRepository.countByUserId(
      ac.user!.id,
      filter
    )

    // Calculate pagination details
    const pagination = Pagination.fromTotalCount(totalCount, {
      ...paginationOptions,
      defaultPageSize: 25,
      maxPageSize: 100,
    })

    // Fetch pins with pagination
    const pins = await this.pinRepository.findByUserId(ac.user!.id, filter, {
      limit: pagination.pageSize,
      offset: pagination.offset,
    })

    // Filter pins through access control
    const filteredPins = pins.filter(pin => ac.canRead(pin))

    return {
      pins: filteredPins,
      pagination,
      totalCount,
    }
  }
}
