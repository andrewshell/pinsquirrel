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
})
