import { describe, it, expect } from 'vitest'
import { usernameSchema, passwordSchema, emailSchema } from './user.js'

describe('User Validation Schemas', () => {
  describe('usernameSchema', () => {
    it('should accept valid usernames', () => {
      expect(usernameSchema.parse('validuser')).toBe('validuser')
      expect(usernameSchema.parse('user123')).toBe('user123')
      expect(usernameSchema.parse('user_name')).toBe('user_name')
    })

    it('should reject invalid usernames', () => {
      expect(() => usernameSchema.parse('ab')).toThrow() // too short
      expect(() => usernameSchema.parse('a'.repeat(21))).toThrow() // too long
      expect(() => usernameSchema.parse('user-name')).toThrow() // invalid character
      expect(() => usernameSchema.parse('user@name')).toThrow() // invalid character
    })
  })

  describe('passwordSchema', () => {
    it('should accept valid passwords', () => {
      expect(passwordSchema.parse('password123')).toBe('password123')
      expect(passwordSchema.parse('P@ssw0rd!')).toBe('P@ssw0rd!')
    })

    it('should reject invalid passwords', () => {
      expect(() => passwordSchema.parse('short')).toThrow() // too short
      expect(() => passwordSchema.parse('a'.repeat(101))).toThrow() // too long
    })
  })

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      expect(emailSchema.parse('user@example.com')).toBe('user@example.com')
      expect(emailSchema.parse('test.email+tag@domain.co.uk')).toBe(
        'test.email+tag@domain.co.uk'
      )
    })

    it('should reject invalid emails', () => {
      expect(() => emailSchema.parse('invalid-email')).toThrow()
      expect(() => emailSchema.parse('user@')).toThrow()
      expect(() => emailSchema.parse('@domain.com')).toThrow()
    })
  })
})
