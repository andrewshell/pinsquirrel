import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  registerSchema,
  usernameSchema,
  passwordSchema,
  emailSchema,
  paginationSchema,
  userCreateSchema,
} from './schemas'

describe('Schema Validation', () => {
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

    it('should reject undefined (use optionalEmailSchema for optional)', () => {
      expect(() => emailSchema.parse(undefined)).toThrow()
    })

    it('should reject invalid emails', () => {
      expect(() => emailSchema.parse('invalid-email')).toThrow()
      expect(() => emailSchema.parse('user@')).toThrow()
      expect(() => emailSchema.parse('@domain.com')).toThrow()
      expect(() => emailSchema.parse('user@domain')).toThrow()
    })
  })

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const validLogin = {
        username: 'testuser',
        password: 'password123',
      }
      expect(loginSchema.parse(validLogin)).toEqual(validLogin)
    })

    it('should reject invalid login data', () => {
      expect(() =>
        loginSchema.parse({
          username: 'ab', // too short
          password: 'password123',
        })
      ).toThrow()

      expect(() =>
        loginSchema.parse({
          username: 'testuser',
          password: 'short', // too short
        })
      ).toThrow()
    })
  })

  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const validRegistration = {
        username: 'testuser',
        password: 'password123',
        email: 'user@example.com',
      }
      expect(registerSchema.parse(validRegistration)).toEqual(validRegistration)
    })

    it('should accept registration data without email', () => {
      const validRegistration = {
        username: 'testuser',
        password: 'password123',
      }
      expect(registerSchema.parse(validRegistration)).toEqual({
        ...validRegistration,
        email: undefined,
      })
    })

    it('should reject invalid registration data', () => {
      expect(() =>
        registerSchema.parse({
          username: 'testuser',
          password: 'password123',
          email: 'invalid-email',
        })
      ).toThrow()
    })
  })

  describe('paginationSchema', () => {
    it('should accept valid pagination params', () => {
      expect(paginationSchema.parse({ page: '1', limit: '20' })).toEqual({
        page: 1,
        limit: 20,
      })
    })

    it('should use defaults', () => {
      expect(paginationSchema.parse({})).toEqual({
        page: 1,
        limit: 20,
      })
    })

    it('should reject invalid pagination params', () => {
      expect(() => paginationSchema.parse({ page: '0' })).toThrow() // page must be >= 1
      expect(() => paginationSchema.parse({ limit: '101' })).toThrow() // limit must be <= 100
    })
  })

  describe('userCreateSchema', () => {
    it('should accept valid user creation data', () => {
      const validUser = {
        username: 'testuser',
        password: 'password123',
        email: 'user@example.com',
        role: 'admin' as const,
      }
      expect(userCreateSchema.parse(validUser)).toEqual(validUser)
    })

    it('should use default role', () => {
      const userData = {
        username: 'testuser',
        password: 'password123',
        email: 'user@example.com',
      }
      expect(userCreateSchema.parse(userData)).toEqual({
        ...userData,
        role: 'user',
      })
    })

    it('should reject invalid roles', () => {
      expect(() =>
        userCreateSchema.parse({
          username: 'testuser',
          password: 'password123',
          email: 'user@example.com',
          role: 'superuser', // invalid role
        })
      ).toThrow()
    })
  })
})
