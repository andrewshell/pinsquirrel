import type {
  AccessControl,
  CreatePinData,
  Pin,
  PinFilter,
  PinRepository,
  TagRepository,
  UpdatePinData,
  PaginationOptions,
} from '@pinsquirrel/domain'
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '@pinsquirrel/domain'
import {
  DuplicatePinError,
  PinNotFoundError,
  UnauthorizedPinAccessError,
} from '@pinsquirrel/domain'
import { createPinDataSchema, updatePinDataSchema } from '../validation/pin.js'
import { validationErrorFromZod } from '../validation/zod-error.js'

export class PinService {
  constructor(
    private readonly pinRepository: PinRepository,
    private readonly tagRepository: TagRepository
  ) {}

  /**
   * Collect the user's tags that no longer have any pins.
   *
   * A tag is orphaned by a pin write, so it is collected right after one
   * rather than on the next page view - this used to run on `GET /tags`, a
   * destructive write that any crawler or link prefetch could trigger.
   *
   * Runs only after the pin write has completed, and only over this user's
   * tags: a concurrent create for the same user can otherwise have inserted
   * its tag but not yet its `pins_tags` row, and the sweep would take the tag
   * back out from under it. Wrapping the pin write in a transaction (1.4) is
   * what closes that window for good.
   */
  private async collectOrphanedTags(userId: string): Promise<void> {
    await this.tagRepository.deleteTagsWithNoPins(userId)
  }

  async createPin(ac: AccessControl, input: CreatePinData): Promise<Pin> {
    // Check if user can create pins as the specified user
    if (!ac.canCreateAs(input.userId)) {
      throw new UnauthorizedPinAccessError(
        '',
        'User can only create pins for themselves'
      )
    }
    // Validate input using zod schema
    const validationResult = createPinDataSchema.safeParse({
      url: input.url,
      title: input.title,
      description: input.description,
      readLater: input.readLater,
      isPrivate: input.isPrivate,
      tagNames: input.tagNames,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    })
    if (!validationResult.success) {
      throw validationErrorFromZod(validationResult.error)
    }

    // Check for duplicate URL. canCreateAs above already established that the
    // caller is input.userId, so the caller-scoped lookup is the same query.
    const existingPin = await this.findByUrl(ac, input.url)
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
      isPrivate: input.isPrivate ?? false,
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
      throw validationErrorFromZod(validationResult.error)
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
      isPrivate: updateFields.isPrivate ?? existingPin.isPrivate,
      tagNames: tagNames !== undefined ? tagNames : existingPin.tagNames,
    }

    // Update pin
    const updatedPin = await this.pinRepository.update(updateData)
    if (!updatedPin) {
      throw new PinNotFoundError(id)
    }

    await this.collectOrphanedTags(existingPin.userId)

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

    await this.collectOrphanedTags(pin.userId)
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
   * The caller's own pin for a URL, if they have one.
   *
   * Scoped to the authenticated user, so it cannot be used to probe whether
   * some other account has saved a given URL. This is the one way to ask the
   * question: it used to be asked three different ways, including one that
   * went straight to the repository and checked nothing.
   */
  async findByUrl(ac: AccessControl, url: string): Promise<Pin | null> {
    if (!ac.user) {
      throw new UnauthorizedPinAccessError(
        '',
        'User must be authenticated to look up pins by URL'
      )
    }

    return this.pinRepository.findByUserIdAndUrl(ac.user.id, url)
  }

  /**
   * Move a pin's creation date earlier.
   *
   * The Pinboard import uses this when it meets a URL the user already has:
   * if the Pinboard copy is older, the existing pin keeps its original date
   * rather than the date it happened to be saved here. Ownership is checked
   * because the caller reaches this with an id taken from a
   * DuplicatePinError, not from a pin it fetched itself.
   */
  async backdatePin(
    ac: AccessControl,
    pinId: string,
    createdAt: Date
  ): Promise<void> {
    const pin = await this.pinRepository.findById(pinId)
    if (!pin) {
      throw new PinNotFoundError(pinId)
    }
    if (!ac.canUpdate(pin)) {
      throw new UnauthorizedPinAccessError(pinId)
    }

    await this.pinRepository.updateCreatedAt(pinId, createdAt)
  }

  /**
   * Get a pin that the caller is allowed to see over a public-only surface.
   *
   * The REST API and the MCP server both authenticate an OAuth access token
   * and expose public pins only. Anything the caller may not see - missing,
   * private, or owned by someone else - is reported as missing, so the error
   * can never confirm that an id exists. This deliberately does not delegate
   * to `getPin`, whose `UnauthorizedPinAccessError` would do exactly that.
   */
  async getPublicPin(ac: AccessControl, pinId: string): Promise<Pin> {
    const pin = await this.pinRepository.findById(pinId)
    if (!pin || !ac.canRead(pin) || pin.isPrivate) {
      throw new PinNotFoundError(pinId)
    }
    return pin
  }

  async getUserPins(ac: AccessControl): Promise<Pin[]> {
    if (!ac.user) {
      throw new UnauthorizedPinAccessError(
        '',
        'User must be authenticated to export pins'
      )
    }
    return this.pinRepository.findByUserId(ac.user.id)
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
  }> {
    if (!ac.user) {
      throw new UnauthorizedPinAccessError(
        '',
        'User must be authenticated to view pins'
      )
    }

    // Get total count for pagination calculation
    const totalCount = await this.pinRepository.countByUserId(
      ac.user.id,
      filter
    )

    // Calculate pagination details
    const pagination = Pagination.fromTotalCount(totalCount, {
      ...paginationOptions,
      defaultPageSize: DEFAULT_PAGE_SIZE,
      maxPageSize: MAX_PAGE_SIZE,
    })

    // Fetch pins with pagination. The query is scoped to ac.user, so every
    // row is readable by definition — filtering here would only be able to
    // drop rows the pagination count above already counted.
    const pins = await this.pinRepository.findByUserId(ac.user.id, filter, {
      limit: pagination.pageSize,
      offset: pagination.offset,
    })

    return { pins, pagination }
  }
}
