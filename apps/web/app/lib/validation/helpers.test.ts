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

  describe('edge cases and error handling', () => {
    describe('parseFormData edge cases', () => {
      it('should handle malformed form data gracefully', async () => {
        // Create a request with corrupted form data by passing invalid body
        const request = new Request('http://test.com', {
          method: 'POST',
          body: 'invalid-form-data',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        })

        const result = await parseFormData(request, testSchema)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.errors._form).toEqual(['Invalid form data'])
        }
      })

      it('should handle empty form data', async () => {
        const formData = new FormData()

        const request = new Request('http://test.com', {
          method: 'POST',
          body: formData,
        })

        const result = await parseFormData(request, testSchema)

        expect(result.success).toBe(false)
        if (!result.success) {
          // Should have validation errors for required fields
          expect(result.errors.name).toBeTruthy()
          expect(result.errors.age).toBeTruthy()
        }
      })

      it('should handle multiple values for same field', async () => {
        const formData = new FormData()
        formData.append('name', 'John Doe')
        formData.append('name', 'Jane Doe') // Second value should overwrite
        formData.append('age', '25')

        const request = new Request('http://test.com', {
          method: 'POST',
          body: formData,
        })

        const result = await parseFormData(request, testSchema)

        expect(result.success).toBe(true)
        if (result.success) {
          // FormData.entries() returns the last value for duplicate keys
          expect(result.data.name).toBe('Jane Doe')
        }
      })
    })

    describe('parseJsonBody edge cases', () => {
      it('should handle invalid JSON gracefully', async () => {
        const request = new Request('http://test.com', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{ invalid json }',
        })

        const result = await parseJsonBody(request, testSchema)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.errors._form).toEqual(['Invalid JSON body'])
        }
      })

      it('should handle missing content-type header', async () => {
        const request = new Request('http://test.com', {
          method: 'POST',
          body: JSON.stringify({ name: 'John', age: 25 }),
        })

        const result = await parseJsonBody(request, testSchema)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.errors._form).toEqual([
            'Content-Type must be application/json',
          ])
        }
      })

      it('should handle content-type with charset', async () => {
        const data = { name: 'John Doe', age: 25 }
        const request = new Request('http://test.com', {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify(data),
        })

        const result = await parseJsonBody(request, testSchema)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toEqual(data)
        }
      })

      it('should handle empty JSON body', async () => {
        const request = new Request('http://test.com', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })

        const result = await parseJsonBody(request, testSchema)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.errors.name).toBeTruthy()
          expect(result.errors.age).toBeTruthy()
        }
      })
    })

    describe('parseSearchParams edge cases', () => {
      it('should handle URL object instead of string', () => {
        const url = new URL('http://test.com?name=John%20Doe&age=25')
        const result = parseSearchParams(url, testSchema)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.name).toBe('John Doe')
          expect(result.data.age).toBe(25)
        }
      })

      it('should handle invalid URL string', () => {
        const result = parseSearchParams('not-a-valid-url', testSchema)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.errors._form).toEqual(['Invalid URL parameters'])
        }
      })

      it('should handle empty search params', () => {
        const result = parseSearchParams('http://test.com', testSchema)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.errors.name).toBeTruthy()
          expect(result.errors.age).toBeTruthy()
        }
      })

      it('should handle duplicate search params', () => {
        const url = 'http://test.com?name=John&name=Jane&age=25'
        const result = parseSearchParams(url, testSchema)

        expect(result.success).toBe(true)
        if (result.success) {
          // URL search params use the last value for duplicates
          expect(result.data.name).toBe('Jane')
        }
      })
    })

    describe('parseParams edge cases', () => {
      it('should handle undefined values in params', () => {
        const schema = z.object({
          id: z.string().optional(),
          required: z.string(),
        })

        const params = { id: undefined, required: 'value' }
        const result = parseParams(params, schema)

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.id).toBeUndefined()
          expect(result.data.required).toBe('value')
        }
      })

      it('should handle empty params object', () => {
        const result = parseParams({}, testSchema)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.errors.name).toBeTruthy()
          expect(result.errors.age).toBeTruthy()
        }
      })
    })
  })

  describe('formatZodErrors edge cases', () => {
    it('should handle multiple errors for same field', async () => {
      const schema = z.object({
        name: z.string().min(3).max(10), // Can have both min and max errors
      })

      const formData = new FormData()
      formData.append('name', '') // Will trigger min length error

      const request = new Request('http://test.com', {
        method: 'POST',
        body: formData,
      })

      const result = await parseFormData(request, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        // Should have name error (could be array or string)
        expect(result.errors.name).toBeTruthy()
      }
    })

    it('should handle nested object validation errors', async () => {
      const nestedSchema = z.object({
        'user.name': z.string().min(3), // FormData treats dot notation as literal field name
        'user.email': z.string().email(),
      })

      const formData = new FormData()
      formData.append('user.name', 'Jo') // too short
      formData.append('user.email', 'invalid') // invalid email

      const request = new Request('http://test.com', {
        method: 'POST',
        body: formData,
      })

      const result = await parseFormData(request, nestedSchema)

      expect(result.success).toBe(false)
      if (!result.success) {
        // Should have field errors with dot notation
        expect(result.errors['user.name']).toBeTruthy()
        expect(result.errors['user.email']).toBeTruthy()
      }
    })

    it('should handle root level errors', async () => {
      const schema = z.string().min(5) // Root level validation

      const request = new Request('http://test.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify('abc'), // too short
      })

      const result = await parseJsonBody(request, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        // Root level errors should go to _form field
        expect(result.errors._form).toBeTruthy()
      }
    })
  })

  describe('response helper edge cases', () => {
    it('should handle null data in successResponse', () => {
      const response = successResponse(null)

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should handle complex nested data in successResponse', () => {
      const complexData = {
        user: { id: 1, name: 'John' },
        items: [{ id: 1, title: 'Item 1' }],
        metadata: { count: 1, page: 1 },
      }

      const response = successResponse(complexData, 201)

      expect(response.status).toBe(201)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should handle empty errors object in validationErrorResponse', () => {
      const response = validationErrorResponse({})

      expect(response.status).toBe(400)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should handle complex error structures', () => {
      const errors = {
        field1: 'Simple error',
        field2: ['Multiple', 'Errors'],
        nested: { subfield: 'Nested error' },
        _form: ['Form error 1', 'Form error 2'],
      }

      const response = validationErrorResponse(errors, 422)

      expect(response.status).toBe(422)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })
  })
})
