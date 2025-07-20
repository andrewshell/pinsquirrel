import { describe, it, expect } from 'vitest'
import {
  validateCreateUserData,
  validateUpdateUserData,
  validateLoginCredentials,
  isValidUsername,
  isValidPassword,
  isValidEmail,
} from './validators.js'

describe('validators', () => {
  describe('validateCreateUserData', () => {
    it('should validate correct user data', () => {
      const validData = {
        username: 'testuser',
        password: 'password123',
        email: 'test@example.com',
      }

      const result = validateCreateUserData(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('should validate user data without email', () => {
      const validData = {
        username: 'testuser',
        password: 'password123',
      }

      const result = validateCreateUserData(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          ...validData,
          email: undefined,
        })
      }
    })

    it('should reject data with invalid username', () => {
      const invalidData = {
        username: 'ab', // too short
        password: 'password123',
        email: 'test@example.com',
      }

      const result = validateCreateUserData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('username')
        expect(result.errors.username).toContain('at least 3 characters')
      }
    })

    it('should reject data with invalid password', () => {
      const invalidData = {
        username: 'testuser',
        password: 'short', // too short
        email: 'test@example.com',
      }

      const result = validateCreateUserData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('password')
        expect(result.errors.password).toContain('at least 8 characters')
      }
    })

    it('should reject data with invalid email', () => {
      const invalidData = {
        username: 'testuser',
        password: 'password123',
        email: 'invalid-email',
      }

      const result = validateCreateUserData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('email')
        expect(result.errors.email).toContain('Invalid email address')
      }
    })

    it('should reject data with missing required fields', () => {
      const invalidData = {
        username: 'testuser',
        // missing password
      }

      const result = validateCreateUserData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('password')
      }
    })

    it('should reject data with wrong types', () => {
      const invalidData = {
        username: 123, // should be string
        password: 'password123',
        email: 'test@example.com',
      }

      const result = validateCreateUserData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('username')
      }
    })

    it('should reject null or undefined data', () => {
      expect(validateCreateUserData(null).success).toBe(false)
      expect(validateCreateUserData(undefined).success).toBe(false)
    })

    it('should handle multiple validation errors', () => {
      const invalidData = {
        username: 'ab', // too short
        password: 'x', // too short
        email: 'invalid', // invalid format
      }

      const result = validateCreateUserData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('username')
        expect(result.errors).toHaveProperty('password')
        expect(result.errors).toHaveProperty('email')
      }
    })
  })

  describe('validateUpdateUserData', () => {
    it('should validate correct update data with email', () => {
      const validData = {
        email: 'newemail@example.com',
      }

      const result = validateUpdateUserData(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('should validate empty update data', () => {
      const validData = {}

      const result = validateUpdateUserData(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({})
      }
    })

    it('should validate update data with undefined email (clearing email)', () => {
      const validData = {
        email: undefined,
      }

      const result = validateUpdateUserData(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.email).toBe(undefined)
      }
    })

    it('should reject update data with invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
      }

      const result = validateUpdateUserData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('email')
        expect(result.errors.email).toContain('Invalid email address')
      }
    })

    it('should reject update data with wrong email type', () => {
      const invalidData = {
        email: 123, // should be string or null
      }

      const result = validateUpdateUserData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('email')
      }
    })

    it('should reject null or undefined data', () => {
      expect(validateUpdateUserData(null).success).toBe(false)
      expect(validateUpdateUserData(undefined).success).toBe(false)
    })
  })

  describe('validateLoginCredentials', () => {
    it('should validate correct login credentials', () => {
      const validData = {
        username: 'testuser',
        password: 'password123',
      }

      const result = validateLoginCredentials(validData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validData)
      }
    })

    it('should reject credentials with invalid username', () => {
      const invalidData = {
        username: 'ab', // too short
        password: 'password123',
      }

      const result = validateLoginCredentials(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('username')
        expect(result.errors.username).toContain('at least 3 characters')
      }
    })

    it('should reject credentials with invalid password', () => {
      const invalidData = {
        username: 'testuser',
        password: 'short', // too short
      }

      const result = validateLoginCredentials(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('password')
        expect(result.errors.password).toContain('at least 8 characters')
      }
    })

    it('should reject credentials with missing fields', () => {
      const invalidData = {
        username: 'testuser',
        // missing password
      }

      const result = validateLoginCredentials(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('password')
      }
    })

    it('should reject credentials with wrong types', () => {
      const invalidData = {
        username: 123, // should be string
        password: 'password123',
      }

      const result = validateLoginCredentials(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('username')
      }
    })

    it('should reject null or undefined data', () => {
      expect(validateLoginCredentials(null).success).toBe(false)
      expect(validateLoginCredentials(undefined).success).toBe(false)
    })

    it('should handle multiple validation errors', () => {
      const invalidData = {
        username: 'ab', // too short
        password: 'x', // too short
      }

      const result = validateLoginCredentials(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('username')
        expect(result.errors).toHaveProperty('password')
      }
    })
  })

  describe('isValidUsername', () => {
    it('should return true for valid usernames', () => {
      expect(isValidUsername('testuser')).toBe(true)
      expect(isValidUsername('user123')).toBe(true)
      expect(isValidUsername('test_user')).toBe(true)
      expect(isValidUsername('ABC123')).toBe(true)
      expect(isValidUsername('a'.repeat(20))).toBe(true) // max length
    })

    it('should return false for invalid usernames', () => {
      expect(isValidUsername('ab')).toBe(false) // too short
      expect(isValidUsername('a'.repeat(21))).toBe(false) // too long
      expect(isValidUsername('user-name')).toBe(false) // invalid character
      expect(isValidUsername('user@name')).toBe(false) // invalid character
      expect(isValidUsername('user name')).toBe(false) // space not allowed
      expect(isValidUsername('user.name')).toBe(false) // dot not allowed
      expect(isValidUsername('')).toBe(false) // empty string
    })

    it('should handle edge cases', () => {
      expect(isValidUsername('123')).toBe(true) // numbers only (valid)
      expect(isValidUsername('___')).toBe(true) // underscores only (valid)
      expect(isValidUsername('aB3_')).toBe(true) // mixed case with underscore
    })
  })

  describe('isValidPassword', () => {
    it('should return true for valid passwords', () => {
      expect(isValidPassword('password123')).toBe(true)
      expect(isValidPassword('P@ssw0rd!')).toBe(true)
      expect(isValidPassword('a'.repeat(8))).toBe(true) // min length
      expect(isValidPassword('a'.repeat(100))).toBe(true) // max length
      expect(isValidPassword('longenough')).toBe(true) // simple but valid length
    })

    it('should return false for invalid passwords', () => {
      expect(isValidPassword('short')).toBe(false) // too short
      expect(isValidPassword('a'.repeat(101))).toBe(false) // too long
      expect(isValidPassword('')).toBe(false) // empty string
    })

    it('should handle edge cases', () => {
      expect(isValidPassword('12345678')).toBe(true) // numbers only (valid)
      expect(isValidPassword('        ')).toBe(true) // spaces only (valid but unusual)
      expect(isValidPassword('!@#$%^&*')).toBe(true) // special chars only (valid)
    })
  })

  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.com')).toBe(true)
      expect(isValidEmail('user+tag@example.org')).toBe(true)
      expect(isValidEmail('firstname.lastname@subdomain.domain.com')).toBe(true)
      expect(isValidEmail('a@b.co')).toBe(true) // minimal valid email
    })

    it('should return false for invalid emails', () => {
      expect(isValidEmail('invalid-email')).toBe(false) // no @ symbol
      expect(isValidEmail('user@')).toBe(false) // missing domain
      expect(isValidEmail('@domain.com')).toBe(false) // missing local part
      expect(isValidEmail('user@domain')).toBe(false) // missing TLD
      expect(isValidEmail('')).toBe(false) // empty string
      expect(isValidEmail('user space@domain.com')).toBe(false) // space in local part
      expect(isValidEmail('user@domain .com')).toBe(false) // space in domain
    })

    it('should handle edge cases', () => {
      expect(isValidEmail('user@domain.co')).toBe(true) // short TLD (valid)
      expect(isValidEmail('123@456.789')).toBe(false) // numeric TLD (invalid)
      expect(isValidEmail('a@b')).toBe(false) // no TLD
    })
  })

  describe('formatValidationErrors helper', () => {
    it('should format validation errors correctly through validation functions', () => {
      const invalidData = {
        username: 'ab', // too short
        password: 'x', // too short
        email: 'invalid', // invalid format
      }

      const result = validateCreateUserData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(typeof result.errors).toBe('object')
        expect(result.errors).toHaveProperty('username')
        expect(result.errors).toHaveProperty('password')
        expect(result.errors).toHaveProperty('email')

        // Check that error messages are strings
        expect(typeof result.errors.username).toBe('string')
        expect(typeof result.errors.password).toBe('string')
        expect(typeof result.errors.email).toBe('string')
      }
    })

    it('should handle nested field errors through validation functions', () => {
      // Test with a more complex invalid structure
      const invalidData = {
        username: ['not', 'a', 'string'], // wrong type (array instead of string)
        password: 'password123',
      }

      const result = validateCreateUserData(invalidData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors).toHaveProperty('username')
        expect(typeof result.errors.username).toBe('string')
      }
    })
  })
})
