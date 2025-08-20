import { eq, and, count, desc, inArray } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type {
  Pin,
  PinRepository,
  PinFilter,
  CreatePinData,
  UpdatePinData,
  TagRepository,
} from '@pinsquirrel/core'
import { pins, pinsTags, tags } from '../schema/index.js'

export class DrizzlePinRepository implements PinRepository {
  constructor(
    private db: PostgresJsDatabase<Record<string, unknown>>,
    private tagRepository: TagRepository
  ) {}

  async findById(id: string): Promise<Pin | null> {
    const result = await this.db
      .select()
      .from(pins)
      .where(eq(pins.id, id))
      .limit(1)

    if (result.length === 0) {
      return null
    }

    const pin = result[0]
    const tagsByPinId = await this.getPinTags([pin.id])
    const pinTags = tagsByPinId.get(pin.id) || []

    return this.mapToPin(pin, pinTags)
  }

  async findByUserId(
    userId: string,
    filter?: PinFilter,
    options?: { limit?: number; offset?: number }
  ): Promise<Pin[]> {
    // Build query conditions
    const conditions = [eq(pins.userId, userId)]
    
    // Add readLater filter if specified
    if (filter?.readLater !== undefined) {
      conditions.push(eq(pins.readLater, filter.readLater))
    }
    
    // Add URL filter if specified (for findByUserIdAndUrl functionality)
    if (filter?.url !== undefined) {
      conditions.push(eq(pins.url, filter.url))
    }

    // If filtering by tag name, we need to join with tags
    if (filter?.tag) {
      const baseQuery = this.db
        .select({
          id: pins.id,
          userId: pins.userId,
          url: pins.url,
          title: pins.title,
          description: pins.description,
          readLater: pins.readLater,
          createdAt: pins.createdAt,
          updatedAt: pins.updatedAt,
        })
        .from(pins)
        .innerJoin(pinsTags, eq(pins.id, pinsTags.pinId))
        .innerJoin(tags, eq(pinsTags.tagId, tags.id))
        .where(
          and(
            ...conditions,
            eq(tags.name, filter.tag)
          )
        )
        .orderBy(desc(pins.createdAt))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = baseQuery as any
      if (options?.limit !== undefined && options?.offset !== undefined) {
        query = baseQuery.limit(options.limit).offset(options.offset)
      } else if (options?.limit !== undefined) {
        query = baseQuery.limit(options.limit)
      } else if (options?.offset !== undefined) {
        query = baseQuery.offset(options.offset)
      }

      const results = await query
      
      // Use mapPinsBulk to properly load tags for each pin
      return this.mapPinsBulk(results)
    }

    // If filtering by tag ID, we need to join with pinsTags
    if (filter?.tagId) {
      const baseQuery = this.db
        .select({
          id: pins.id,
          userId: pins.userId,
          url: pins.url,
          title: pins.title,
          description: pins.description,
          readLater: pins.readLater,
          createdAt: pins.createdAt,
          updatedAt: pins.updatedAt,
        })
        .from(pins)
        .innerJoin(pinsTags, eq(pins.id, pinsTags.pinId))
        .where(
          and(
            ...conditions,
            eq(pinsTags.tagId, filter.tagId)
          )
        )
        .orderBy(desc(pins.createdAt))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = baseQuery as any
      if (options?.limit !== undefined && options?.offset !== undefined) {
        query = baseQuery.limit(options.limit).offset(options.offset)
      } else if (options?.limit !== undefined) {
        query = baseQuery.limit(options.limit)
      } else if (options?.offset !== undefined) {
        query = baseQuery.offset(options.offset)
      }

      const results = await query
      
      // Use mapPinsBulk to properly load tags for each pin
      return this.mapPinsBulk(results)
    }

    // Standard query without tag filtering
    const baseQuery = this.db
      .select()
      .from(pins)
      .where(and(...conditions))
      .orderBy(desc(pins.createdAt))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = baseQuery as any
    if (options?.limit !== undefined && options?.offset !== undefined) {
      query = baseQuery.limit(options.limit).offset(options.offset)
    } else if (options?.limit !== undefined) {
      query = baseQuery.limit(options.limit)
    } else if (options?.offset !== undefined) {
      query = baseQuery.offset(options.offset)
    }

    const result = await query

    return this.mapPinsBulk(result)
  }


  async countByUserId(userId: string, filter?: PinFilter): Promise<number> {
    // Build query conditions
    const conditions = [eq(pins.userId, userId)]
    
    // Add readLater filter if specified
    if (filter?.readLater !== undefined) {
      conditions.push(eq(pins.readLater, filter.readLater))
    }
    
    // Add URL filter if specified
    if (filter?.url !== undefined) {
      conditions.push(eq(pins.url, filter.url))
    }

    // If filtering by tag name, we need to join with tags
    if (filter?.tag) {
      const result = await this.db
        .select({ count: count() })
        .from(pins)
        .innerJoin(pinsTags, eq(pins.id, pinsTags.pinId))
        .innerJoin(tags, eq(pinsTags.tagId, tags.id))
        .where(
          and(
            ...conditions,
            eq(tags.name, filter.tag)
          )
        )

      return result[0]?.count ?? 0
    }

    // If filtering by tag ID, we need to join with pinsTags
    if (filter?.tagId) {
      const result = await this.db
        .select({ count: count() })
        .from(pins)
        .innerJoin(pinsTags, eq(pins.id, pinsTags.pinId))
        .where(
          and(
            ...conditions,
            eq(pinsTags.tagId, filter.tagId)
          )
        )

      return result[0]?.count ?? 0
    }

    // Standard count without tag filtering
    const result = await this.db
      .select({ count: count() })
      .from(pins)
      .where(and(...conditions))

    return result[0]?.count ?? 0
  }


  async findByUserIdAndUrl(userId: string, url: string): Promise<Pin | null> {
    const results = await this.findByUserId(userId, { url }, { limit: 1 })
    return results.length > 0 ? results[0] : null
  }


  async create(data: CreatePinData): Promise<Pin> {
    const id = crypto.randomUUID()
    const now = new Date()

    const [newPin] = await this.db
      .insert(pins)
      .values({
        id,
        userId: data.userId,
        url: data.url,
        title: data.title,
        description: data.description ?? null,
        readLater: data.readLater ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    // Handle tags if provided
    let pinTags: (typeof tags.$inferSelect)[] = []
    if (data.tagNames && data.tagNames.length > 0) {
      // Fetch or create tags
      const createdTags = await this.tagRepository.fetchOrCreateByNames(
        data.userId,
        data.tagNames
      )

      // Associate tags with pin
      if (createdTags.length > 0) {
        await this.db.insert(pinsTags).values(
          createdTags.map(tag => ({
            pinId: id,
            tagId: tag.id,
          }))
        )
        pinTags = createdTags.map(tag => ({
          id: tag.id,
          userId: tag.userId,
          name: tag.name,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        }))
      }
    }

    return this.mapToPin(newPin, pinTags)
  }

  async update(id: string, data: UpdatePinData): Promise<Pin | null> {
    const existing = await this.findById(id)
    if (!existing) {
      return null
    }

    const updateValues: Partial<typeof pins.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (data.url !== undefined) updateValues.url = data.url
    if (data.title !== undefined) updateValues.title = data.title
    if (data.description !== undefined)
      updateValues.description = data.description
    if (data.readLater !== undefined) updateValues.readLater = data.readLater

    const [updatedPin] = await this.db
      .update(pins)
      .set(updateValues)
      .where(eq(pins.id, id))
      .returning()

    // Handle tag updates if provided
    const tagsByPinId = await this.getPinTags([id])
    let pinTags = tagsByPinId.get(id) || []
    if (data.tagNames !== undefined) {
      // Remove all existing tag associations
      await this.db.delete(pinsTags).where(eq(pinsTags.pinId, id))

      // Add new tag associations
      if (data.tagNames.length > 0) {
        const createdTags = await this.tagRepository.fetchOrCreateByNames(
          existing.userId,
          data.tagNames
        )

        await this.db.insert(pinsTags).values(
          createdTags.map(tag => ({
            pinId: id,
            tagId: tag.id,
          }))
        )

        pinTags = createdTags.map(tag => ({
          id: tag.id,
          userId: tag.userId,
          name: tag.name,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        }))
      } else {
        pinTags = []
      }
    }

    return this.mapToPin(updatedPin, pinTags)
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(pins).where(eq(pins.id, id))
    return result.rowCount > 0
  }

  private async getPinTags(
    pinIds: string[]
  ): Promise<Map<string, (typeof tags.$inferSelect)[]>> {
    if (pinIds.length === 0) {
      return new Map()
    }

    const result = await this.db
      .select({
        pinId: pinsTags.pinId,
        tag: tags,
      })
      .from(pinsTags)
      .innerJoin(tags, eq(pinsTags.tagId, tags.id))
      .where(inArray(pinsTags.pinId, pinIds))

    const tagsByPinId = new Map<string, (typeof tags.$inferSelect)[]>()

    for (const row of result) {
      const existing = tagsByPinId.get(row.pinId) || []
      existing.push(row.tag)
      tagsByPinId.set(row.pinId, existing)
    }

    return tagsByPinId
  }

  private async mapPinsBulk(
    pinsData: (typeof pins.$inferSelect)[]
  ): Promise<Pin[]> {
    if (pinsData.length === 0) {
      return []
    }

    const pinIds = pinsData.map((pin: typeof pins.$inferSelect) => pin.id)
    const tagsByPinId = await this.getPinTags(pinIds)

    return pinsData.map((pin: typeof pins.$inferSelect) => {
      const pinTags = tagsByPinId.get(pin.id) || []
      return this.mapToPin(pin, pinTags)
    })
  }


  private mapToPin(
    pin: typeof pins.$inferSelect,
    pinTags: (typeof tags.$inferSelect)[]
  ): Pin {
    return {
      id: pin.id,
      userId: pin.userId,
      url: pin.url,
      title: pin.title,
      description: pin.description,
      readLater: pin.readLater,
      tags: pinTags.map(tag => ({
        id: tag.id,
        userId: tag.userId,
        name: tag.name,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      })),
      createdAt: pin.createdAt,
      updatedAt: pin.updatedAt,
    }
  }
}
