import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { Pool } from 'pg'
import { DrizzlePinRepository } from './pin.js'
import { DrizzleTagRepository } from './tag.js'
import { DrizzleUserRepository } from './user.js'
import type {
  User,
  CreatePinData,
  UpdatePinData,
  Pin,
} from '@pinsquirrel/domain'

// Helper function to create test pin data with proper format
const createTestPinData = async (
  tagRepository: DrizzleTagRepository,
  data: {
    userId: string
    url: string
    title: string
    description?: string | null
    readLater?: boolean
    tagNames?: string[]
  }
): Promise<CreatePinData> => {
  // Timestamps are managed by repository, not included in CreatePinData
  return {
    userId: data.userId,
    url: data.url,
    title: data.title,
    description: data.description ?? null,
    readLater: data.readLater ?? false,
    tagNames: data.tagNames ?? [],
  }
}

// Helper function to create test update data with proper format
const createTestUpdateData = async (
  tagRepository: DrizzleTagRepository,
  existingPin: Pin, // The current pin to be updated
  updates: {
    url?: string
    title?: string
    description?: string | null
    readLater?: boolean
    tagNames?: string[]
  } = {}
): Promise<UpdatePinData> => {
  // Return complete UpdatePinData with all required fields
  // (timestamps managed by repository)
  return {
    id: existingPin.id,
    userId: existingPin.userId,
    url: updates.url ?? existingPin.url,
    title: updates.title ?? existingPin.title,
    description:
      updates.description !== undefined
        ? updates.description
        : existingPin.description,
    readLater: updates.readLater ?? existingPin.readLater,
    tagNames:
      updates.tagNames !== undefined ? updates.tagNames : existingPin.tagNames,
  }
}

describe('DrizzlePinRepository - Integration Tests', () => {
  let testDb: PostgresJsDatabase<Record<string, unknown>>
  let testPool: Pool
  let pinRepository: DrizzlePinRepository
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
    const { users } = await import('../schema/users.js')
    const { pins } = await import('../schema/pins.js')
    const { tags } = await import('../schema/tags.js')
    const { pinsTags } = await import('../schema/pins-tags.js')
    const { passwordResetTokens } = await import(
      '../schema/password-reset-tokens.js'
    )

    const schema = {
      users,
      pins,
      tags,
      pinsTags,
      passwordResetTokens,
    }

    testDb = drizzle(testPool, { schema })

    // Create repositories
    userRepository = new DrizzleUserRepository(testDb)
    tagRepository = new DrizzleTagRepository(testDb)
    pinRepository = new DrizzlePinRepository(testDb, tagRepository)
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
      emailHash: 'hashed_email',
    })
  })

  describe('findById', () => {
    it('should find pin by id with tags', async () => {
      // Create tags first
      const tag1 = await tagRepository.create({
        userId: testUser.id,
        name: 'test-tag-1',
      })
      const tag2 = await tagRepository.create({
        userId: testUser.id,
        name: 'test-tag-2',
      })

      const testPinId = crypto.randomUUID()

      // Insert test pin
      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, description, read_later, created_at, updated_at)
        VALUES ($2, $1, 'https://example.com', 'Test Pin', 'Test Description', false, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [testUser.id, testPinId]
      )

      // Associate tags
      await testPool.query(
        `
        INSERT INTO pins_tags (pin_id, tag_id) VALUES
        ($1, $2),
        ($1, $3)
      `,
        [testPinId, tag1.id, tag2.id]
      )

      const result = await pinRepository.findById(testPinId)

      expect(result).not.toBeNull()
      expect(result!.id).toBe(testPinId)
      expect(result!.userId).toBe(testUser.id)
      expect(result!.url).toBe('https://example.com')
      expect(result!.title).toBe('Test Pin')
      expect(result!.description).toBe('Test Description')
      expect(result!.readLater).toBe(false)
      expect(result!.tagNames).toHaveLength(2)
      expect(result!.tagNames).toContain('test-tag-1')
      expect(result!.tagNames).toContain('test-tag-2')
    })

    it('should return null when pin not found', async () => {
      const result = await pinRepository.findById('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('findByUserId', () => {
    it('should find all pins for a user', async () => {
      // Create another user to ensure we only get pins for the correct user
      const otherUser = await userRepository.create({
        username: `otheruser-${crypto.randomUUID().slice(0, 8)}`,
        passwordHash: 'password',
        emailHash: 'other_hashed_email',
      })

      const pin1Id = crypto.randomUUID()
      const pin2Id = crypto.randomUUID()
      const pin3Id = crypto.randomUUID()

      // Create pins for test user
      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, created_at, updated_at) VALUES
        ($2, $1, 'https://example1.com', 'Pin 1', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
        ($3, $1, 'https://example2.com', 'Pin 2', '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z')
      `,
        [testUser.id, pin1Id, pin2Id]
      )

      // Create pin for other user
      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, created_at, updated_at) VALUES
        ($2, $1, 'https://example3.com', 'Pin 3', '2023-01-03T00:00:00Z', '2023-01-03T00:00:00Z')
      `,
        [otherUser.id, pin3Id]
      )

      const result = await pinRepository.findByUserId(testUser.id)

      expect(result).toHaveLength(2)
      expect(result.find(p => p.url === 'https://example1.com')).toBeDefined()
      expect(result.find(p => p.url === 'https://example2.com')).toBeDefined()
      expect(result.find(p => p.url === 'https://example3.com')).toBeUndefined()
    })

    it('should return empty array when user has no pins', async () => {
      const result = await pinRepository.findByUserId(testUser.id)
      expect(result).toEqual([])
    })

    it('should return pins in descending order by createdAt (newest first)', async () => {
      const pin1Id = crypto.randomUUID()
      const pin2Id = crypto.randomUUID()
      const pin3Id = crypto.randomUUID()

      // Create pins with different creation times
      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, created_at, updated_at) VALUES
        ($2, $1, 'https://example1.com', 'Pin 1', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
        ($3, $1, 'https://example2.com', 'Pin 2', '2023-01-03T00:00:00Z', '2023-01-03T00:00:00Z'),
        ($4, $1, 'https://example3.com', 'Pin 3', '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z')
      `,
        [testUser.id, pin1Id, pin2Id, pin3Id]
      )

      const result = await pinRepository.findByUserId(testUser.id)

      expect(result).toHaveLength(3)
      // Should be ordered by createdAt descending (newest first)
      expect(result[0].title).toBe('Pin 2') // 2023-01-03 (newest)
      expect(result[1].title).toBe('Pin 3') // 2023-01-02 (middle)
      expect(result[2].title).toBe('Pin 1') // 2023-01-01 (oldest)
    })
  })

  describe('findByUserIdAndTag', () => {
    it('should find pins by user and tag', async () => {
      // Create tags
      const tag1 = await tagRepository.create({
        userId: testUser.id,
        name: 'tag1',
      })
      const tag2 = await tagRepository.create({
        userId: testUser.id,
        name: 'tag2',
      })

      const pin1Id = crypto.randomUUID()
      const pin2Id = crypto.randomUUID()
      const pin3Id = crypto.randomUUID()

      // Create pins
      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, created_at, updated_at) VALUES
        ($2, $1, 'https://example1.com', 'Pin 1', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
        ($3, $1, 'https://example2.com', 'Pin 2', '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z'),
        ($4, $1, 'https://example3.com', 'Pin 3', '2023-01-03T00:00:00Z', '2023-01-03T00:00:00Z')
      `,
        [testUser.id, pin1Id, pin2Id, pin3Id]
      )

      // Associate tags
      await testPool.query(
        `
        INSERT INTO pins_tags (pin_id, tag_id) VALUES
        ($1, $3),
        ($2, $3),
        ($2, $4),
        ($1, $4)
      `,
        [pin1Id, pin2Id, tag1.id, tag2.id]
      )

      const result = await pinRepository.findByUserId(testUser.id, {
        tagId: tag1.id,
      })

      expect(result).toHaveLength(2)
      expect(result.find(p => p.url === 'https://example1.com')).toBeDefined()
      expect(result.find(p => p.url === 'https://example2.com')).toBeDefined()
      expect(result.find(p => p.url === 'https://example3.com')).toBeUndefined()
    })

    it('should return empty array when no pins have the tag', async () => {
      const tag = await tagRepository.create({
        userId: testUser.id,
        name: 'unused-tag',
      })
      const result = await pinRepository.findByUserId(testUser.id, {
        tagId: tag.id,
      })
      expect(result).toEqual([])
    })
  })

  describe('findByUserIdAndReadLater', () => {
    it('should find pins by user and read later status', async () => {
      const pinId1 = crypto.randomUUID()
      const pinId2 = crypto.randomUUID()
      const pinId3 = crypto.randomUUID()

      // Create pins with different read later status
      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, read_later, created_at, updated_at) VALUES
        ($2, $1, $5, 'Pin 1', true, '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
        ($3, $1, $6, 'Pin 2', true, '2023-01-02T00:00:00Z', '2023-01-02T00:00:00Z'),
        ($4, $1, $7, 'Pin 3', false, '2023-01-03T00:00:00Z', '2023-01-03T00:00:00Z')
      `,
        [
          testUser.id,
          pinId1,
          pinId2,
          pinId3,
          `https://example${pinId1.slice(0, 8)}.com`,
          `https://example${pinId2.slice(0, 8)}.com`,
          `https://example${pinId3.slice(0, 8)}.com`,
        ]
      )

      const readLaterPins = await pinRepository.findByUserId(testUser.id, {
        readLater: true,
      })
      const notReadLaterPins = await pinRepository.findByUserId(testUser.id, {
        readLater: false,
      })

      expect(readLaterPins).toHaveLength(2)
      expect(
        readLaterPins.find(
          p => p.url === `https://example${pinId1.slice(0, 8)}.com`
        )
      ).toBeDefined()
      expect(
        readLaterPins.find(
          p => p.url === `https://example${pinId2.slice(0, 8)}.com`
        )
      ).toBeDefined()

      expect(notReadLaterPins).toHaveLength(1)
      expect(
        notReadLaterPins.find(
          p => p.url === `https://example${pinId3.slice(0, 8)}.com`
        )
      ).toBeDefined()
    })
  })

  describe('findByUserIdAndUrl', () => {
    it('should find pin by user and url', async () => {
      const pinId = crypto.randomUUID()
      const testUrl = `https://example-${pinId.slice(0, 8)}.com/page`

      await testPool.query(
        `
        INSERT INTO pins (id, user_id, url, title, created_at, updated_at) VALUES
        ($2, $1, $3, 'Test Pin', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z')
      `,
        [testUser.id, pinId, testUrl]
      )

      const result = await pinRepository.findByUserIdAndUrl(
        testUser.id,
        testUrl
      )

      expect(result).not.toBeNull()
      expect(result!.url).toBe(testUrl)
    })

    it('should return null when pin not found', async () => {
      const result = await pinRepository.findByUserIdAndUrl(
        testUser.id,
        'https://nonexistent.com'
      )
      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('should create pin without tags', async () => {
      const createData = await createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://example.com',
        title: 'New Pin',
        description: 'Pin description',
        readLater: true,
      })

      const result = await pinRepository.create(createData)

      expect(result.userId).toBe(testUser.id)
      expect(result.url).toBe('https://example.com')
      expect(result.title).toBe('New Pin')
      expect(result.description).toBe('Pin description')
      expect(result.readLater).toBe(true)
      expect(result.tagNames).toEqual([])
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)

      // Verify it was saved
      const saved = await pinRepository.findById(result.id)
      expect(saved).toEqual(result)
    })

    it('should create pin with new tags', async () => {
      const createData = await createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://example.com',
        title: 'New Pin',
        tagNames: ['new-tag-1', 'new-tag-2'],
      })

      const result = await pinRepository.create(createData)

      expect(result.tagNames).toHaveLength(2)
      expect(result.tagNames).toContain('new-tag-1')
      expect(result.tagNames).toContain('new-tag-2')

      // Verify tags were created
      const tag1 = await tagRepository.findByUserIdAndName(
        testUser.id,
        'new-tag-1'
      )
      const tag2 = await tagRepository.findByUserIdAndName(
        testUser.id,
        'new-tag-2'
      )
      expect(tag1).not.toBeNull()
      expect(tag2).not.toBeNull()
    })

    it('should create pin with existing tags', async () => {
      // Create existing tag
      await tagRepository.create({
        userId: testUser.id,
        name: 'existing-tag',
      })

      const createData = await createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://example.com',
        title: 'New Pin',
        tagNames: ['existing-tag', 'new-tag'],
      })

      const result = await pinRepository.create(createData)

      expect(result.tagNames).toHaveLength(2)
      expect(result.tagNames).toContain('existing-tag')
      expect(result.tagNames).toContain('new-tag')
    })
  })

  describe('update', () => {
    let existingPinId: string

    beforeEach(async () => {
      // Create a pin to update
      const pinData = await createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://original.com',
        title: 'Original Title',
        description: 'Original description',
        readLater: false,
        tagNames: ['original-tag'],
      })
      const pin = await pinRepository.create(pinData)
      existingPinId = pin.id
    })

    it('should update pin fields', async () => {
      const existingPin = await pinRepository.findById(existingPinId)
      expect(existingPin).not.toBeNull()
      const updateData = await createTestUpdateData(
        tagRepository,
        existingPin!,
        {
          url: 'https://updated.com',
          title: 'Updated Title',
          description: 'Updated description',
          readLater: true,
        }
      )

      const result = await pinRepository.update(updateData)

      expect(result).not.toBeNull()
      expect(result!.url).toBe('https://updated.com')
      expect(result!.title).toBe('Updated Title')
      expect(result!.description).toBe('Updated description')
      expect(result!.readLater).toBe(true)

      // Verify it was updated in database
      const updated = await pinRepository.findById(existingPinId)
      expect(updated!.url).toBe('https://updated.com')
    })

    it('should update pin tags', async () => {
      const existingPin = await pinRepository.findById(existingPinId)
      expect(existingPin).not.toBeNull()
      const updateData = await createTestUpdateData(
        tagRepository,
        existingPin!,
        {
          tagNames: ['new-tag-1', 'new-tag-2'],
        }
      )

      const result = await pinRepository.update(updateData)

      expect(result!.tagNames).toHaveLength(2)
      expect(result!.tagNames).toContain('new-tag-1')
      expect(result!.tagNames).toContain('new-tag-2')
      expect(result!.tagNames).not.toContain('original-tag')
    })

    it('should clear tags when empty array provided', async () => {
      const existingPin = await pinRepository.findById(existingPinId)
      expect(existingPin).not.toBeNull()
      const updateData = await createTestUpdateData(
        tagRepository,
        existingPin!,
        {
          tagNames: [],
        }
      )

      const result = await pinRepository.update(updateData)

      expect(result!.tagNames).toEqual([])
    })

    it('should return null when pin not found', async () => {
      // For nonexistent pin test, we can create a fake existing pin structure
      const fakeExistingPin = {
        id: 'nonexistent-id',
        userId: testUser.id,
        url: 'https://example.com',
        title: 'Original Title',
        description: null,
        readLater: false,
        tagNames: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const updateData = await createTestUpdateData(
        tagRepository,
        fakeExistingPin,
        {
          title: 'New Title',
        }
      )

      const result = await pinRepository.update(updateData)
      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('should delete pin and return true', async () => {
      const pinData = await createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://example.com',
        title: 'Pin to delete',
      })
      const pin = await pinRepository.create(pinData)

      const result = await pinRepository.delete(pin.id)

      expect(result).toBe(true)

      // Verify it was deleted
      const deleted = await pinRepository.findById(pin.id)
      expect(deleted).toBeNull()
    })

    it('should return false when pin does not exist', async () => {
      const result = await pinRepository.delete('nonexistent-id')
      expect(result).toBe(false)
    })
  })

  describe('findByUserId', () => {
    beforeEach(async () => {
      // Create test pins with different readLater values
      await pinRepository.create({
        userId: testUser.id,
        url: 'https://normal-pin.com',
        title: 'Normal Pin',
        description: null,
        readLater: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://read-later-pin1.com',
        title: 'Read Later Pin 1',
        description: null,
        readLater: true,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://read-later-pin2.com',
        title: 'Read Later Pin 2',
        description: null,
        readLater: true,
        tagNames: [],
      })
    })

    it('should return all pins when no filter is applied', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {})
      expect(result.length).toBe(3)
    })

    it('should return only read later pins when readLater filter is true', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        readLater: true,
      })
      expect(result.length).toBe(2)
      expect(result.every(pin => pin.readLater)).toBe(true)
    })

    it('should return only non-read-later pins when readLater filter is false', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        readLater: false,
      })
      expect(result.length).toBe(1)
      expect(result.every(pin => !pin.readLater)).toBe(true)
    })

    it('should support pagination with filter', async () => {
      const result = await pinRepository.findByUserId(
        testUser.id,
        { readLater: true },
        { limit: 1 }
      )
      expect(result.length).toBe(1)
      expect(result[0].readLater).toBe(true)
    })

    it('should support offset with filter', async () => {
      const result = await pinRepository.findByUserId(
        testUser.id,
        { readLater: true },
        { limit: 1, offset: 1 }
      )
      expect(result.length).toBe(1)
      expect(result[0].readLater).toBe(true)
    })
  })

  describe('countByUserId', () => {
    beforeEach(async () => {
      // Create test pins with different readLater values
      await pinRepository.create({
        userId: testUser.id,
        url: 'https://normal-pin.com',
        title: 'Normal Pin',
        description: null,
        readLater: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://read-later-pin1.com',
        title: 'Read Later Pin 1',
        description: null,
        readLater: true,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://read-later-pin2.com',
        title: 'Read Later Pin 2',
        description: null,
        readLater: true,
        tagNames: [],
      })
    })

    it('should count all pins when no filter is applied', async () => {
      const count = await pinRepository.countByUserId(testUser.id, {})
      expect(count).toBe(3)
    })

    it('should count only read later pins when readLater filter is true', async () => {
      const count = await pinRepository.countByUserId(testUser.id, {
        readLater: true,
      })
      expect(count).toBe(2)
    })

    it('should count only non-read-later pins when readLater filter is false', async () => {
      const count = await pinRepository.countByUserId(testUser.id, {
        readLater: false,
      })
      expect(count).toBe(1)
    })
  })

  describe('searchPins', () => {
    beforeEach(async () => {
      // Create test pins with different URLs, titles, and descriptions
      await pinRepository.create({
        userId: testUser.id,
        url: 'https://example.com/react-tutorial',
        title: 'React Tutorial for Beginners',
        description: 'Learn the basics of React JavaScript library',
        readLater: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://github.com/facebook/react',
        title: 'React GitHub Repository',
        description: 'Official React repository on GitHub',
        readLater: true,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://vue.js.org/guide/',
        title: 'Vue.js Guide',
        description: 'Complete guide for Vue.js framework',
        readLater: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://angular.io/docs',
        title: 'Angular Documentation',
        description: 'Official Angular framework documentation',
        readLater: true,
        tagNames: [],
      })
    })

    it('should find pins by URL search', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        search: 'github',
      })
      expect(result).toHaveLength(1)
      expect(result[0].url).toBe('https://github.com/facebook/react')
    })

    it('should find pins by title search', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        search: 'react',
      })
      expect(result).toHaveLength(2)
      expect(
        result.find(p => p.title === 'React Tutorial for Beginners')
      ).toBeDefined()
      expect(
        result.find(p => p.title === 'React GitHub Repository')
      ).toBeDefined()
    })

    it('should find pins by description search', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        search: 'framework',
      })
      expect(result).toHaveLength(2)
      expect(result.find(p => p.title === 'Vue.js Guide')).toBeDefined()
      expect(
        result.find(p => p.title === 'Angular Documentation')
      ).toBeDefined()
    })

    it('should perform case-insensitive search', async () => {
      const lowerResult = await pinRepository.findByUserId(testUser.id, {
        search: 'react',
      })
      const upperResult = await pinRepository.findByUserId(testUser.id, {
        search: 'REACT',
      })
      const mixedResult = await pinRepository.findByUserId(testUser.id, {
        search: 'ReAcT',
      })

      expect(lowerResult).toHaveLength(2)
      expect(upperResult).toHaveLength(2)
      expect(mixedResult).toHaveLength(2)
      expect(lowerResult[0].id).toBe(upperResult[0].id)
      expect(lowerResult[0].id).toBe(mixedResult[0].id)
    })

    it('should return empty array when no matches found', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        search: 'nonexistent',
      })
      expect(result).toEqual([])
    })

    it('should handle pagination with search results', async () => {
      const firstPage = await pinRepository.findByUserId(
        testUser.id,
        { search: 'framework' },
        { limit: 1 }
      )
      const secondPage = await pinRepository.findByUserId(
        testUser.id,
        { search: 'framework' },
        { limit: 1, offset: 1 }
      )

      expect(firstPage).toHaveLength(1)
      expect(secondPage).toHaveLength(1)
      expect(firstPage[0].id).not.toBe(secondPage[0].id)
    })

    it('should handle empty search query gracefully', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        search: '',
      })
      expect(result).toHaveLength(4) // Should return all pins when search is empty
    })

    it('should handle null search query gracefully', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        search: undefined,
      })
      expect(result).toHaveLength(4) // Should return all pins when search is undefined
    })

    it('should combine search with other filters', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        search: 'documentation',
        readLater: true,
      })
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Angular Documentation')
      expect(result[0].readLater).toBe(true)
    })
  })

  describe('countByUserId with search', () => {
    beforeEach(async () => {
      await pinRepository.create({
        userId: testUser.id,
        url: 'https://example.com/react-tutorial',
        title: 'React Tutorial for Beginners',
        description: 'Learn the basics of React JavaScript library',
        readLater: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://github.com/facebook/react',
        title: 'React GitHub Repository',
        description: 'Official React repository on GitHub',
        readLater: true,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://vue.js.org/guide/',
        title: 'Vue.js Guide',
        description: 'Complete guide for Vue.js framework',
        readLater: false,
        tagNames: [],
      })
    })

    it('should count search results correctly', async () => {
      const count = await pinRepository.countByUserId(testUser.id, {
        search: 'react',
      })
      expect(count).toBe(2)
    })

    it('should count empty search results correctly', async () => {
      const count = await pinRepository.countByUserId(testUser.id, {
        search: 'nonexistent',
      })
      expect(count).toBe(0)
    })

    it('should count with combined search and filters', async () => {
      const count = await pinRepository.countByUserId(testUser.id, {
        search: 'react',
        readLater: true,
      })
      expect(count).toBe(1)
    })
  })

  describe('noTags filtering', () => {
    beforeEach(async () => {
      // Create some pins with and without tags
      await tagRepository.create({
        userId: testUser.id,
        name: 'tag1',
      })

      // Pin with tags
      const taggedPinData = await createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://tagged.com',
        title: 'Tagged Pin',
        tagNames: ['tag1'],
      })
      await pinRepository.create(taggedPinData)

      // Pins without tags
      const untaggedPin1Data = await createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://untagged1.com',
        title: 'Untagged Pin 1',
        readLater: false,
      })
      await pinRepository.create(untaggedPin1Data)

      const untaggedPin2Data = await createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://untagged2.com',
        title: 'Untagged Pin 2',
        readLater: true,
      })
      await pinRepository.create(untaggedPin2Data)
    })

    it('should find only pins with no tags when noTags filter is true', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        noTags: true,
      })

      expect(result).toHaveLength(2)
      expect(result.find(p => p.url === 'https://untagged1.com')).toBeDefined()
      expect(result.find(p => p.url === 'https://untagged2.com')).toBeDefined()
      expect(result.find(p => p.url === 'https://tagged.com')).toBeUndefined()

      // Verify that untagged pins have empty tags arrays
      result.forEach(pin => {
        expect(pin.tagNames).toEqual([])
      })
    })

    it('should count only pins with no tags when noTags filter is true', async () => {
      const count = await pinRepository.countByUserId(testUser.id, {
        noTags: true,
      })

      expect(count).toBe(2)
    })

    it('should combine noTags filter with other filters', async () => {
      // Find untagged pins that are also marked as read later
      const result = await pinRepository.findByUserId(testUser.id, {
        noTags: true,
        readLater: true,
      })

      expect(result).toHaveLength(1)
      expect(result[0].url).toBe('https://untagged2.com')
      expect(result[0].readLater).toBe(true)
      expect(result[0].tagNames).toEqual([])
    })

    it('should count untagged pins with combined filters', async () => {
      const count = await pinRepository.countByUserId(testUser.id, {
        noTags: true,
        readLater: true,
      })

      expect(count).toBe(1)
    })

    it('should support pagination with noTags filter', async () => {
      const result = await pinRepository.findByUserId(
        testUser.id,
        { noTags: true },
        { limit: 1, offset: 0 }
      )

      expect(result).toHaveLength(1)
      expect(result[0].tagNames).toEqual([])
    })

    it('should return empty array when no untagged pins exist', async () => {
      // Add tags to all existing pins
      const pins = await pinRepository.findByUserId(testUser.id, {})
      for (const pin of pins) {
        if (pin.tagNames.length === 0) {
          const updateData = await createTestUpdateData(tagRepository, pin, {
            tagNames: ['some-tag'],
          })
          await pinRepository.update(updateData)
        }
      }

      const result = await pinRepository.findByUserId(testUser.id, {
        noTags: true,
      })

      expect(result).toEqual([])
    })

    it('should return 0 count when no untagged pins exist', async () => {
      // Add tags to all existing pins
      const pins = await pinRepository.findByUserId(testUser.id, {})
      for (const pin of pins) {
        if (pin.tagNames.length === 0) {
          const updateData = await createTestUpdateData(tagRepository, pin, {
            tagNames: ['some-tag'],
          })
          await pinRepository.update(updateData)
        }
      }

      const count = await pinRepository.countByUserId(testUser.id, {
        noTags: true,
      })

      expect(count).toBe(0)
    })
  })
})
