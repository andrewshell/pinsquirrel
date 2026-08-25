import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/mysql2'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import { insertPin } from '../test-fixtures.js'
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
const createTestPinData = (
  tagRepository: DrizzleTagRepository,
  data: {
    userId: string
    url: string
    title: string
    description?: string | null
    readLater?: boolean
    isPrivate?: boolean
    tagNames?: string[]
  }
): CreatePinData => {
  return {
    userId: data.userId,
    url: data.url,
    title: data.title,
    description: data.description ?? null,
    readLater: data.readLater ?? false,
    isPrivate: data.isPrivate ?? false,
    tagNames: data.tagNames ?? [],
  }
}

// Helper function to create test update data with proper format
const createTestUpdateData = (
  tagRepository: DrizzleTagRepository,
  existingPin: Pin,
  updates: {
    url?: string
    title?: string
    description?: string | null
    readLater?: boolean
    isPrivate?: boolean
    tagNames?: string[]
  } = {}
): UpdatePinData => {
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
    isPrivate: updates.isPrivate ?? existingPin.isPrivate,
    tagNames:
      updates.tagNames !== undefined ? updates.tagNames : existingPin.tagNames,
  }
}

describe('DrizzlePinRepository - Integration Tests', () => {
  let testDb: MySql2Database
  let testPool: Pool
  let pinRepository: DrizzlePinRepository
  let tagRepository: DrizzleTagRepository
  let userRepository: DrizzleUserRepository
  let testUser: User

  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel_test'

  beforeAll(() => {
    // Create test database connection
    testPool = mysql.createPool(TEST_DATABASE_URL)

    testDb = drizzle({ client: testPool })

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
    await testPool.query('DELETE FROM sessions')
    await testPool.query('DELETE FROM tags')
    await testPool.query('DELETE FROM user_roles')
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

      const testPinId = await insertPin(testPool, {
        userId: testUser.id,
        url: 'https://example.com',
        title: 'Test Pin',
        description: 'Test Description',
        createdAt: '2023-01-01T00:00:00',
      })

      // Associate tags
      await testPool.query(
        `
        INSERT INTO pins_tags (pin_id, tag_id) VALUES
        (?, ?),
        (?, ?)
      `,
        [testPinId, tag1.id, testPinId, tag2.id]
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

      // Create pins for test user
      await insertPin(testPool, {
        userId: testUser.id,
        url: 'https://example1.com',
        title: 'Pin 1',
        createdAt: '2023-01-01T00:00:00',
      })
      await insertPin(testPool, {
        userId: testUser.id,
        url: 'https://example2.com',
        title: 'Pin 2',
        createdAt: '2023-01-02T00:00:00',
      })

      // Create pin for other user
      await insertPin(testPool, {
        userId: otherUser.id,
        url: 'https://example3.com',
        title: 'Pin 3',
        createdAt: '2023-01-03T00:00:00',
      })

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
      // Create pins with different creation times
      await insertPin(testPool, {
        userId: testUser.id,
        url: 'https://example1.com',
        title: 'Pin 1',
        createdAt: '2023-01-01T00:00:00',
      })
      await insertPin(testPool, {
        userId: testUser.id,
        url: 'https://example2.com',
        title: 'Pin 2',
        createdAt: '2023-01-03T00:00:00',
      })
      await insertPin(testPool, {
        userId: testUser.id,
        url: 'https://example3.com',
        title: 'Pin 3',
        createdAt: '2023-01-02T00:00:00',
      })

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

      // Create pins
      const pin1Id = await insertPin(testPool, {
        userId: testUser.id,
        url: 'https://example1.com',
        title: 'Pin 1',
        createdAt: '2023-01-01T00:00:00',
      })
      const pin2Id = await insertPin(testPool, {
        userId: testUser.id,
        url: 'https://example2.com',
        title: 'Pin 2',
        createdAt: '2023-01-02T00:00:00',
      })
      await insertPin(testPool, {
        userId: testUser.id,
        url: 'https://example3.com',
        title: 'Pin 3',
        createdAt: '2023-01-03T00:00:00',
      })

      // Associate tags
      await testPool.query(
        `
        INSERT INTO pins_tags (pin_id, tag_id) VALUES
        (?, ?),
        (?, ?),
        (?, ?),
        (?, ?)
      `,
        [pin1Id, tag1.id, pin2Id, tag1.id, pin2Id, tag2.id, pin1Id, tag2.id]
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
      const url1 = `https://example${crypto.randomUUID().slice(0, 8)}.com`
      const url2 = `https://example${crypto.randomUUID().slice(0, 8)}.com`
      const url3 = `https://example${crypto.randomUUID().slice(0, 8)}.com`

      // Create pins with different read later status
      await insertPin(testPool, {
        userId: testUser.id,
        url: url1,
        title: 'Pin 1',
        readLater: true,
        createdAt: '2023-01-01T00:00:00',
      })
      await insertPin(testPool, {
        userId: testUser.id,
        url: url2,
        title: 'Pin 2',
        readLater: true,
        createdAt: '2023-01-02T00:00:00',
      })
      await insertPin(testPool, {
        userId: testUser.id,
        url: url3,
        title: 'Pin 3',
        createdAt: '2023-01-03T00:00:00',
      })

      const readLaterPins = await pinRepository.findByUserId(testUser.id, {
        readLater: true,
      })
      const notReadLaterPins = await pinRepository.findByUserId(testUser.id, {
        readLater: false,
      })

      expect(readLaterPins).toHaveLength(2)
      expect(readLaterPins.find(p => p.url === url1)).toBeDefined()
      expect(readLaterPins.find(p => p.url === url2)).toBeDefined()

      expect(notReadLaterPins).toHaveLength(1)
      expect(notReadLaterPins.find(p => p.url === url3)).toBeDefined()
    })
  })

  describe('findByUserIdAndUrl', () => {
    it('should find pin by user and url', async () => {
      const testUrl = `https://example-${crypto.randomUUID().slice(0, 8)}.com/page`

      await insertPin(testPool, {
        userId: testUser.id,
        url: testUrl,
        title: 'Test Pin',
        createdAt: '2023-01-01T00:00:00',
      })

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
      const createData = createTestPinData(tagRepository, {
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
      const createData = createTestPinData(tagRepository, {
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

      const createData = createTestPinData(tagRepository, {
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
      const pinData = createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://original.com',
        title: 'Original Title',
        description: 'Original description',
        readLater: false,
        isPrivate: false,
        tagNames: ['original-tag'],
      })
      const pin = await pinRepository.create(pinData)
      existingPinId = pin.id
    })

    it('should update pin fields', async () => {
      const existingPin = await pinRepository.findById(existingPinId)
      expect(existingPin).not.toBeNull()
      const updateData = createTestUpdateData(tagRepository, existingPin!, {
        url: 'https://updated.com',
        title: 'Updated Title',
        description: 'Updated description',
        readLater: true,
      })

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
      const updateData = createTestUpdateData(tagRepository, existingPin!, {
        tagNames: ['new-tag-1', 'new-tag-2'],
      })

      const result = await pinRepository.update(updateData)

      expect(result!.tagNames).toHaveLength(2)
      expect(result!.tagNames).toContain('new-tag-1')
      expect(result!.tagNames).toContain('new-tag-2')
      expect(result!.tagNames).not.toContain('original-tag')
    })

    it('should clear tags when empty array provided', async () => {
      const existingPin = await pinRepository.findById(existingPinId)
      expect(existingPin).not.toBeNull()
      const updateData = createTestUpdateData(tagRepository, existingPin!, {
        tagNames: [],
      })

      const result = await pinRepository.update(updateData)

      expect(result!.tagNames).toEqual([])
    })

    it('should return null when pin not found', async () => {
      const fakeExistingPin = {
        id: 'nonexistent-id',
        userId: testUser.id,
        url: 'https://example.com',
        title: 'Original Title',
        description: null,
        readLater: false,
        isPrivate: false,
        tagNames: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const updateData = createTestUpdateData(tagRepository, fakeExistingPin, {
        title: 'New Title',
      })

      const result = await pinRepository.update(updateData)
      expect(result).toBeNull()
    })
  })

  // A pin write and its tag writes are one unit of work: a failure part-way
  // through used to leave a pin with no tags, or with its old tag links
  // deleted and the new ones never added.
  //
  // The forced failure is a tag name longer than tags.name (varchar 255),
  // which MySQL rejects in strict mode - late enough that the pin row is
  // already written.
  describe('atomicity of the pin and tag writes', () => {
    const overlongTagName = 'x'.repeat(300)

    it('leaves no pin behind when the tag write fails during create', async () => {
      const createData = createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://atomic-create.example',
        title: 'Never Committed',
        tagNames: ['fine', overlongTagName],
      })

      await expect(pinRepository.create(createData)).rejects.toThrow()

      const orphan = await pinRepository.findByUserIdAndUrl(
        testUser.id,
        'https://atomic-create.example'
      )
      expect(orphan).toBeNull()
    })

    it('leaves the pin and its tags untouched when the tag write fails during update', async () => {
      const pin = await pinRepository.create(
        createTestPinData(tagRepository, {
          userId: testUser.id,
          url: 'https://atomic-update.example',
          title: 'Original Title',
          tagNames: ['keep-me'],
        })
      )

      await expect(
        pinRepository.update(
          createTestUpdateData(tagRepository, pin, {
            title: 'Rolled Back',
            tagNames: [overlongTagName],
          })
        )
      ).rejects.toThrow()

      const unchanged = await pinRepository.findById(pin.id)
      expect(unchanged!.title).toBe('Original Title')
      expect(unchanged!.tagNames).toEqual(['keep-me'])
    })
  })

  describe('delete', () => {
    it('should delete pin and return true', async () => {
      const pinData = createTestPinData(tagRepository, {
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
        isPrivate: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://read-later-pin1.com',
        title: 'Read Later Pin 1',
        description: null,
        readLater: true,
        isPrivate: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://read-later-pin2.com',
        title: 'Read Later Pin 2',
        description: null,
        readLater: true,
        isPrivate: false,
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
      await pinRepository.create({
        userId: testUser.id,
        url: 'https://normal-pin.com',
        title: 'Normal Pin',
        description: null,
        readLater: false,
        isPrivate: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://read-later-pin1.com',
        title: 'Read Later Pin 1',
        description: null,
        readLater: true,
        isPrivate: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://read-later-pin2.com',
        title: 'Read Later Pin 2',
        description: null,
        readLater: true,
        isPrivate: false,
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
      await pinRepository.create({
        userId: testUser.id,
        url: 'https://example.com/react-tutorial',
        title: 'React Tutorial for Beginners',
        description: 'Learn the basics of React JavaScript library',
        readLater: false,
        isPrivate: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://github.com/facebook/react',
        title: 'React GitHub Repository',
        description: 'Official React repository on GitHub',
        readLater: true,
        isPrivate: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://vue.js.org/guide/',
        title: 'Vue.js Guide',
        description: 'Complete guide for Vue.js framework',
        readLater: false,
        isPrivate: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://angular.io/docs',
        title: 'Angular Documentation',
        description: 'Official Angular framework documentation',
        readLater: true,
        isPrivate: false,
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
      expect(result).toHaveLength(4)
    })

    it('should handle null search query gracefully', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        search: undefined,
      })
      expect(result).toHaveLength(4)
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

    describe('LIKE wildcards in the search term', () => {
      beforeEach(async () => {
        await pinRepository.create({
          userId: testUser.id,
          url: 'https://example.com/underscore',
          title: 'a_c literal underscore',
          description: 'has 100% coverage and a back\\slash',
          readLater: false,
          isPrivate: false,
          tagNames: [],
        })
      })

      it('treats _ as a literal character, not a single-character wildcard', async () => {
        const result = await pinRepository.findByUserId(testUser.id, {
          search: 'a_c',
        })

        expect(result.map(p => p.title)).toEqual(['a_c literal underscore'])
      })

      it('treats % as a literal character, not a multi-character wildcard', async () => {
        const result = await pinRepository.findByUserId(testUser.id, {
          search: '100%',
        })

        expect(result.map(p => p.title)).toEqual(['a_c literal underscore'])
      })

      it('treats a backslash as a literal character', async () => {
        const result = await pinRepository.findByUserId(testUser.id, {
          search: 'back\\slash',
        })

        expect(result.map(p => p.title)).toEqual(['a_c literal underscore'])
      })

      it('finds nothing for a wildcard that would otherwise match everything', async () => {
        const result = await pinRepository.findByUserId(testUser.id, {
          search: '%',
        })

        expect(result.map(p => p.title)).toEqual(['a_c literal underscore'])
      })
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
        isPrivate: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://github.com/facebook/react',
        title: 'React GitHub Repository',
        description: 'Official React repository on GitHub',
        readLater: true,
        isPrivate: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://vue.js.org/guide/',
        title: 'Vue.js Guide',
        description: 'Complete guide for Vue.js framework',
        readLater: false,
        isPrivate: false,
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
      await tagRepository.create({
        userId: testUser.id,
        name: 'tag1',
      })

      const taggedPinData = createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://tagged.com',
        title: 'Tagged Pin',
        tagNames: ['tag1'],
      })
      await pinRepository.create(taggedPinData)

      const untaggedPin1Data = createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://untagged1.com',
        title: 'Untagged Pin 1',
        readLater: false,
      })
      await pinRepository.create(untaggedPin1Data)

      const untaggedPin2Data = createTestPinData(tagRepository, {
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
      const pins = await pinRepository.findByUserId(testUser.id, {})
      for (const pin of pins) {
        if (pin.tagNames.length === 0) {
          const updateData = createTestUpdateData(tagRepository, pin, {
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
      const pins = await pinRepository.findByUserId(testUser.id, {})
      for (const pin of pins) {
        if (pin.tagNames.length === 0) {
          const updateData = createTestUpdateData(tagRepository, pin, {
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

  describe('isPrivate filtering', () => {
    beforeEach(async () => {
      await pinRepository.create({
        userId: testUser.id,
        url: 'https://public-pin.com',
        title: 'Public Pin',
        description: null,
        readLater: false,
        isPrivate: false,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://private-pin1.com',
        title: 'Private Pin 1',
        description: null,
        readLater: false,
        isPrivate: true,
        tagNames: [],
      })

      await pinRepository.create({
        userId: testUser.id,
        url: 'https://private-pin2.com',
        title: 'Private Pin 2',
        description: null,
        readLater: true,
        isPrivate: true,
        tagNames: [],
      })
    })

    it('should return all pins when no isPrivate filter is applied', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {})
      expect(result.length).toBe(3)
    })

    it('should return only public pins when isPrivate is false', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        isPrivate: false,
      })
      expect(result.length).toBe(1)
      expect(result.every(pin => !pin.isPrivate)).toBe(true)
    })

    it('should return only private pins when isPrivate is true', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        isPrivate: true,
      })
      expect(result.length).toBe(2)
      expect(result.every(pin => pin.isPrivate)).toBe(true)
    })

    it('should combine isPrivate and readLater filters', async () => {
      const result = await pinRepository.findByUserId(testUser.id, {
        isPrivate: true,
        readLater: true,
      })
      expect(result.length).toBe(1)
      expect(result[0].isPrivate).toBe(true)
      expect(result[0].readLater).toBe(true)
    })

    it('should count only public pins when isPrivate is false', async () => {
      const count = await pinRepository.countByUserId(testUser.id, {
        isPrivate: false,
      })
      expect(count).toBe(1)
    })

    it('should count only private pins when isPrivate is true', async () => {
      const count = await pinRepository.countByUserId(testUser.id, {
        isPrivate: true,
      })
      expect(count).toBe(2)
    })
  })

  describe('isPrivate create and update', () => {
    it('should create a pin with isPrivate true', async () => {
      const createData = createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://secret.com',
        title: 'Secret Pin',
        isPrivate: true,
      })

      const result = await pinRepository.create(createData)

      expect(result.isPrivate).toBe(true)

      const saved = await pinRepository.findById(result.id)
      expect(saved!.isPrivate).toBe(true)
    })

    it('should create a pin with isPrivate defaulting to false', async () => {
      const createData = createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://public.com',
        title: 'Public Pin',
      })

      const result = await pinRepository.create(createData)

      expect(result.isPrivate).toBe(false)
    })

    it('should update isPrivate from false to true', async () => {
      const createData = createTestPinData(tagRepository, {
        userId: testUser.id,
        url: 'https://toggle.com',
        title: 'Toggle Pin',
        isPrivate: false,
      })
      const pin = await pinRepository.create(createData)
      expect(pin.isPrivate).toBe(false)

      const updateData = createTestUpdateData(tagRepository, pin, {
        isPrivate: true,
      })
      const updated = await pinRepository.update(updateData)

      expect(updated!.isPrivate).toBe(true)

      const saved = await pinRepository.findById(pin.id)
      expect(saved!.isPrivate).toBe(true)
    })
  })

  describe('indexes', () => {
    it('should index (user_id, created_at) for the list query', async () => {
      // Every list is WHERE user_id = ? ORDER BY created_at DESC LIMIT/OFFSET.
      // Without this composite index MySQL filesorts the user's whole pin set
      // on every page. There is no behavioural assertion for an index, so
      // assert the schema directly.
      const [result] = await testPool.query(
        'SHOW INDEX FROM pins WHERE Key_name = ?',
        ['pins_user_id_created_at_idx']
      )
      const rows = result as {
        Seq_in_index: number
        Column_name: string
      }[]

      expect(
        rows
          .sort((a, b) => a.Seq_in_index - b.Seq_in_index)
          .map(r => r.Column_name)
      ).toEqual(['user_id', 'created_at'])
    })
  })
})
