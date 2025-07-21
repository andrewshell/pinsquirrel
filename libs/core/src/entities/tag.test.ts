import { describe, it, expect } from 'vitest'
import type { Tag, CreateTagData, UpdateTagData } from './tag.js'

describe('Tag entity', () => {
  it('should have all required properties', () => {
    const tag: Tag = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: 'user-123',
      name: 'javascript',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    }

    expect(tag.id).toBeDefined()
    expect(tag.userId).toBeDefined()
    expect(tag.name).toBeDefined()
    expect(tag.createdAt).toBeInstanceOf(Date)
    expect(tag.updatedAt).toBeInstanceOf(Date)
  })
})

describe('CreateTagData', () => {
  it('should have required properties for creation', () => {
    const createData: CreateTagData = {
      userId: 'user-123',
      name: 'javascript',
    }

    expect(createData.userId).toBeDefined()
    expect(createData.name).toBeDefined()
  })
})

describe('UpdateTagData', () => {
  it('should have optional properties for update', () => {
    const updateData: UpdateTagData = {
      name: 'typescript',
    }

    expect(updateData.name).toBeDefined()
  })

  it('should allow empty update data', () => {
    const updateData: UpdateTagData = {}

    expect(updateData).toEqual({})
  })
})
