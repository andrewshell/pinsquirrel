import { eq, and, count, desc } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type {
  Pin,
  PinRepository,
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
    const pinTags = await this.getPinTags(pin.id)

    return this.mapToPin(pin, pinTags)
  }

  async findByUserId(userId: string, options?: { limit?: number; offset?: number }): Promise<Pin[]> {
    const baseQuery = this.db
      .select()
      .from(pins)
      .where(eq(pins.userId, userId))
      .orderBy(desc(pins.createdAt))

    let query
    if (options?.limit !== undefined && options?.offset !== undefined) {
      query = baseQuery.limit(options.limit).offset(options.offset)
    } else if (options?.limit !== undefined) {
      query = baseQuery.limit(options.limit)
    } else if (options?.offset !== undefined) {
      query = baseQuery.offset(options.offset)
    } else {
      query = baseQuery
    }

    const result = await query

    return Promise.all(
      result.map(async pin => {
        const pinTags = await this.getPinTags(pin.id)
        return this.mapToPin(pin, pinTags)
      })
    )
  }

  async countByUserId(userId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(pins)
      .where(eq(pins.userId, userId))

    return result[0]?.count ?? 0
  }

  async findByUserIdAndTag(userId: string, tagId: string): Promise<Pin[]> {
    const result = await this.db
      .select({
        pin: pins,
      })
      .from(pins)
      .innerJoin(pinsTags, eq(pins.id, pinsTags.pinId))
      .where(and(eq(pins.userId, userId), eq(pinsTags.tagId, tagId)))
      .orderBy(desc(pins.createdAt))

    const uniquePins = Array.from(
      new Map(result.map(r => [r.pin.id, r.pin])).values()
    )

    return Promise.all(
      uniquePins.map(async pin => {
        const pinTags = await this.getPinTags(pin.id)
        return this.mapToPin(pin, pinTags)
      })
    )
  }

  async findByUserIdAndReadLater(
    userId: string,
    readLater: boolean
  ): Promise<Pin[]> {
    const result = await this.db
      .select()
      .from(pins)
      .where(and(eq(pins.userId, userId), eq(pins.readLater, readLater)))
      .orderBy(desc(pins.createdAt))

    return Promise.all(
      result.map(async pin => {
        const pinTags = await this.getPinTags(pin.id)
        return this.mapToPin(pin, pinTags)
      })
    )
  }

  async findByUserIdAndUrl(userId: string, url: string): Promise<Pin | null> {
    const result = await this.db
      .select()
      .from(pins)
      .where(and(eq(pins.userId, userId), eq(pins.url, url)))
      .limit(1)

    if (result.length === 0) {
      return null
    }

    const pin = result[0]
    const pinTags = await this.getPinTags(pin.id)

    return this.mapToPin(pin, pinTags)
  }

  async findAll(): Promise<Pin[]> {
    const result = await this.db.select().from(pins).orderBy(desc(pins.createdAt))

    return Promise.all(
      result.map(async pin => {
        const pinTags = await this.getPinTags(pin.id)
        return this.mapToPin(pin, pinTags)
      })
    )
  }

  async list(limit?: number, offset?: number): Promise<Pin[]> {
    const baseQuery = this.db.select().from(pins).orderBy(desc(pins.createdAt))

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

    return Promise.all(
      result.map(async pin => {
        const pinTags = await this.getPinTags(pin.id)
        return this.mapToPin(pin, pinTags)
      })
    )
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
        contentPath: data.contentPath ?? null,
        imagePath: data.imagePath ?? null,
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
    if (data.contentPath !== undefined)
      updateValues.contentPath = data.contentPath
    if (data.imagePath !== undefined) updateValues.imagePath = data.imagePath

    const [updatedPin] = await this.db
      .update(pins)
      .set(updateValues)
      .where(eq(pins.id, id))
      .returning()

    // Handle tag updates if provided
    let pinTags = await this.getPinTags(id)
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
    pinId: string
  ): Promise<(typeof tags.$inferSelect)[]> {
    const result = await this.db
      .select({
        tag: tags,
      })
      .from(pinsTags)
      .innerJoin(tags, eq(pinsTags.tagId, tags.id))
      .where(eq(pinsTags.pinId, pinId))

    return result.map(r => r.tag)
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
      contentPath: pin.contentPath,
      imagePath: pin.imagePath,
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
