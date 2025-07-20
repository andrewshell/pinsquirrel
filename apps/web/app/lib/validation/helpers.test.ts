import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  parseFormData,
  parseJsonBody,
  parseSearchParams,
  parseParams,
  successResponse,
  validationErrorResponse,
} from './helpers'

const testSchema = z.object({
  name: z.string().min(3),
  age: z.coerce.number().min(0),
  email: z.string().email().optional(),
})

describe('Validation Helpers', () => {
  describe('parseFormData', () => {
    it('should parse valid form data', async () => {
      const formData = new FormData()
      formData.append('name', 'John Doe')
      formData.append('age', '25')
      formData.append('email', 'john@example.com')

      const request = new Request('http://test.com', {
        method: 'POST',
        body: formData,
      })

      const result = await parseFormData(request, testSchema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'John Doe',
          age: 25,
          email: 'john@example.com',
        })
      }
    })

    it('should return validation errors for invalid data', async () => {
      const formData = new FormData()
      formData.append('name', 'Jo') // too short
      formData.append('age', '-5') // negative
      formData.append('email', 'invalid-email')

      const request = new Request('http://test.com', {
        method: 'POST',
        body: formData,
      })

      const result = await parseFormData(request, testSchema)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.name).toBeTruthy()
        expect(result.errors.age).toBeTruthy()
        expect(result.errors.email).toBeTruthy()
      }
    })
  })

  describe('parseJsonBody', () => {
    it('should parse valid JSON body', async () => {
      const data = {
        name: 'John Doe',
        age: 25,
        email: 'john@example.com',
      }

      const request = new Request('http://test.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await parseJsonBody(request, testSchema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(data)
      }
    })

    it('should return error for non-JSON content type', async () => {
      const request = new Request('http://test.com', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'plain text',
      })

      const result = await parseJsonBody(request, testSchema)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors._form).toEqual([
          'Content-Type must be application/json',
        ])
      }
    })

    it('should return validation errors for invalid JSON data', async () => {
      const data = {
        name: 'Jo', // too short
        age: -5, // negative
        email: 'invalid-email',
      }

      const request = new Request('http://test.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await parseJsonBody(request, testSchema)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.name).toBeTruthy()
        expect(result.errors.age).toBeTruthy()
        expect(result.errors.email).toBeTruthy()
      }
    })
  })

  describe('parseSearchParams', () => {
    it('should parse valid search params', () => {
      const url =
        'http://test.com?name=John%20Doe&age=25&email=john@example.com'
      const result = parseSearchParams(url, testSchema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'John Doe',
          age: 25,
          email: 'john@example.com',
        })
      }
    })

    it('should return validation errors for invalid params', () => {
      const url = 'http://test.com?name=Jo&age=-5&email=invalid'
      const result = parseSearchParams(url, testSchema)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.name).toBeTruthy()
        expect(result.errors.age).toBeTruthy()
        expect(result.errors.email).toBeTruthy()
      }
    })
  })

  describe('parseParams', () => {
    const idSchema = z.object({
      id: z.string().uuid(),
    })

    it('should parse valid params', () => {
      const params = { id: '123e4567-e89b-12d3-a456-426614174000' }
      const result = parseParams(params, idSchema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(params)
      }
    })

    it('should return validation errors for invalid params', () => {
      const params = { id: 'invalid-uuid' }
      const result = parseParams(params, idSchema)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.id).toBeTruthy()
      }
    })
  })

  describe('successResponse', () => {
    it('should create success response with default status', () => {
      const data = { message: 'Success' }
      const response = successResponse(data)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should create success response with custom status', () => {
      const data = { message: 'Created' }
      const response = successResponse(data, 201)

      expect(response.status).toBe(201)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })
  })

  describe('validationErrorResponse', () => {
    it('should create error response with default status', () => {
      const errors = { name: 'Required' }
      const response = validationErrorResponse(errors)

      expect(response.status).toBe(400)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should create error response with custom status', () => {
      const errors = { _form: ['Unauthorized'] }
      const response = validationErrorResponse(errors, 401)

      expect(response.status).toBe(401)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })
  })
})
