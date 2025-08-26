import { describe, it, expect } from 'vitest'
import {
  usernameSchema,
  passwordSchema,
  emailSchema,
  optionalEmailSchema,
  createUserDataSchema,
  updateUserDataSchema,
  loginCredentialsSchema,
} from './domain-schemas.js'

describe('Domain Schemas', () => {
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

  describe('optionalEmailSchema', () => {
    it('should accept valid emails and undefined', () => {
      expect(optionalEmailSchema.parse('user@example.com')).toBe(
        'user@example.com'
      )
      expect(optionalEmailSchema.parse(undefined)).toBe(undefined)
    })
  })

  describe('createUserDataSchema', () => {
    it('should accept valid user creation data', () => {
      const validData = {
        username: 'testuser',
        password: 'password123',
        email: 'user@example.com',
      }
      expect(createUserDataSchema.parse(validData)).toEqual(validData)
    })

    it('should accept data without email', () => {
      const validData = {
        username: 'testuser',
        password: 'password123',
      }
      expect(createUserDataSchema.parse(validData)).toEqual({
        ...validData,
        email: undefined,
      })
    })

    it('should reject invalid data', () => {
      expect(() =>
        createUserDataSchema.parse({
          username: 'ab', // too short
          password: 'password123',
          email: 'user@example.com',
        })
      ).toThrow()
    })
  })

  describe('updateUserDataSchema', () => {
    it('should accept valid update data', () => {
      const validData = {
        email: 'new@example.com',
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      }
      expect(updateUserDataSchema.parse(validData)).toEqual(validData)
    })

    it('should accept email-only updates', () => {
      const validData = {
        email: 'new@example.com',
      }
      expect(updateUserDataSchema.parse(validData)).toEqual(validData)
    })

    it('should reject new password without current password', () => {
      expect(() =>
        updateUserDataSchema.parse({
          email: 'user@example.com',
          newPassword: 'newpassword123',
          // missing currentPassword
        })
      ).toThrow()
    })
  })

  describe('loginCredentialsSchema', () => {
    it('should accept valid login credentials', () => {
      const validData = {
        username: 'testuser',
        password: 'password123',
      }
      expect(loginCredentialsSchema.parse(validData)).toEqual({
        ...validData,
        keepSignedIn: true, // default value
      })
    })

    it('should reject invalid credentials', () => {
      expect(() =>
        loginCredentialsSchema.parse({
          username: 'ab', // too short
          password: 'password123',
        })
      ).toThrow()
    })
  })
})
