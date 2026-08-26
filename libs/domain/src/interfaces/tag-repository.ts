import type {
  Tag,
  CreateTagData,
  UpdateTagData,
  TagWithCount,
} from '../entities/tag.js'
import type { Repository } from './repository.js'

export interface TagRepository extends Repository<
  Tag,
  CreateTagData,
  UpdateTagData
> {
  findByUserId(userId: string): Promise<Tag[]>
  findByUserIdAndName(userId: string, name: string): Promise<Tag | null>
  /**
   * The user's tags whose name contains any term of `search`, or all of the
   * terms run together — searching `jesse elder` finds `jesseelder` as well as
   * `jesse` and `elder-stuff`. A search with no terms matches nothing.
   */
  searchByName(userId: string, search: string): Promise<Tag[]>
  fetchOrCreateByNames(userId: string, names: string[]): Promise<Tag[]>
  findByUserIdWithPinCount(
    userId: string,
    filter?: { readLater?: boolean }
  ): Promise<TagWithCount[]>
  mergeTags(
    userId: string,
    sourceTagIds: string[],
    destinationTagId: string
  ): Promise<void>
  deleteTagsWithNoPins(userId: string): Promise<number>
}
