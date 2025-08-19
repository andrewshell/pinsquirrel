import type {
  Tag,
  CreateTagData,
  UpdateTagData,
  TagWithCount,
} from '../entities/tag.js'
import type { Repository } from './repository.js'

export interface TagRepository
  extends Repository<Tag, CreateTagData, UpdateTagData> {
  findByUserId(userId: string): Promise<Tag[]>
  findByUserIdAndName(userId: string, name: string): Promise<Tag | null>
  fetchOrCreateByNames(userId: string, names: string[]): Promise<Tag[]>
  findByUserIdWithPinCount(
    userId: string,
    filter?: { readLater?: boolean }
  ): Promise<TagWithCount[]>
}
