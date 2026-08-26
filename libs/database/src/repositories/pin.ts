import { createHash } from 'node:crypto'
import type {
  CreatePinData,
  Pin,
  PinFilter,
  PinRepository,
  UpdatePinData,
} from '@pinsquirrel/domain'
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  like,
  inArray,
  isNull,
  or,
  sql,
} from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import { applyPagination } from './pagination.js'
import { escapeLikePattern, splitSearchTerms } from './search-terms.js'
import { pins } from '../schema/pins.js'
import { pinsTags } from '../schema/pins-tags.js'
import { tags } from '../schema/tags.js'
import type { Executor } from './executor.js'
import type { DrizzleTagRepository } from './tag.js'

function md5(input: string): string {
  return createHash('md5').update(input).digest('hex')
}

/**
 * The pin columns, listed explicitly because the tag-filtered queries join
 * other tables and `select()` would widen the row to the joined shape.
 */
const PIN_COLUMNS = {
  id: pins.id,
  userId: pins.userId,
  url: pins.url,
  urlHash: pins.urlHash,
  title: pins.title,
  description: pins.description,
  readLater: pins.readLater,
  isPrivate: pins.isPrivate,
  createdAt: pins.createdAt,
  updatedAt: pins.updatedAt,
}

export class DrizzlePinRepository implements PinRepository {
  /**
   * The tag dependency is the Drizzle class, not the `TagRepository`
   * interface: `create` and `update` write the pin and its tag links in one
   * transaction, and only the class exposes an upsert that accepts the
   * transaction handle. Keeping the handle off the domain interface is what
   * keeps `libs/domain` free of Drizzle.
   */
  constructor(
    private db: MySql2Database,
    private tagRepository: DrizzleTagRepository
  ) {}

  private getOrderBy(filter?: PinFilter) {
    const sortBy = filter?.sortBy || 'created'
    const sortDirection = filter?.sortDirection || 'desc'

    if (sortBy === 'title') {
      const lowerTitle = sql`LOWER(${pins.title})`
      return sortDirection === 'asc' ? asc(lowerTitle) : desc(lowerTitle)
    }
    return sortDirection === 'asc' ? asc(pins.createdAt) : desc(pins.createdAt)
  }

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

  /**
   * Does this pin carry a tag whose name matches the pattern?
   *
   * An `EXISTS` rather than a join: a join would repeat the pin once per
   * matching tag, which would inflate `countByUserId` and hand pagination
   * duplicate rows. The subquery's own `pins_tags` and `tags` shadow the ones
   * the tag-filter branches join on the outside; only `pins.id` is correlated.
   */
  private tagNameMatches(pattern: string) {
    return exists(
      this.db
        .select({ matched: sql`1` })
        .from(pinsTags)
        .innerJoin(tags, eq(pinsTags.tagId, tags.id))
        .where(and(eq(pinsTags.pinId, pins.id), like(tags.name, pattern)))
    )
  }

  /**
   * Conditions shared by every pin query for a user.
   *
   * `findByUserId` and `countByUserId` must agree exactly or a filtered list
   * paginates against the wrong total, so they build their WHERE clause here
   * rather than each maintaining its own copy.
   */
  private buildConditions(userId: string, filter?: PinFilter) {
    const conditions = [eq(pins.userId, userId)]

    if (filter?.readLater !== undefined) {
      conditions.push(eq(pins.readLater, filter.readLater))
    }

    if (filter?.isPrivate !== undefined) {
      conditions.push(eq(pins.isPrivate, filter.isPrivate))
    }

    if (filter?.url !== undefined) {
      conditions.push(eq(pins.url, filter.url))
    }

    if (filter?.search !== undefined) {
      // Every term must match (AND), each in any field (OR). Searching
      // `jesse elder` should find `jesseelder.com`, which the whole query as
      // one LIKE never could.
      for (const term of splitSearchTerms(filter.search)) {
        const pattern = `%${escapeLikePattern(term)}%`
        const termCondition = or(
          like(pins.url, pattern),
          like(pins.title, pattern),
          like(pins.description, pattern),
          this.tagNameMatches(pattern)
        )
        if (termCondition) {
          conditions.push(termCondition)
        }
      }
    }

    return conditions
  }

  async findByUserId(
    userId: string,
    filter?: PinFilter,
    options?: { limit?: number; offset?: number }
  ): Promise<Pin[]> {
    const conditions = this.buildConditions(userId, filter)
    const orderBy = this.getOrderBy(filter)

    // Each tag filter needs its own join, so the branches differ in shape
    // rather than just in a WHERE clause. `countByUserId` mirrors them exactly.
    const select = () => this.db.select(PIN_COLUMNS).from(pins).$dynamic()

    let query
    if (filter?.tag) {
      query = select()
        .innerJoin(pinsTags, eq(pins.id, pinsTags.pinId))
        .innerJoin(tags, eq(pinsTags.tagId, tags.id))
        .where(and(...conditions, eq(tags.name, filter.tag)))
    } else if (filter?.tagId) {
      query = select()
        .innerJoin(pinsTags, eq(pins.id, pinsTags.pinId))
        .where(and(...conditions, eq(pinsTags.tagId, filter.tagId)))
    } else if (filter?.noTags) {
      // LEFT JOIN + IS NULL: pins with no tag associations at all.
      query = select()
        .leftJoin(pinsTags, eq(pins.id, pinsTags.pinId))
        .where(and(...conditions, isNull(pinsTags.pinId)))
    } else {
      query = select().where(and(...conditions))
    }

    const results = await applyPagination(query.orderBy(orderBy), options)

    return this.mapPinsBulk(results)
  }

  async countByUserId(userId: string, filter?: PinFilter): Promise<number> {
    const conditions = this.buildConditions(userId, filter)

    // Mirrors the branches in findByUserId; only the projection differs.
    const select = () =>
      this.db.select({ count: count() }).from(pins).$dynamic()

    let query
    if (filter?.tag) {
      query = select()
        .innerJoin(pinsTags, eq(pins.id, pinsTags.pinId))
        .innerJoin(tags, eq(pinsTags.tagId, tags.id))
        .where(and(...conditions, eq(tags.name, filter.tag)))
    } else if (filter?.tagId) {
      query = select()
        .innerJoin(pinsTags, eq(pins.id, pinsTags.pinId))
        .where(and(...conditions, eq(pinsTags.tagId, filter.tagId)))
    } else if (filter?.noTags) {
      query = select()
        .leftJoin(pinsTags, eq(pins.id, pinsTags.pinId))
        .where(and(...conditions, isNull(pinsTags.pinId)))
    } else {
      query = select().where(and(...conditions))
    }

    const result = await query

    return result[0]?.count ?? 0
  }

  async findByUserIdAndUrl(userId: string, url: string): Promise<Pin | null> {
    const results = await this.findByUserId(userId, { url }, { limit: 1 })
    return results.length > 0 ? results[0] : null
  }

  /**
   * The pin row and its tag links are one unit of work — a failure part-way
   * through used to leave a pin with none of the tags it was saved with.
   */
  async create(data: CreatePinData): Promise<Pin> {
    const id = crypto.randomUUID()
    const now = new Date()

    return this.db.transaction(async tx => {
      await tx.insert(pins).values({
        id,
        userId: data.userId,
        url: data.url,
        urlHash: md5(data.url),
        title: data.title,
        description: data.description,
        readLater: data.readLater,
        isPrivate: data.isPrivate,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
      })

      const [newPin] = await tx
        .select()
        .from(pins)
        .where(eq(pins.id, id))
        .limit(1)

      // Handle tags if provided
      let pinTags: (typeof tags.$inferSelect)[] = []
      if (data.tagNames && data.tagNames.length > 0) {
        // Fetch or create tags
        const createdTags = await this.tagRepository.fetchOrCreateByNamesIn(
          tx,
          data.userId,
          data.tagNames
        )

        // Associate tags with pin
        if (createdTags.length > 0) {
          await tx.insert(pinsTags).values(
            createdTags.map(tag => ({
              pinId: id,
              tagId: tag.id,
            }))
          )
          pinTags = createdTags
        }
      }

      return this.mapToPin(newPin, pinTags)
    })
  }

  /**
   * As `create`: the pin row, the link delete and the link insert commit
   * together or not at all, so a failure cannot leave a pin whose old tags
   * were removed and whose new ones were never written.
   */
  async update(data: UpdatePinData): Promise<Pin | null> {
    const { id, ...updateFields } = data

    return this.db.transaction(async tx => {
      // Only the owner is needed here, to resolve tag names against the right
      // user. `findById` would also read the pin's tags, which are either
      // about to be replaced or re-read below.
      const [existing] = await tx
        .select({ userId: pins.userId })
        .from(pins)
        .where(eq(pins.id, id))
        .limit(1)
      if (!existing) {
        return null
      }

      const updateValues: Partial<typeof pins.$inferInsert> = {
        url: updateFields.url,
        title: updateFields.title,
        description: updateFields.description,
        readLater: updateFields.readLater,
        isPrivate: updateFields.isPrivate,
        updatedAt: new Date(),
      }

      // Update urlHash if url changed
      if (updateFields.url !== undefined) {
        updateValues.urlHash = md5(updateFields.url)
      }

      await tx.update(pins).set(updateValues).where(eq(pins.id, id))

      const [updatedPin] = await tx
        .select()
        .from(pins)
        .where(eq(pins.id, id))
        .limit(1)

      let pinTags: (typeof tags.$inferSelect)[]
      if (updateFields.tagNames !== undefined) {
        // Remove all existing tag associations
        await tx.delete(pinsTags).where(eq(pinsTags.pinId, id))

        // Add new tag associations
        if (updateFields.tagNames.length > 0) {
          const createdTags = await this.tagRepository.fetchOrCreateByNamesIn(
            tx,
            existing.userId,
            updateFields.tagNames
          )

          await tx.insert(pinsTags).values(
            createdTags.map(tag => ({
              pinId: id,
              tagId: tag.id,
            }))
          )

          pinTags = createdTags
        } else {
          pinTags = []
        }
      } else {
        // Tags were not part of the update, so the links already in the table
        // are the answer. Only read them in this branch: the other one knows
        // what the tags are without asking.
        pinTags = (await this.getPinTags([id], tx)).get(id) ?? []
      }

      return this.mapToPin(updatedPin, pinTags)
    })
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(pins).where(eq(pins.id, id))
    return result[0].affectedRows > 0
  }

  async updateCreatedAt(id: string, createdAt: Date): Promise<boolean> {
    const result = await this.db
      .update(pins)
      .set({ createdAt })
      .where(eq(pins.id, id))
    return result[0].affectedRows > 0
  }

  private async getPinTags(
    pinIds: string[],
    executor: Executor = this.db
  ): Promise<Map<string, (typeof tags.$inferSelect)[]>> {
    if (pinIds.length === 0) {
      return new Map()
    }

    const result = await executor
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
      isPrivate: pin.isPrivate,
      tagNames: pinTags.map(tag => tag.name),
      createdAt: pin.createdAt,
      updatedAt: pin.updatedAt,
    }
  }
}
