import { describe, it, expect } from 'vitest'
import { testClient } from 'hono/testing'
import api from './api.js'

describe('API Routes', () => {
  const client = testClient(api)

  it('should create a user with valid data', async () => {
    const userData = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    }

    const res = await client.users.$post({
      json: userData,
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.name).toBe(userData.name)
    expect(data.data.email).toBe(userData.email)
    expect(data.data.age).toBe(userData.age)
    expect(data.data.id).toBeDefined()
    expect(data.data.createdAt).toBeDefined()
  })

  it('should return validation error for invalid email', async () => {
    const userData = {
      name: 'John Doe',
      email: 'invalid-email',
    }

    const res = await client.users.$post({
      json: userData,
    })

    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.success).toBe(false)
    expect(data.error.name).toBe('ZodError')
    expect(data.error.issues).toHaveLength(1)
    expect(data.error.issues[0].path).toEqual(['email'])
    expect(data.error.issues[0].validation).toBe('email')
  })

  it('should get user by id', async () => {
    const res = await client.users[':id'].$get({
      param: { id: '123' },
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.id).toBe('123')
    expect(data.data.name).toBeDefined()
    expect(data.data.email).toBeDefined()
  })
})
