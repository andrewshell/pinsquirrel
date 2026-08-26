import {
  eq,
  and,
  inArray,
  count,
  isNull,
  like,
  notExists,
  or,
  sql,
} from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import type {
  Tag,
  TagRepository,
  CreateTagData,
  UpdateTagData,
  TagWithCount,
} from '@pinsquirrel/domain'
import { tags } from '../schema/tags.js'
import { pinsTags } from '../schema/pins-tags.js'
import { pins } from '../schema/pins.js'
import type { Executor } from './executor.js'
import { escapeLikePattern, splitSearchTerms } from './search-terms.js'

export class DrizzleTagRepository implements TagRepository {
  constructor(private db: MySql2Database) {}

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

    return result.map(tag => this.mapToTag(tag))
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

  /**
   * Tags whose name contains any search term, or all of them run together.
   *
   * Terms are OR'd here, unlike the pin search which ANDs them: a tag name is
   * one short string, so requiring every term to appear in it would answer
   * `jesse elder` with nothing at all. The concatenated pattern is what finds
   * the `jesseelder` a person writes as two words.
   */
  async searchByName(userId: string, search: string): Promise<Tag[]> {
    const terms = splitSearchTerms(search)
    if (terms.length === 0) {
      return []
    }

    const patterns = new Set(terms.map(term => `%${escapeLikePattern(term)}%`))
    if (terms.length > 1) {
      patterns.add(`%${terms.map(escapeLikePattern).join('')}%`)
    }

    const matches = Array.from(patterns, pattern => like(tags.name, pattern))

    const result = await this.db
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), or(...matches)))
      .orderBy(tags.name)

    return result.map(tag => this.mapToTag(tag))
  }

  async fetchOrCreateByNames(userId: string, names: string[]): Promise<Tag[]> {
    return this.fetchOrCreateByNamesIn(this.db, userId, names)
  }

  /**
   * `fetchOrCreateByNames`, run against a caller-supplied executor.
   *
   * `DrizzlePinRepository` writes a pin and its tag links as one unit of work,
   * so the tag upsert has to run on that transaction's handle — statements
   * issued on `this.db` would sit outside it and commit on their own. The
   * handle is a Drizzle type, which cannot appear on the `TagRepository`
   * interface (it lives in `libs/domain`, which has no external dependencies),
   * so this method stays on the Drizzle class and the pin repository depends
   * on the class rather than the interface.
   */
  async fetchOrCreateByNamesIn(
    executor: Executor,
    userId: string,
    names: string[]
  ): Promise<Tag[]> {
    if (names.length === 0) {
      return []
    }

    // Normalize to lowercase and remove duplicates from input
    const uniqueNames = Array.from(
      new Set(names.map(name => name.toLowerCase()))
    )

    // Find existing tags
    const existingTags = await executor
      .select()
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, uniqueNames)))

    const existingTagNames = new Set(existingTags.map(t => t.name))
    const tagsToCreate = uniqueNames.filter(name => !existingTagNames.has(name))

    // Create missing tags
    const createdTags: (typeof tags.$inferSelect)[] = []
    if (tagsToCreate.length > 0) {
      const now = new Date()
      const tagValues = tagsToCreate.map(name => ({
        id: crypto.randomUUID(),
        userId,
        name: name.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      }))

      // Two writers can pass the SELECT above at the same time and both try to
      // insert the same (user_id, name). `ON DUPLICATE KEY UPDATE id = id` makes
      // the loser a no-op instead of a duplicate-key error; the select below
      // then reads back whichever row actually won, by name rather than by the
      // id we generated (which may not be the stored one).
      await executor
        .insert(tags)
        .values(tagValues)
        .onDuplicateKeyUpdate({ set: { id: sql`id` } })

      const selected = await executor
        .select()
        .from(tags)
        .where(and(eq(tags.userId, userId), inArray(tags.name, tagsToCreate)))
      createdTags.push(...selected)
    }

    // Return all tags (existing + created)
    const allTags = [...existingTags, ...createdTags]

    // Sort by the order of the input names
    const nameToTag = new Map(allTags.map(tag => [tag.name, tag]))
    const sortedTags = uniqueNames
      .map(name => nameToTag.get(name))
      .filter((tag): tag is typeof tags.$inferSelect => tag !== undefined)

    return sortedTags.map(tag => this.mapToTag(tag))
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
  async create(data: CreateTagData): Promise<Tag> {
    const id = crypto.randomUUID()
    const now = new Date()

    await this.db.insert(tags).values({
      id,
      userId: data.userId,
      name: data.name.toLowerCase(),
      createdAt: now,
      updatedAt: now,
    })

    const [newTag] = await this.db
      .select()
      .from(tags)
      .where(eq(tags.id, id))
      .limit(1)

    return this.mapToTag(newTag)
  }

  async update(id: string, data: UpdateTagData): Promise<Tag | null> {
    const updateValues: Partial<typeof tags.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) {
      updateValues.name = data.name.toLowerCase()
    }

    await this.db.update(tags).set(updateValues).where(eq(tags.id, id))

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

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(tags).where(eq(tags.id, id))
    return result[0].affectedRows > 0
  }

  async mergeTags(
    userId: string,
    sourceTagIds: string[],
    destinationTagId: string
  ): Promise<void> {
    if (sourceTagIds.length === 0) {
      throw new Error('Source tag IDs cannot be empty')
    }

    // Verify all tags belong to the user and exist
    const allTagIds = [...sourceTagIds, destinationTagId]
    const existingTags = await this.db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.id, allTagIds)))

    const existingTagIds = new Set(existingTags.map(t => t.id))

    // Check if all required tags exist and belong to the user
    for (const tagId of allTagIds) {
      if (!existingTagIds.has(tagId)) {
        throw new Error(
          `Tag with ID ${tagId} not found or does not belong to user`
        )
      }
    }

    // Check if destination tag is in source tags
    if (sourceTagIds.includes(destinationTagId)) {
      throw new Error('Destination tag cannot be one of the source tags')
    }

    // Perform merge operation in a transaction.
    //
    // Three statements regardless of how many pins or source tags are
    // involved; the previous shape was a SELECT + INSERT per pin and a SELECT
    // per source tag, all inside the transaction.
    await this.db.transaction(async tx => {
      // Point every pin that carries a source tag at the destination tag.
      // pins_tags is keyed on (pin_id, tag_id), so IGNORE is what handles a pin
      // that already carries the destination.
      await tx.execute(sql`
        insert ignore into ${pinsTags} (pin_id, tag_id)
        select distinct ${pinsTags.pinId}, ${destinationTagId}
        from ${pinsTags}
        where ${inArray(pinsTags.tagId, sourceTagIds)}
      `)

      // Remove all associations with source tags
      await tx.delete(pinsTags).where(inArray(pinsTags.tagId, sourceTagIds))

      // Delete source tags that have no remaining pin associations. After the
      // delete above that is all of them, but the guard costs nothing and keeps
      // a tag that somehow gained a link mid-transaction.
      await tx.delete(tags).where(
        and(
          inArray(tags.id, sourceTagIds),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(pinsTags)
              .where(eq(pinsTags.tagId, tags.id))
          )
        )
      )
    })
  }

  async deleteTagsWithNoPins(userId: string): Promise<number> {
    return await this.db.transaction(async tx => {
      // Find all tags for the user that have no pin associations
      const tagsWithNoPins = await tx
        .select({ id: tags.id })
        .from(tags)
        .leftJoin(pinsTags, eq(tags.id, pinsTags.tagId))
        .where(and(eq(tags.userId, userId), isNull(pinsTags.tagId)))
        .groupBy(tags.id)

      if (tagsWithNoPins.length === 0) {
        return 0
      }

      const tagIdsToDelete = tagsWithNoPins.map(tag => tag.id)

      // Delete the tags
      const result = await tx
        .delete(tags)
        .where(and(eq(tags.userId, userId), inArray(tags.id, tagIdsToDelete)))

      return result[0].affectedRows
    })
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
