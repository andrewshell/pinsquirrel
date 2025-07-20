import { describe, it, expect } from 'vitest'
import { parseFormData, loginSchema } from '~/lib/validation'

describe('Login Route Validation', () => {
  describe('parseFormData with loginSchema', () => {
    it('should return validation errors for missing fields', async () => {
      const formData = new FormData()
      // Missing username and password

      const request = new Request('http://test.com/login', {
        method: 'POST',
        body: formData,
      })

      const result = await parseFormData(request, loginSchema)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.username).toBeTruthy()
        expect(result.errors.password).toBeTruthy()
      }
    })

    it('should return validation errors for invalid username', async () => {
      const formData = new FormData()
      formData.append('username', 'ab') // too short
      formData.append('password', 'validpassword')

      const request = new Request('http://test.com/login', {
        method: 'POST',
        body: formData,
      })

      const result = await parseFormData(request, loginSchema)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.username).toBeTruthy()
      }
    })

    it('should return validation errors for invalid password', async () => {
      const formData = new FormData()
      formData.append('username', 'validuser')
      formData.append('password', 'short') // too short

      const request = new Request('http://test.com/login', {
        method: 'POST',
        body: formData,
      })

      const result = await parseFormData(request, loginSchema)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.password).toBeTruthy()
      }
    })

    it('should successfully parse valid login data', async () => {
      const formData = new FormData()
      formData.append('username', 'validuser')
      formData.append('password', 'validpassword')

      const request = new Request('http://test.com/login', {
        method: 'POST',
        body: formData,
      })

      const result = await parseFormData(request, loginSchema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.username).toBe('validuser')
        expect(result.data.password).toBe('validpassword')
      }
    })
  })
})
