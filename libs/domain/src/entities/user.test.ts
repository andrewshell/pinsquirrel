import { describe, it, expect } from 'vitest'
import type { User, CreateUserData, UpdateUserData } from './user.js'

describe('User Entity', () => {
  it('should have correct interface structure', () => {
    const user: User = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      username: 'testuser',
      passwordHash: 'hashedpassword',
      emailHash: 'hashedemail',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(user.id).toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(user.username).toBe('testuser')
    expect(user.passwordHash).toBe('hashedpassword')
    expect(user.emailHash).toBe('hashedemail')
    expect(user.createdAt).toBeInstanceOf(Date)
    expect(user.updatedAt).toBeInstanceOf(Date)
  })

  it('should allow null emailHash for users without email', () => {
    const user: User = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      username: 'testuser',
      passwordHash: 'hashedpassword',
      emailHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(user.emailHash).toBeNull()
  })

  it('should accept CreateUserData with username and passwordHash', () => {
    const createData: CreateUserData = {
      username: 'newuser',
      passwordHash: 'hashedpassword',
      emailHash: 'hashedemail@example.com',
    }

    expect(createData.username).toBe('newuser')
    expect(createData.passwordHash).toBe('hashedpassword')
    expect(createData.emailHash).toBe('hashedemail@example.com')
  })

  it('should accept CreateUserData without email', () => {
    const createData: CreateUserData = {
      username: 'newuser',
      passwordHash: 'hashedpassword',
    }

    expect(createData.username).toBe('newuser')
    expect(createData.passwordHash).toBe('hashedpassword')
  })

  it('should accept UpdateUserData with passwordHash', () => {
    const updateData: UpdateUserData = {
      passwordHash: 'newhashedpassword',
    }

    expect(updateData.passwordHash).toBe('newhashedpassword')
  })

  it('should accept UpdateUserData with emailHash', () => {
    const updateData: UpdateUserData = {
      emailHash: 'newhashedemail@example.com',
    }

    expect(updateData.emailHash).toBe('newhashedemail@example.com')
  })

  it('should accept empty UpdateUserData', () => {
    const updateData: UpdateUserData = {}

    expect(Object.keys(updateData)).toHaveLength(0)
  })
})
