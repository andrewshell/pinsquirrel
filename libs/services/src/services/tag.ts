import type {
  AccessControl,
  Tag,
  TagRepository,
  TagWithCount,
  PinFilter,
  CreateTagData,
} from '@pinsquirrel/domain'
import {
  TagNotFoundError,
  UnauthorizedTagAccessError,
  ValidationError,
} from '@pinsquirrel/domain'
import { createTagDataSchema } from '../validation/pin.js'
import { validationErrorFromZod } from '../validation/zod-error.js'

export class TagService {
  constructor(private readonly tagRepository: TagRepository) {}

  /**
   * Get all tags for a specified user.
   *
   * A tag is readable only by its owner, so a caller who is not that user —
   * unauthenticated or otherwise — can never see one. Answering up front
   * keeps the query off the database instead of running it and discarding
   * every row.
   */
  async getUserTags(ac: AccessControl, userId: string): Promise<Tag[]> {
    if (!ac.canRead({ userId })) {
      return []
    }

    return this.tagRepository.findByUserId(userId)
  }

  /**
   * Get a single tag owned by the authenticated user.
   * Throws `TagNotFoundError` when the tag does not exist or the caller
   * cannot read it (404-style ownership obfuscation).
   */
  async getUserTagById(ac: AccessControl, tagId: string): Promise<Tag> {
    const tag = await this.tagRepository.findById(tagId)
    if (!tag || !ac.canRead(tag)) {
      throw new TagNotFoundError(tagId)
    }
    return tag
  }

  /**
   * Get all tags with pin counts for a specified user. Gated exactly like
   * `getUserTags`.
   */
  async getUserTagsWithCount(
    ac: AccessControl,
    userId: string,
    filter?: PinFilter
  ): Promise<TagWithCount[]> {
    if (!ac.canRead({ userId })) {
      return []
    }

    return this.tagRepository.findByUserIdWithPinCount(userId, filter)
  }

  /**
   * Create a new tag for a specific user
   */
  async createTag(ac: AccessControl, input: CreateTagData): Promise<Tag> {
    if (!ac.canCreateAs(input.userId)) {
      throw new UnauthorizedTagAccessError(
        '',
        'User can only create tags for themselves'
      )
    }

    // Validate input using zod schema
    const validationResult = createTagDataSchema.safeParse({ name: input.name })

    if (!validationResult.success) {
      throw validationErrorFromZod(validationResult.error, {
        message: 'Invalid tag data',
      })
    }

    const createData: CreateTagData = {
      name: validationResult.data.name,
      userId: input.userId,
    }

    return this.tagRepository.create(createData)
  }

  /**
   * Merge multiple source tags into a target tag
   */
  async mergeTags(
    ac: AccessControl,
    sourceTagIds: string[],
    targetTagId: string
  ): Promise<void> {
    const user = ac.user
    if (!user) {
      throw new UnauthorizedTagAccessError(
        '',
        'User must be authenticated to merge tags'
      )
    }

    // These three rules used to live in the web form's handler, so nothing
    // else calling mergeTags was covered by them. Checked before any lookup so
    // an invalid request costs no queries.
    const errors: Record<string, string[]> = {}
    if (sourceTagIds.length === 0) {
      errors.sourceTagIds = ['Please select at least one source tag.']
    }
    if (!targetTagId) {
      errors.destinationTagId = ['Please select a destination tag.']
    } else if (sourceTagIds.includes(targetTagId)) {
      // Merging a tag into itself would delete it and strand its pins.
      errors.destinationTagId = [
        'Destination tag cannot be one of the source tags.',
      ]
    }
    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors)
    }

    // Verify the target tag belongs to the user
    const targetTag = await this.tagRepository.findById(targetTagId)
    if (!targetTag) {
      throw new TagNotFoundError(
        targetTagId,
        `Target tag with ID "${targetTagId}" not found`
      )
    }

    if (!ac.canUpdate(targetTag)) {
      throw new UnauthorizedTagAccessError(
        targetTag.id,
        'User can only merge tags they own'
      )
    }

    // Verify all source tags belong to the user
    for (const sourceTagId of sourceTagIds) {
      const sourceTag = await this.tagRepository.findById(sourceTagId)
      if (!sourceTag) {
        throw new TagNotFoundError(
          sourceTagId,
          `Source tag with ID "${sourceTagId}" not found`
        )
      }

      if (!ac.canUpdate(sourceTag)) {
        throw new UnauthorizedTagAccessError(
          sourceTagId,
          'User can only merge tags they own'
        )
      }
    }

    // Perform the merge
    await this.tagRepository.mergeTags(user.id, sourceTagIds, targetTagId)
  }

  /**
   * Delete a tag owned by the authenticated user
   */
  async deleteTag(ac: AccessControl, tagId: string): Promise<void> {
    const tag = await this.tagRepository.findById(tagId)
    if (!tag) {
      throw new TagNotFoundError(tagId)
    }

    if (!ac.canDelete(tag)) {
      throw new UnauthorizedTagAccessError(
        tagId,
        'User can only delete tags they own'
      )
    }

    const deleted = await this.tagRepository.delete(tagId)
    if (!deleted) {
      throw new TagNotFoundError(
        tagId,
        `Tag with ID "${tagId}" could not be deleted`
      )
    }
  }

  /**
   * Clean up tags with no pins for a specific user
   */
  async deleteTagsWithNoPins(ac: AccessControl, userId: string): Promise<void> {
    if (!ac.canCreateAs(userId)) {
      throw new UnauthorizedTagAccessError(
        '',
        'User can only clean up their own tags'
      )
    }

    await this.tagRepository.deleteTagsWithNoPins(userId)
  }
}
