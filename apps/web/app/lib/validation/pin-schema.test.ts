import { describe, it, expect } from 'vitest'
import { pinCreationSchema } from './pin-schema'

describe('pinCreationSchema', () => {
  describe('url field', () => {
    it('validates required URL field with proper format', () => {
      const result = pinCreationSchema.safeParse({
        url: 'https://example.com',
        title: 'Test Title',
      })
      expect(result.success).toBe(true)
    })

    it('accepts URLs with different protocols', () => {
      const httpsResult = pinCreationSchema.safeParse({
        url: 'https://example.com',
        title: 'Test Title',
      })
      expect(httpsResult.success).toBe(true)

      const httpResult = pinCreationSchema.safeParse({
        url: 'http://example.com',
        title: 'Test Title',
      })
      expect(httpResult.success).toBe(true)
    })

    it('rejects empty URL field', () => {
      const result = pinCreationSchema.safeParse({
        url: '',
        title: 'Test Title',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('URL is required')
      }
    })

    it('rejects malformed URLs', () => {
      const result = pinCreationSchema.safeParse({
        url: 'not-a-valid-url',
        title: 'Test Title',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid URL format')
      }
    })

    it('rejects URLs without protocol', () => {
      const result = pinCreationSchema.safeParse({
        url: 'example.com',
        title: 'Test Title',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid URL format')
      }
    })
  })

  describe('title field', () => {
    it('validates required title field', () => {
      const result = pinCreationSchema.safeParse({
        url: 'https://example.com',
        title: 'Test Title',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty title field', () => {
      const result = pinCreationSchema.safeParse({
        url: 'https://example.com',
        title: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Title is required')
      }
    })

    it('rejects missing title field', () => {
      const result = pinCreationSchema.safeParse({
        url: 'https://example.com',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        // When field is missing, Zod returns "Invalid input" message
        // We just need to ensure validation fails
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })
  })

  describe('description field', () => {
    it('accepts optional description field', () => {
      const result = pinCreationSchema.safeParse({
        url: 'https://example.com',
        title: 'Test Title',
        description: 'This is a test description',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.description).toBe('This is a test description')
      }
    })

    it('accepts missing description field', () => {
      const result = pinCreationSchema.safeParse({
        url: 'https://example.com',
        title: 'Test Title',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.description).toBeUndefined()
      }
    })

    it('accepts empty description field', () => {
      const result = pinCreationSchema.safeParse({
        url: 'https://example.com',
        title: 'Test Title',
        description: '',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.description).toBe('')
      }
    })
  })

  describe('complete validation', () => {
    it('validates a complete valid pin creation object', () => {
      const result = pinCreationSchema.safeParse({
        url: 'https://example.com/article',
        title: 'Interesting Article',
        description: 'This article covers important topics',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          url: 'https://example.com/article',
          title: 'Interesting Article',
          description: 'This article covers important topics',
        })
      }
    })

    it('rejects object with all empty fields', () => {
      const result = pinCreationSchema.safeParse({
        url: '',
        title: '',
        description: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        // Should have at least URL and title errors (description is optional)
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2)
        const urlError = result.error.issues.find(issue => issue.path.includes('url'))
        const titleError = result.error.issues.find(issue => issue.path.includes('title'))
        expect(urlError?.message).toBe('URL is required')
        expect(titleError?.message).toBe('Title is required')
      }
    })
  })
})