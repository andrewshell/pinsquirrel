import { describe, it, expect } from 'vitest'
import type { Pin, CreatePinData, UpdatePinData } from './pin.js'
import type { Tag } from './tag.js'

describe('Pin entity', () => {
  it('should have all required properties', () => {
    const tag: Tag = {
      id: 'tag-123',
      userId: 'user-123',
      name: 'javascript',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    }

    const pin: Pin = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: 'user-123',
      url: 'https://example.com/article',
      title: 'Example Article',
      description: 'This is an example article',
      readLater: true,
      contentPath: '/storage/users/user-123/pins/123e4567/content.md',
      imagePath: '/storage/users/user-123/pins/123e4567/image.jpg',
      tags: [tag],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    }

    expect(pin.id).toBeDefined()
    expect(pin.userId).toBeDefined()
    expect(pin.url).toBeDefined()
    expect(pin.title).toBeDefined()
    expect(pin.description).toBeDefined()
    expect(pin.readLater).toBe(true)
    expect(pin.contentPath).toBeDefined()
    expect(pin.imagePath).toBeDefined()
    expect(pin.tags).toHaveLength(1)
    expect(pin.tags[0]).toEqual(tag)
    expect(pin.createdAt).toBeInstanceOf(Date)
    expect(pin.updatedAt).toBeInstanceOf(Date)
  })

  it('should allow null values for optional fields', () => {
    const pin: Pin = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: 'user-123',
      url: 'https://example.com/article',
      title: 'Example Article',
      description: null,
      readLater: false,
      contentPath: null,
      imagePath: null,
      tags: [],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    }

    expect(pin.description).toBeNull()
    expect(pin.contentPath).toBeNull()
    expect(pin.imagePath).toBeNull()
    expect(pin.tags).toHaveLength(0)
  })
})

describe('CreatePinData', () => {
  it('should have required properties for creation', () => {
    const createData: CreatePinData = {
      userId: 'user-123',
      url: 'https://example.com/article',
      title: 'Example Article',
    }

    expect(createData.userId).toBeDefined()
    expect(createData.url).toBeDefined()
    expect(createData.title).toBeDefined()
  })

  it('should allow optional properties', () => {
    const createData: CreatePinData = {
      userId: 'user-123',
      url: 'https://example.com/article',
      title: 'Example Article',
      description: 'This is an example',
      readLater: true,
      contentPath: '/path/to/content.md',
      imagePath: '/path/to/image.jpg',
      tagNames: ['javascript', 'web-development'],
    }

    expect(createData.description).toBe('This is an example')
    expect(createData.readLater).toBe(true)
    expect(createData.contentPath).toBe('/path/to/content.md')
    expect(createData.imagePath).toBe('/path/to/image.jpg')
    expect(createData.tagNames).toEqual(['javascript', 'web-development'])
  })
})

describe('UpdatePinData', () => {
  it('should have all optional properties for update', () => {
    const updateData: UpdatePinData = {
      url: 'https://example.com/updated',
      title: 'Updated Title',
      description: 'Updated description',
      readLater: false,
      contentPath: '/updated/content.md',
      imagePath: '/updated/image.jpg',
      tagNames: ['typescript'],
    }

    expect(updateData.url).toBe('https://example.com/updated')
    expect(updateData.title).toBe('Updated Title')
    expect(updateData.description).toBe('Updated description')
    expect(updateData.readLater).toBe(false)
    expect(updateData.contentPath).toBe('/updated/content.md')
    expect(updateData.imagePath).toBe('/updated/image.jpg')
    expect(updateData.tagNames).toEqual(['typescript'])
  })

  it('should allow empty update data', () => {
    const updateData: UpdatePinData = {}

    expect(updateData).toEqual({})
  })

  it('should allow partial updates', () => {
    const updateData: UpdatePinData = {
      title: 'New Title',
      readLater: true,
    }

    expect(updateData.title).toBe('New Title')
    expect(updateData.readLater).toBe(true)
    expect(updateData.url).toBeUndefined()
    expect(updateData.description).toBeUndefined()
  })
})
