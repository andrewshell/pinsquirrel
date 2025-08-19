import { eq, and, inArray, count } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type {
  Tag,
  TagRepository,
  CreateTagData,
  UpdateTagData,
  TagWithCount,
} from '@pinsquirrel/core'
import { tags, pinsTags, pins } from '../schema/index.js'

export class DrizzleTagRepository implements TagRepository {
  constructor(private db: PostgresJsDatabase<Record<string, unknown>>) {}

  async findById(id: string): Promise<Tag | null> {
    const result = await this.db
      .select()
      .from(tags)
      .where(eq(tags.id, id))
      .limit(1)

    if (result.length === 0) {
      return null
    }

    return this.mapToTag(result[0])
  }

  async findByUserId(userId: string): Promise<Tag[]> {
    const result = await this.db
      .select()
      .from(tags)
      .where(eq(tags.userId, userId))

    return result.map(this.mapToTag)
  }

  async findByUserIdAndName(userId: string, name: string): Promise<Tag | null> {
    const normalizedName = name.toLowerCase()
    const result = await this.db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), eq(tags.name, normalizedName)))
      .limit(1)

    if (result.length === 0) {
      return null
    }

    return this.mapToTag(result[0])
  }

  async fetchOrCreateByNames(userId: string, names: string[]): Promise<Tag[]> {
    if (names.length === 0) {
      return []
    }

    // Normalize to lowercase and remove duplicates from input
    const uniqueNames = Array.from(
      new Set(names.map(name => name.toLowerCase()))
    )

    // Find existing tags
    const existingTags = await this.db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, uniqueNames)))

    const existingTagNames = new Set(existingTags.map(t => t.name))
    const tagsToCreate = uniqueNames.filter(name => !existingTagNames.has(name))

    // Create missing tags
    let createdTags: (typeof tags.$inferSelect)[] = []
    if (tagsToCreate.length > 0) {
      const now = new Date()
      const tagValues = tagsToCreate.map(name => ({
        id: crypto.randomUUID(),
        userId,
        name: name.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      }))

      createdTags = await this.db.insert(tags).values(tagValues).returning()
    }

    // Return all tags (existing + created)
    const allTags = [...existingTags, ...createdTags]

    // Sort by the order of the input names
    const nameToTag = new Map(allTags.map(tag => [tag.name, tag]))
    const sortedTags = uniqueNames
      .map(name => nameToTag.get(name))
      .filter((tag): tag is typeof tags.$inferSelect => tag !== undefined)

    return sortedTags.map(this.mapToTag)
  }

  async findByUserIdWithPinCount(
    userId: string,
    filter?: { readLater?: boolean }
  ): Promise<TagWithCount[]> {
    // Build the base query
    const baseQuery = this.db
      .select({
        id: tags.id,
        userId: tags.userId,
        name: tags.name,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
        pinCount: count(pinsTags.pinId),
      })
      .from(tags)
      .leftJoin(pinsTags, eq(tags.id, pinsTags.tagId))

    // Build the query based on filter
    const result = await (filter?.readLater !== undefined
      ? baseQuery
          .leftJoin(pins, eq(pinsTags.pinId, pins.id))
          .where(
            and(
              eq(tags.userId, userId),
              filter.readLater
                ? eq(pins.readLater, true)
                : eq(pins.readLater, false)
            )
          )
          .groupBy(tags.id)
          .orderBy(tags.name)
      : baseQuery
          .where(eq(tags.userId, userId))
          .groupBy(tags.id)
          .orderBy(tags.name))

    return result.map(row => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      pinCount: Number(row.pinCount),
    }))
  }

  async findAll(): Promise<Tag[]> {
    const result = await this.db.select().from(tags)
    return result.map(this.mapToTag)
  }

  async list(limit?: number, offset?: number): Promise<Tag[]> {
    const baseQuery = this.db.select().from(tags)

    let query
    if (limit !== undefined && offset !== undefined) {
      query = baseQuery.limit(limit).offset(offset)
    } else if (limit !== undefined) {
      query = baseQuery.limit(limit)
    } else if (offset !== undefined) {
      query = baseQuery.offset(offset)
    } else {
      query = baseQuery
    }

    const result = await query
    return result.map(this.mapToTag)
  }

  async create(data: CreateTagData): Promise<Tag> {
    const id = crypto.randomUUID()
    const now = new Date()

    const [newTag] = await this.db
      .insert(tags)
      .values({
        id,
        userId: data.userId,
        name: data.name.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return this.mapToTag(newTag)
  }

  async update(id: string, data: UpdateTagData): Promise<Tag | null> {
    const updateValues: Partial<typeof tags.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) {
      updateValues.name = data.name.toLowerCase()
    }

    const result = await this.db
      .update(tags)
      .set(updateValues)
      .where(eq(tags.id, id))
      .returning()

    if (result.length === 0) {
      return null
    }

    return this.mapToTag(result[0])
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(tags).where(eq(tags.id, id))
    return result.rowCount > 0
  }

  private mapToTag(tag: typeof tags.$inferSelect): Tag {
    return {
      id: tag.id,
      userId: tag.userId,
      name: tag.name,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    }
  }
}
