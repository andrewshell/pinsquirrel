import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const api = new Hono()

// Example validated endpoint
const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(18).optional(),
})

api.post('/users', zValidator('json', userSchema), c => {
  const user = c.req.valid('json')
  return c.json({
    success: true,
    data: {
      id: Math.random().toString(36).substr(2, 9),
      ...user,
      createdAt: new Date().toISOString(),
    },
  })
})

api.get('/users/:id', c => {
  const id = c.req.param('id')
  return c.json({
    success: true,
    data: {
      id,
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date().toISOString(),
    },
  })
})

export default api
