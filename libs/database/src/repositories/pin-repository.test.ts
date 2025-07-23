import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { DrizzlePinRepository } from './pin-repository.js'
import { DrizzleTagRepository } from './tag-repository.js'
import { DrizzleUserRepository } from './user-repository.js'
import { db } from '../client.js'
import type { User } from '@pinsquirrel/core'

describe('DrizzlePinRepository - Integration Tests', () => {
  let testDb: typeof db
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
    const schema = await import('../schema/index.js')
    testDb = drizzle(testPool, { schema }) as typeof db

    // Create repositories
    userRepository = new DrizzleUserRepository(testDb)
    tagRepository = new DrizzleTagRepository(testDb)
    pinRepository = new DrizzlePinRepository(testDb, tagRepository)
  })

  afterAll(async () => {
    await testPool.end()
  })

  beforeEach(async () => {
    // Create a unique test user for each test
    testUser = await userRepository.create({
      username: `testuser-${crypto.randomUUID().slice(0, 8)}`,
      passwordHash: 'hashed_password',
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
      expect(result!.tags).toHaveLength(2)
      expect(result!.tags.find(t => t.name === 'test-tag-1')).toBeDefined()
      expect(result!.tags.find(t => t.name === 'test-tag-2')).toBeDefined()
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
        username: `otheruser-${crypto.randomUUID().slice(0,8)}`,
        passwordHash: 'password',
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

      const result = await pinRepository.findByUserIdAndTag(
        testUser.id,
        tag1.id
      )

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
      const result = await pinRepository.findByUserIdAndTag(testUser.id, tag.id)
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
        [testUser.id, pinId1, pinId2, pinId3, `https://example${pinId1.slice(0,8)}.com`, `https://example${pinId2.slice(0,8)}.com`, `https://example${pinId3.slice(0,8)}.com`]
      )

      const readLaterPins = await pinRepository.findByUserIdAndReadLater(
        testUser.id,
        true
      )
      const notReadLaterPins = await pinRepository.findByUserIdAndReadLater(
        testUser.id,
        false
      )

      expect(readLaterPins).toHaveLength(2)
      expect(
        readLaterPins.find(p => p.url === `https://example${pinId1.slice(0,8)}.com`)
      ).toBeDefined()
      expect(
        readLaterPins.find(p => p.url === `https://example${pinId2.slice(0,8)}.com`)
      ).toBeDefined()

      expect(notReadLaterPins).toHaveLength(1)
      expect(
        notReadLaterPins.find(p => p.url === `https://example${pinId3.slice(0,8)}.com`)
      ).toBeDefined()
    })
  })

  describe('findByUserIdAndUrl', () => {
    it('should find pin by user and url', async () => {
      const pinId = crypto.randomUUID()
      const testUrl = `https://example-${pinId.slice(0,8)}.com/page`
      
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
      const createData = {
        userId: testUser.id,
        url: 'https://example.com',
        title: 'New Pin',
        description: 'Pin description',
        readLater: true,
      }

      const result = await pinRepository.create(createData)

      expect(result.userId).toBe(testUser.id)
      expect(result.url).toBe('https://example.com')
      expect(result.title).toBe('New Pin')
      expect(result.description).toBe('Pin description')
      expect(result.readLater).toBe(true)
      expect(result.tags).toEqual([])
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)

      // Verify it was saved
      const saved = await pinRepository.findById(result.id)
      expect(saved).toEqual(result)
    })

    it('should create pin with new tags', async () => {
      const createData = {
        userId: testUser.id,
        url: 'https://example.com',
        title: 'New Pin',
        tagNames: ['new-tag-1', 'new-tag-2'],
      }

      const result = await pinRepository.create(createData)

      expect(result.tags).toHaveLength(2)
      expect(result.tags.find(t => t.name === 'new-tag-1')).toBeDefined()
      expect(result.tags.find(t => t.name === 'new-tag-2')).toBeDefined()

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
      const existingTag = await tagRepository.create({
        userId: testUser.id,
        name: 'existing-tag',
      })

      const createData = {
        userId: testUser.id,
        url: 'https://example.com',
        title: 'New Pin',
        tagNames: ['existing-tag', 'new-tag'],
      }

      const result = await pinRepository.create(createData)

      expect(result.tags).toHaveLength(2)
      expect(result.tags.find(t => t.id === existingTag.id)).toBeDefined()
      expect(result.tags.find(t => t.name === 'new-tag')).toBeDefined()
    })
  })

  describe('update', () => {
    let existingPinId: string

    beforeEach(async () => {
      // Create a pin to update
      const pin = await pinRepository.create({
        userId: testUser.id,
        url: 'https://original.com',
        title: 'Original Title',
        description: 'Original description',
        readLater: false,
        tagNames: ['original-tag'],
      })
      existingPinId = pin.id
    })

    it('should update pin fields', async () => {
      const updateData = {
        url: 'https://updated.com',
        title: 'Updated Title',
        description: 'Updated description',
        readLater: true,
      }

      const result = await pinRepository.update(existingPinId, updateData)

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
      const updateData = {
        tagNames: ['new-tag-1', 'new-tag-2'],
      }

      const result = await pinRepository.update(existingPinId, updateData)

      expect(result!.tags).toHaveLength(2)
      expect(result!.tags.find(t => t.name === 'new-tag-1')).toBeDefined()
      expect(result!.tags.find(t => t.name === 'new-tag-2')).toBeDefined()
      expect(result!.tags.find(t => t.name === 'original-tag')).toBeUndefined()
    })

    it('should clear tags when empty array provided', async () => {
      const updateData = {
        tagNames: [],
      }

      const result = await pinRepository.update(existingPinId, updateData)

      expect(result!.tags).toEqual([])
    })

    it('should update pin contentPath and imagePath', async () => {
      const updateData = {
        contentPath: '/path/to/content.html',
        imagePath: '/path/to/image.jpg',
      }

      const result = await pinRepository.update(existingPinId, updateData)

      expect(result).not.toBeNull()
      expect(result!.contentPath).toBe('/path/to/content.html')
      expect(result!.imagePath).toBe('/path/to/image.jpg')

      // Verify it was updated in database
      const updated = await pinRepository.findById(existingPinId)
      expect(updated!.contentPath).toBe('/path/to/content.html')
      expect(updated!.imagePath).toBe('/path/to/image.jpg')
    })

    it('should return null when pin not found', async () => {
      const result = await pinRepository.update('nonexistent-id', {
        title: 'New Title',
      })
      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('should delete pin and return true', async () => {
      const pin = await pinRepository.create({
        userId: testUser.id,
        url: 'https://example.com',
        title: 'Pin to delete',
      })

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

  describe('findAll', () => {
    it('should return all pins with tags', async () => {
      // Create pins with tags for this user
      const uniqueTagName = `shared-tag-${crypto.randomUUID().slice(0,8)}`
      await tagRepository.create({ userId: testUser.id, name: uniqueTagName })

      const pin1 = await pinRepository.create({
        userId: testUser.id,
        url: `https://example1-${crypto.randomUUID().slice(0,8)}.com`,
        title: 'Pin 1',
        tagNames: [uniqueTagName],
      })

      const pin2 = await pinRepository.create({
        userId: testUser.id,
        url: `https://example2-${crypto.randomUUID().slice(0,8)}.com`,
        title: 'Pin 2',
        tagNames: [uniqueTagName],
      })

      const result = await pinRepository.findAll()

      // Find our specific pins in the results
      const ourPin1 = result.find(p => p.id === pin1.id)
      const ourPin2 = result.find(p => p.id === pin2.id)
      
      expect(ourPin1).toBeDefined()
      expect(ourPin2).toBeDefined()
      expect(ourPin1!.tags).toHaveLength(1)
      expect(ourPin2!.tags).toHaveLength(1)
      expect(ourPin1!.tags[0].name).toBe(uniqueTagName)
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      // Create test data for pagination
      for (let i = 1; i <= 5; i++) {
        await pinRepository.create({
          userId: testUser.id,
          url: `https://example${i}.com`,
          title: `Pin ${i}`,
        })
      }
    })

    it('should return pins with limit', async () => {
      const result = await pinRepository.list(3)
      expect(result.length).toBeLessThanOrEqual(3)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should return pins with offset', async () => {
      const result = await pinRepository.list(undefined, 2)
      expect(result.length).toBeGreaterThanOrEqual(3)
    })

    it('should return pins with both limit and offset', async () => {
      const result = await pinRepository.list(2, 2)
      expect(result.length).toBeLessThanOrEqual(2)
    })

    it('should return all pins when no limit or offset provided', async () => {
      const result = await pinRepository.list()
      expect(result.length).toBeGreaterThanOrEqual(5) // We create 5 pins in beforeEach
    })
  })
})
