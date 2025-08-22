import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { DrizzleTagRepository } from './tag-repository.js'
import { DrizzleUserRepository } from './user-repository.js'
import { db } from '../client.js'
import type { User } from '@pinsquirrel/core'

describe('DrizzleTagRepository - Integration Tests', () => {
  let testDb: typeof db
  let testPool: Pool
  let tagRepository: DrizzleTagRepository
  let userRepository: DrizzleUserRepository
  let testUser: User

  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'postgresql://pinsquirrel:pinsquirrel@localhost:5432/pinsquirrel_test'

  beforeAll(async () => {
    // Create test database connection
    testPool = new Pool({
      connectionString: TEST_DATABASE_URL,
    })

    // Import the schema and create test database connection
    const schema = await import('../schema/index.js')
    testDb = drizzle(testPool, { schema }) as typeof db

    // Create repositories
    userRepository = new DrizzleUserRepository(testDb)
    tagRepository = new DrizzleTagRepository(testDb)
  })

  afterAll(async () => {
    await testPool.end()
  })

  beforeEach(async () => {
    // Clean up any existing test data (respecting foreign key constraints)
    await testPool.query('DELETE FROM pins_tags')
    await testPool.query('DELETE FROM pins')
    await testPool.query('DELETE FROM password_reset_tokens')
    await testPool.query('DELETE FROM tags')
    await testPool.query('DELETE FROM users')

    // Create a unique test user for each test
    testUser = await userRepository.create({
      username: `testuser-${crypto.randomUUID().slice(0, 8)}`,
      passwordHash: 'hashed_password',
    })
  })

  describe('findById', () => {
    it('should find tag by id', async () => {
      const testTagId = crypto.randomUUID()

      // Insert test tag
      await testPool.query(
        `
        INSERT INTO tags (id, user_id, name, created_at, updated_at)
        VALUES ($2, $1, 'test-tag', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [testUser.id, testTagId]
      )

      const result = await tagRepository.findById(testTagId)

      expect(result).not.toBeNull()
      expect(result!.id).toBe(testTagId)
      expect(result!.userId).toBe(testUser.id)
      expect(result!.name).toBe('test-tag')
    })

    it('should return null when tag not found', async () => {
      const result = await tagRepository.findById('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('findByUserId', () => {
    it('should find all tags for a user', async () => {
      // Create another user to ensure we only get tags for the correct user
      const otherUser = await userRepository.create({
        username: `otheruser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'password',
      })

      const tag1Id = crypto.randomUUID()
      const tag2Id = crypto.randomUUID()
      const tag3Id = crypto.randomUUID()

      // Create tags for test user
      await testPool.query(
        `
        INSERT INTO tags (id, user_id, name, created_at, updated_at) VALUES
        ($2, $1, 'tag1', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
        ($3, $1, 'tag2', '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z')
      `,
        [testUser.id, tag1Id, tag2Id]
      )

      // Create tag for other user
      await testPool.query(
        `
        INSERT INTO tags (id, user_id, name, created_at, updated_at) VALUES
        ($2, $1, 'tag3', '2023-01-03T00:00:00Z', '2023-01-03T00:00:00Z')
      `,
        [otherUser.id, tag3Id]
      )

      const result = await tagRepository.findByUserId(testUser.id)

      expect(result).toHaveLength(2)
      expect(result.find(t => t.name === 'tag1')).toBeDefined()
      expect(result.find(t => t.name === 'tag2')).toBeDefined()
      expect(result.find(t => t.name === 'tag3')).toBeUndefined()
    })

    it('should return empty array when user has no tags', async () => {
      const result = await tagRepository.findByUserId(testUser.id)
      expect(result).toEqual([])
    })
  })

  describe('findByUserIdAndName', () => {
    it('should find tag by user and name', async () => {
      const tagId = crypto.randomUUID()
      const tagName = `specific-tag-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO tags (id, user_id, name, created_at, updated_at)
        VALUES ($2, $1, $3, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [testUser.id, tagId, tagName]
      )

      const result = await tagRepository.findByUserIdAndName(
        testUser.id,
        tagName
      )

      expect(result).not.toBeNull()
      expect(result!.name).toBe(tagName)
    })

    it('should return null when tag not found', async () => {
      const result = await tagRepository.findByUserIdAndName(
        testUser.id,
        'nonexistent'
      )
      expect(result).toBeNull()
    })

    it('should not find tag from different user', async () => {
      const otherUser = await userRepository.create({
        username: `otheruser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'password',
      })

      const tagId = crypto.randomUUID()
      const tagName = `shared-name-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO tags (id, user_id, name, created_at, updated_at)
        VALUES ($2, $1, $3, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [otherUser.id, tagId, tagName]
      )

      const result = await tagRepository.findByUserIdAndName(
        testUser.id,
        tagName
      )
      expect(result).toBeNull()
    })

    it('should find tag by case-insensitive name search', async () => {
      const tagId = crypto.randomUUID()
      const tagName = `mixed-case-tag-${crypto.randomUUID().slice(0, 8)}`

      await testPool.query(
        `
        INSERT INTO tags (id, user_id, name, created_at, updated_at)
        VALUES ($2, $1, $3, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [testUser.id, tagId, tagName.toLowerCase()]
      )

      const result = await tagRepository.findByUserIdAndName(
        testUser.id,
        tagName.toUpperCase()
      )

      expect(result).not.toBeNull()
      expect(result!.name).toBe(tagName.toLowerCase())
    })
  })

  describe('fetchOrCreateByNames', () => {
    it('should create new tags when they do not exist', async () => {
      const result = await tagRepository.fetchOrCreateByNames(testUser.id, [
        'new-tag-1',
        'new-tag-2',
      ])

      expect(result).toHaveLength(2)
      expect(result.find(t => t.name === 'new-tag-1')).toBeDefined()
      expect(result.find(t => t.name === 'new-tag-2')).toBeDefined()

      // Verify they were saved
      const saved1 = await tagRepository.findByUserIdAndName(
        testUser.id,
        'new-tag-1'
      )
      const saved2 = await tagRepository.findByUserIdAndName(
        testUser.id,
        'new-tag-2'
      )
      expect(saved1).not.toBeNull()
      expect(saved2).not.toBeNull()
    })

    it('should return existing tags without creating duplicates', async () => {
      // Create existing tag
      const existing = await tagRepository.create({
        userId: testUser.id,
        name: 'existing-tag',
      })

      const result = await tagRepository.fetchOrCreateByNames(testUser.id, [
        'existing-tag',
        'new-tag',
      ])

      expect(result).toHaveLength(2)

      const existingResult = result.find(t => t.name === 'existing-tag')
      const newResult = result.find(t => t.name === 'new-tag')

      expect(existingResult).toBeDefined()
      expect(existingResult!.id).toBe(existing.id)
      expect(newResult).toBeDefined()

      // Verify no duplicate was created
      const allTags = await tagRepository.findByUserId(testUser.id)
      expect(allTags).toHaveLength(2)
    })

    it('should handle empty array', async () => {
      const result = await tagRepository.fetchOrCreateByNames(testUser.id, [])
      expect(result).toEqual([])
    })

    it('should handle duplicate names in input', async () => {
      const result = await tagRepository.fetchOrCreateByNames(testUser.id, [
        'tag1',
        'tag1',
        'tag2',
      ])

      expect(result).toHaveLength(2)
      expect(result.find(t => t.name === 'tag1')).toBeDefined()
      expect(result.find(t => t.name === 'tag2')).toBeDefined()
    })
  })

  describe('create', () => {
    it('should create tag', async () => {
      const createData = {
        userId: testUser.id,
        name: 'new-tag',
      }

      const result = await tagRepository.create(createData)

      expect(result.userId).toBe(testUser.id)
      expect(result.name).toBe('new-tag')
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)

      // Verify it was saved
      const saved = await tagRepository.findById(result.id)
      expect(saved).toEqual(result)
    })

    it('should create tag with normalized lowercase name', async () => {
      const createData = {
        userId: testUser.id,
        name: 'UPPERCASE-Tag',
      }
      const result = await tagRepository.create(createData)
      expect(result.name).toBe('uppercase-tag')
    })
  })

  describe('update', () => {
    let existingTagId: string

    beforeEach(async () => {
      // Create a tag to update
      const tag = await tagRepository.create({
        userId: testUser.id,
        name: 'original-name',
      })
      existingTagId = tag.id
    })

    it('should update tag name', async () => {
      const updateData = {
        name: 'updated-name',
      }

      const result = await tagRepository.update(existingTagId, updateData)

      expect(result).not.toBeNull()
      expect(result!.name).toBe('updated-name')

      // Verify it was updated in database
      const updated = await tagRepository.findById(existingTagId)
      expect(updated!.name).toBe('updated-name')
    })

    it('should update only updatedAt when no fields provided', async () => {
      const originalTag = await tagRepository.findById(existingTagId)
      const updateData = {}

      // Wait a bit to ensure updatedAt changes
      await new Promise(resolve => setTimeout(resolve, 10))

      const result = await tagRepository.update(existingTagId, updateData)

      expect(result!.name).toBe(originalTag!.name)
      expect(result!.updatedAt.getTime()).toBeGreaterThan(
        originalTag!.updatedAt.getTime()
      )
    })

    it('should return null when tag not found', async () => {
      const result = await tagRepository.update('nonexistent-id', {
        name: 'new-name',
      })
      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('should delete tag and return true', async () => {
      const tag = await tagRepository.create({
        userId: testUser.id,
        name: 'tag-to-delete',
      })

      const result = await tagRepository.delete(tag.id)

      expect(result).toBe(true)

      // Verify it was deleted
      const deleted = await tagRepository.findById(tag.id)
      expect(deleted).toBeNull()
    })

    it('should return false when tag does not exist', async () => {
      const result = await tagRepository.delete('nonexistent-id')
      expect(result).toBe(false)
    })
  })

  describe('findAll', () => {
    it('should return all tags', async () => {
      const tag1Name = `tag1-${crypto.randomUUID().slice(0, 8)}`
      const tag2Name = `tag2-${crypto.randomUUID().slice(0, 8)}`

      const tag1 = await tagRepository.create({
        userId: testUser.id,
        name: tag1Name,
      })
      const tag2 = await tagRepository.create({
        userId: testUser.id,
        name: tag2Name,
      })

      const result = await tagRepository.findAll()

      // Find our specific tags in the results
      const ourTag1 = result.find(t => t.id === tag1.id)
      const ourTag2 = result.find(t => t.id === tag2.id)

      expect(ourTag1).toBeDefined()
      expect(ourTag2).toBeDefined()
      expect(ourTag1!.name).toBe(tag1Name)
      expect(ourTag2!.name).toBe(tag2Name)
    })
  })

  describe('list', () => {
    it('should return tags with limit', async () => {
      // Create some test tags for this user
      for (let i = 1; i <= 5; i++) {
        await tagRepository.create({
          userId: testUser.id,
          name: `tag${i}-${crypto.randomUUID().slice(0, 8)}`,
        })
      }

      const result = await tagRepository.list(3)
      expect(result.length).toBeGreaterThanOrEqual(3)
    })

    it('should return tags with offset', async () => {
      // Create some test tags for this user
      for (let i = 1; i <= 5; i++) {
        await tagRepository.create({
          userId: testUser.id,
          name: `tag${i}-${crypto.randomUUID().slice(0, 8)}`,
        })
      }

      const result = await tagRepository.list(undefined, 2)
      expect(result.length).toBeGreaterThanOrEqual(3)
    })

    it('should return tags with both limit and offset', async () => {
      // Create some test tags for this user
      for (let i = 1; i <= 5; i++) {
        await tagRepository.create({
          userId: testUser.id,
          name: `tag${i}-${crypto.randomUUID().slice(0, 8)}`,
        })
      }

      const result = await tagRepository.list(2, 2)
      expect(result).toHaveLength(2)
    })

    it('should return all tags when no limit or offset provided', async () => {
      // Create some test tags for this user
      for (let i = 1; i <= 3; i++) {
        await tagRepository.create({
          userId: testUser.id,
          name: `tag${i}-${crypto.randomUUID().slice(0, 8)}`,
        })
      }

      const result = await tagRepository.list()
      expect(result.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('findByUserIdWithPinCount', () => {
    it('should return tags with pin counts', async () => {
      // Create tags
      const tag1 = await tagRepository.create({
        userId: testUser.id,
        name: 'tag1',
      })
      const tag2 = await tagRepository.create({
        userId: testUser.id,
        name: 'tag2',
      })
      const tag3 = await tagRepository.create({
        userId: testUser.id,
        name: 'tag3',
      })

      // Create pins and associate with tags
      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, created_at, updated_at) VALUES
        ('pin1', $1, 'https://example.com/1', 'Pin 1', NOW(), NOW()),
        ('pin2', $1, 'https://example.com/2', 'Pin 2', NOW(), NOW()),
        ('pin3', $1, 'https://example.com/3', 'Pin 3', NOW(), NOW()),
        ('pin4', $1, 'https://example.com/4', 'Pin 4', NOW(), NOW())
      `,
        [testUser.id]
      )

      // Associate pins with tags
      await testPool.query(
        `
        INSERT INTO pins_tags (pin_id, tag_id) VALUES
        ('pin1', $1),
        ('pin2', $1),
        ('pin3', $1),
        ('pin1', $2),
        ('pin2', $2),
        ('pin4', $3)
      `,
        [tag1.id, tag2.id, tag3.id]
      )

      const result = await tagRepository.findByUserIdWithPinCount(testUser.id)

      expect(result).toHaveLength(3)

      // Results should be sorted alphabetically
      expect(result[0].name).toBe('tag1')
      expect(result[1].name).toBe('tag2')
      expect(result[2].name).toBe('tag3')

      // Check pin counts
      expect(result[0].pinCount).toBe(3) // tag1 has pins 1, 2, 3
      expect(result[1].pinCount).toBe(2) // tag2 has pins 1, 2
      expect(result[2].pinCount).toBe(1) // tag3 has pin 4
    })

    it('should return tags with zero pin count when no pins associated', async () => {
      await tagRepository.create({
        userId: testUser.id,
        name: 'lonely-tag',
      })

      const result = await tagRepository.findByUserIdWithPinCount(testUser.id)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('lonely-tag')
      expect(result[0].pinCount).toBe(0)
    })

    it('should return empty array when user has no tags', async () => {
      const result = await tagRepository.findByUserIdWithPinCount(testUser.id)
      expect(result).toHaveLength(0)
    })

    it('should only return tags for the specified user', async () => {
      // Create another user
      const otherUser = await userRepository.create({
        username: `otheruser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'hashed_password',
        hashedEmail: 'other@example.com',
      })

      // Create tags for both users
      await tagRepository.create({
        userId: testUser.id,
        name: 'user1-tag',
      })
      await tagRepository.create({
        userId: otherUser.id,
        name: 'user2-tag',
      })

      const result = await tagRepository.findByUserIdWithPinCount(testUser.id)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('user1-tag')
      expect(result[0].userId).toBe(testUser.id)
    })
  })

  describe('mergeTags', () => {
    it('should merge multiple tags into destination tag', async () => {
      // Create test tags
      const sourceTag1 = await tagRepository.create({
        userId: testUser.id,
        name: 'source-tag-1',
      })
      const sourceTag2 = await tagRepository.create({
        userId: testUser.id,
        name: 'source-tag-2',
      })
      const destinationTag = await tagRepository.create({
        userId: testUser.id,
        name: 'destination-tag',
      })

      // Create test pins and associate them with source tags
      const pin1Id = crypto.randomUUID()
      const pin2Id = crypto.randomUUID()
      const pin3Id = crypto.randomUUID()

      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, description, read_later, created_at, updated_at) VALUES
        ($1, $2, 'https://example1.com', 'Pin 1', 'Description 1', false, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
        ($3, $2, 'https://example2.com', 'Pin 2', 'Description 2', false, '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z'),
        ($4, $2, 'https://example3.com', 'Pin 3', 'Description 3', false, '2023-01-03T00:00:00Z', '2023-01-03T00:00:00Z')
      `,
        [pin1Id, testUser.id, pin2Id, pin3Id]
      )

      // Associate pins with source tags
      await testPool.query(
        `
        INSERT INTO pins_tags (pin_id, tag_id) VALUES
        ($1, $2),
        ($1, $3),
        ($4, $2),
        ($5, $3)
      `,
        [pin1Id, sourceTag1.id, sourceTag2.id, pin2Id, pin3Id]
      )

      // Perform merge
      await tagRepository.mergeTags(
        testUser.id,
        [sourceTag1.id, sourceTag2.id],
        destinationTag.id
      )

      // Verify pins now have destination tag
      const pinTagAssociations = await testPool.query(
        'SELECT pin_id, tag_id FROM pins_tags WHERE tag_id = $1 ORDER BY pin_id',
        [destinationTag.id]
      )

      expect(pinTagAssociations.rows).toHaveLength(3)
      expect(
        pinTagAssociations.rows.map((r: { pin_id: string }) => r.pin_id)
      ).toEqual(expect.arrayContaining([pin1Id, pin2Id, pin3Id]))

      // Verify source tags no longer have pin associations
      const sourceTagAssociations = await testPool.query(
        'SELECT pin_id FROM pins_tags WHERE tag_id = ANY($1)',
        [[sourceTag1.id, sourceTag2.id]]
      )

      expect(sourceTagAssociations.rows).toHaveLength(0)

      // Verify source tags are deleted (they had no remaining associations)
      const remainingTags = await tagRepository.findByUserId(testUser.id)
      expect(remainingTags).toHaveLength(1)
      expect(remainingTags[0].id).toBe(destinationTag.id)
    })

    it('should handle pins that already have destination tag', async () => {
      // Create test tags
      const sourceTag = await tagRepository.create({
        userId: testUser.id,
        name: 'source-tag',
      })
      const destinationTag = await tagRepository.create({
        userId: testUser.id,
        name: 'destination-tag',
      })

      // Create test pin
      const pinId = crypto.randomUUID()

      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, description, read_later, created_at, updated_at) VALUES
        ($1, $2, 'https://example.com', 'Pin 1', 'Description 1', false, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [pinId, testUser.id]
      )

      // Associate pin with both source and destination tags
      await testPool.query(
        `
        INSERT INTO pins_tags (pin_id, tag_id) VALUES
        ($1, $2),
        ($1, $3)
      `,
        [pinId, sourceTag.id, destinationTag.id]
      )

      // Perform merge
      await tagRepository.mergeTags(
        testUser.id,
        [sourceTag.id],
        destinationTag.id
      )

      // Verify pin still has only one association with destination tag (no duplicates)
      const pinTagAssociations = await testPool.query(
        'SELECT tag_id FROM pins_tags WHERE pin_id = $1',
        [pinId]
      )

      expect(pinTagAssociations.rows).toHaveLength(1)
      expect(pinTagAssociations.rows[0].tag_id).toBe(destinationTag.id)

      // Verify source tag is deleted
      const remainingTags = await tagRepository.findByUserId(testUser.id)
      expect(remainingTags).toHaveLength(1)
      expect(remainingTags[0].id).toBe(destinationTag.id)
    })

    it('should throw error if source tags are empty', async () => {
      const destinationTag = await tagRepository.create({
        userId: testUser.id,
        name: 'destination-tag',
      })

      await expect(
        tagRepository.mergeTags(testUser.id, [], destinationTag.id)
      ).rejects.toThrow('Source tag IDs cannot be empty')
    })

    it('should throw error if destination tag is in source tags', async () => {
      const tag1 = await tagRepository.create({
        userId: testUser.id,
        name: 'tag-1',
      })
      const tag2 = await tagRepository.create({
        userId: testUser.id,
        name: 'tag-2',
      })

      await expect(
        tagRepository.mergeTags(testUser.id, [tag1.id, tag2.id], tag1.id)
      ).rejects.toThrow('Destination tag cannot be one of the source tags')
    })

    it('should throw error if tag does not exist or does not belong to user', async () => {
      // Create another user
      const otherUser = await userRepository.create({
        username: `otheruser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'hashed_password',
        hashedEmail: 'other@example.com',
      })

      const otherUserTag = await tagRepository.create({
        userId: otherUser.id,
        name: 'other-user-tag',
      })

      const testUserTag = await tagRepository.create({
        userId: testUser.id,
        name: 'test-user-tag',
      })

      // Try to merge with tag from another user
      await expect(
        tagRepository.mergeTags(testUser.id, [otherUserTag.id], testUserTag.id)
      ).rejects.toThrow(
        `Tag with ID ${otherUserTag.id} not found or does not belong to user`
      )

      // Try to merge with nonexistent tag
      const nonexistentTagId = crypto.randomUUID()
      await expect(
        tagRepository.mergeTags(testUser.id, [testUserTag.id], nonexistentTagId)
      ).rejects.toThrow(
        `Tag with ID ${nonexistentTagId} not found or does not belong to user`
      )
    })

    it('should keep source tag if it has other pin associations not being merged', async () => {
      // This test creates a more complex scenario where some pins have multiple tags
      // and source tags might have pins that also have other tags not involved in the merge

      const sourceTag = await tagRepository.create({
        userId: testUser.id,
        name: 'source-tag',
      })
      const destinationTag = await tagRepository.create({
        userId: testUser.id,
        name: 'destination-tag',
      })
      const unrelatedTag = await tagRepository.create({
        userId: testUser.id,
        name: 'unrelated-tag',
      })

      // Create test pins
      const pin1Id = crypto.randomUUID() // Has sourceTag only
      const pin2Id = crypto.randomUUID() // Has sourceTag + unrelatedTag (sourceTag should be deleted)

      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, description, read_later, created_at, updated_at) VALUES
        ($1, $2, 'https://example1.com', 'Pin 1', 'Description 1', false, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
        ($3, $2, 'https://example2.com', 'Pin 2', 'Description 2', false, '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z')
      `,
        [pin1Id, testUser.id, pin2Id]
      )

      // Associate pins with tags
      await testPool.query(
        `
        INSERT INTO pins_tags (pin_id, tag_id) VALUES
        ($1, $2),
        ($3, $2),
        ($3, $4)
      `,
        [pin1Id, sourceTag.id, pin2Id, unrelatedTag.id]
      )

      // Perform merge
      await tagRepository.mergeTags(
        testUser.id,
        [sourceTag.id],
        destinationTag.id
      )

      // Verify all pins now have destination tag
      const destinationTagAssociations = await testPool.query(
        'SELECT pin_id FROM pins_tags WHERE tag_id = $1 ORDER BY pin_id',
        [destinationTag.id]
      )

      expect(destinationTagAssociations.rows).toHaveLength(2)
      expect(
        destinationTagAssociations.rows.map((r: { pin_id: string }) => r.pin_id)
      ).toEqual(expect.arrayContaining([pin1Id, pin2Id]))

      // Verify source tag is deleted since it has no remaining associations
      const remainingTags = await tagRepository.findByUserId(testUser.id)
      expect(remainingTags).toHaveLength(2) // destinationTag + unrelatedTag
      expect(remainingTags.find(t => t.id === destinationTag.id)).toBeDefined()
      expect(remainingTags.find(t => t.id === unrelatedTag.id)).toBeDefined()
      expect(remainingTags.find(t => t.id === sourceTag.id)).toBeUndefined()

      // Verify pin2 still has unrelatedTag
      const pin2Associations = await testPool.query(
        'SELECT tag_id FROM pins_tags WHERE pin_id = $1',
        [pin2Id]
      )

      expect(pin2Associations.rows).toHaveLength(2)
      expect(
        pin2Associations.rows.map((r: { tag_id: string }) => r.tag_id)
      ).toEqual(expect.arrayContaining([destinationTag.id, unrelatedTag.id]))
    })
  })

  describe('deleteTagsWithNoPins', () => {
    it('should delete tags with no pin associations', async () => {
      // Create tags - some with pins, some without
      const tagWithPins = await tagRepository.create({
        userId: testUser.id,
        name: 'tag-with-pins',
      })
      await tagRepository.create({
        userId: testUser.id,
        name: 'empty-tag-1',
      })
      await tagRepository.create({
        userId: testUser.id,
        name: 'empty-tag-2',
      })

      // Create a pin and associate it with tagWithPins
      const pinId = crypto.randomUUID()
      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, description, read_later, created_at, updated_at) VALUES
        ($1, $2, 'https://example.com', 'Test Pin', 'Description', false, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [pinId, testUser.id]
      )

      await testPool.query(
        `
        INSERT INTO pins_tags (pin_id, tag_id) VALUES ($1, $2)
      `,
        [pinId, tagWithPins.id]
      )

      // Verify initial state
      const allTagsBefore = await tagRepository.findByUserId(testUser.id)
      expect(allTagsBefore).toHaveLength(3)

      // Delete tags with no pins
      const deletedCount = await tagRepository.deleteTagsWithNoPins(testUser.id)

      expect(deletedCount).toBe(2)

      // Verify only tag with pins remains
      const remainingTags = await tagRepository.findByUserId(testUser.id)
      expect(remainingTags).toHaveLength(1)
      expect(remainingTags[0].id).toBe(tagWithPins.id)
      expect(remainingTags[0].name).toBe('tag-with-pins')
    })

    it('should return 0 when no tags need deletion', async () => {
      // Create tag with pins
      const tag = await tagRepository.create({
        userId: testUser.id,
        name: 'tag-with-pins',
      })

      // Create a pin and associate it with tag
      const pinId = crypto.randomUUID()
      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, description, read_later, created_at, updated_at) VALUES
        ($1, $2, 'https://example.com', 'Test Pin', 'Description', false, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [pinId, testUser.id]
      )

      await testPool.query(
        `
        INSERT INTO pins_tags (pin_id, tag_id) VALUES ($1, $2)
      `,
        [pinId, tag.id]
      )

      // Delete tags with no pins - should be 0
      const deletedCount = await tagRepository.deleteTagsWithNoPins(testUser.id)

      expect(deletedCount).toBe(0)

      // Verify tag still exists
      const remainingTags = await tagRepository.findByUserId(testUser.id)
      expect(remainingTags).toHaveLength(1)
      expect(remainingTags[0].id).toBe(tag.id)
    })

    it('should return 0 when user has no tags', async () => {
      const deletedCount = await tagRepository.deleteTagsWithNoPins(testUser.id)
      expect(deletedCount).toBe(0)
    })

    it('should only delete tags belonging to specified user', async () => {
      // Create another user
      const otherUser = await userRepository.create({
        username: `otheruser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'hashed_password',
        hashedEmail: 'other@example.com',
      })

      // Create empty tags for both users
      await tagRepository.create({
        userId: testUser.id,
        name: 'test-user-empty-tag',
      })
      const otherUserEmptyTag = await tagRepository.create({
        userId: otherUser.id,
        name: 'other-user-empty-tag',
      })

      // Delete empty tags for test user only
      const deletedCount = await tagRepository.deleteTagsWithNoPins(testUser.id)

      expect(deletedCount).toBe(1)

      // Verify test user's empty tag is deleted
      const testUserTags = await tagRepository.findByUserId(testUser.id)
      expect(testUserTags).toHaveLength(0)

      // Verify other user's empty tag still exists
      const otherUserTags = await tagRepository.findByUserId(otherUser.id)
      expect(otherUserTags).toHaveLength(1)
      expect(otherUserTags[0].id).toBe(otherUserEmptyTag.id)
    })

    it('should handle tags that lose all pins during transaction', async () => {
      // Create tag with pin
      const tag = await tagRepository.create({
        userId: testUser.id,
        name: 'tag-that-will-be-emptied',
      })

      // Create pin and associate with tag
      const pinId = crypto.randomUUID()
      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, description, read_later, created_at, updated_at) VALUES
        ($1, $2, 'https://example.com', 'Test Pin', 'Description', false, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [pinId, testUser.id]
      )

      await testPool.query(
        `
        INSERT INTO pins_tags (pin_id, tag_id) VALUES ($1, $2)
      `,
        [pinId, tag.id]
      )

      // Manually remove the pin association to simulate it becoming empty
      await testPool.query('DELETE FROM pins_tags WHERE tag_id = $1', [tag.id])

      // Now delete tags with no pins
      const deletedCount = await tagRepository.deleteTagsWithNoPins(testUser.id)

      expect(deletedCount).toBe(1)

      // Verify tag is deleted
      const remainingTags = await tagRepository.findByUserId(testUser.id)
      expect(remainingTags).toHaveLength(0)
    })
  })
})
