import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  registerSchema,
  usernameSchema,
  passwordSchema,
  emailSchema,
  paginationSchema,
  userCreateSchema,
  userUpdateSchema,
  updateProfileSchema,
  idParamSchema,
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

  describe('updateProfileSchema', () => {
    it('should accept email-only updates', () => {
      const updateData = {
        email: 'newemail@example.com',
      }
      expect(updateProfileSchema.parse(updateData)).toEqual(updateData)
    })

    it('should accept password change with both passwords', () => {
      const updateData = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      }
      expect(updateProfileSchema.parse(updateData)).toEqual(updateData)
    })

    it('should accept email and password change together', () => {
      const updateData = {
        email: 'newemail@example.com',
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      }
      expect(updateProfileSchema.parse(updateData)).toEqual(updateData)
    })

    it('should accept empty updates', () => {
      const updateData = {}
      expect(updateProfileSchema.parse(updateData)).toEqual({
        email: undefined,
        currentPassword: undefined,
        newPassword: undefined,
      })
    })

    it('should reject new password without current password', () => {
      expect(() =>
        updateProfileSchema.parse({
          newPassword: 'newpassword123',
        })
      ).toThrow('Current password is required to change password')
    })

    it('should allow current password without new password (should be handled by app logic)', () => {
      const updateData = {
        currentPassword: 'oldpassword',
      }
      expect(updateProfileSchema.parse(updateData)).toEqual({
        ...updateData,
        email: undefined,
        newPassword: undefined,
      })
    })

    it('should reject invalid email in profile update', () => {
      expect(() =>
        updateProfileSchema.parse({
          email: 'invalid-email',
        })
      ).toThrow()
    })

    it('should reject invalid passwords in profile update', () => {
      expect(() =>
        updateProfileSchema.parse({
          currentPassword: 'short', // too short
          newPassword: 'validpassword',
        })
      ).toThrow()

      expect(() =>
        updateProfileSchema.parse({
          currentPassword: 'validpassword',
          newPassword: 'short', // too short
        })
      ).toThrow()
    })
  })

  describe('idParamSchema', () => {
    it('should accept valid UUID', () => {
      const validId = '123e4567-e89b-12d3-a456-426614174000'
      expect(idParamSchema.parse({ id: validId })).toEqual({ id: validId })
    })

    it('should reject invalid UUID format', () => {
      expect(() => idParamSchema.parse({ id: 'invalid-uuid' })).toThrow(
        'Invalid ID format'
      )
    })

    it('should reject missing id', () => {
      expect(() => idParamSchema.parse({})).toThrow()
    })

    it('should reject empty string id', () => {
      expect(() => idParamSchema.parse({ id: '' })).toThrow('Invalid ID format')
    })

    it('should reject non-string id', () => {
      expect(() => idParamSchema.parse({ id: 123 })).toThrow()
    })
  })

  describe('userUpdateSchema', () => {
    it('should accept email-only updates', () => {
      const updateData = { email: 'newemail@example.com' }
      expect(userUpdateSchema.parse(updateData)).toEqual(updateData)
    })

    it('should accept role-only updates', () => {
      const updateData = { role: 'admin' as const }
      expect(userUpdateSchema.parse(updateData)).toEqual(updateData)
    })

    it('should accept email and role updates', () => {
      const updateData = {
        email: 'newemail@example.com',
        role: 'admin' as const,
      }
      expect(userUpdateSchema.parse(updateData)).toEqual(updateData)
    })

    it('should accept empty updates', () => {
      const updateData = {}
      expect(userUpdateSchema.parse(updateData)).toEqual({
        email: undefined,
        role: undefined,
      })
    })

    it('should reject invalid emails', () => {
      expect(() => userUpdateSchema.parse({ email: 'invalid-email' })).toThrow()
    })

    it('should reject invalid roles', () => {
      expect(() => userUpdateSchema.parse({ role: 'superuser' })).toThrow()
    })

    it('should accept user role', () => {
      const updateData = { role: 'user' as const }
      expect(userUpdateSchema.parse(updateData)).toEqual(updateData)
    })
  })

  describe('schema edge cases', () => {
    describe('pagination schema edge cases', () => {
      it('should handle string numbers correctly', () => {
        expect(paginationSchema.parse({ page: '5', limit: '50' })).toEqual({
          page: 5,
          limit: 50,
        })
      })

      it('should handle mixed types with coercion', () => {
        expect(paginationSchema.parse({ page: 3, limit: '25' })).toEqual({
          page: 3,
          limit: 25,
        })
      })

      it('should reject negative numbers', () => {
        expect(() => paginationSchema.parse({ page: '-1' })).toThrow()
        expect(() => paginationSchema.parse({ limit: '-5' })).toThrow()
      })

      it('should reject non-integer numbers', () => {
        expect(() => paginationSchema.parse({ page: '1.5' })).toThrow()
        expect(() => paginationSchema.parse({ limit: '10.7' })).toThrow()
      })

      it('should reject very large limit', () => {
        expect(() => paginationSchema.parse({ limit: '1000' })).toThrow()
      })

      it('should handle partial params with defaults', () => {
        expect(paginationSchema.parse({ page: '3' })).toEqual({
          page: 3,
          limit: 20,
        })
        expect(paginationSchema.parse({ limit: '50' })).toEqual({
          page: 1,
          limit: 50,
        })
      })
    })

    describe('register schema edge cases', () => {
      it('should reject empty email string', () => {
        expect(() =>
          registerSchema.parse({
            username: 'testuser',
            password: 'password123',
            email: '',
          })
        ).toThrow('Invalid email address')
      })

      it('should handle explicit undefined email', () => {
        const registrationData = {
          username: 'testuser',
          password: 'password123',
          email: undefined,
        }
        const result = registerSchema.parse(registrationData)
        expect(result.email).toBeUndefined()
      })
    })

    describe('user create schema edge cases', () => {
      it('should reject empty email string', () => {
        expect(() =>
          userCreateSchema.parse({
            username: 'testuser',
            password: 'password123',
            email: '',
          })
        ).toThrow('Invalid email address')
      })

      it('should handle explicit undefined email', () => {
        const userData = {
          username: 'testuser',
          password: 'password123',
          email: undefined,
        }
        const result = userCreateSchema.parse(userData)
        expect(result.email).toBeUndefined()
        expect(result.role).toBe('user')
      })
    })

    describe('login schema edge cases', () => {
      it('should handle exact minimum length requirements', () => {
        const loginData = {
          username: 'abc', // exactly 3 characters (minimum)
          password: '12345678', // exactly 8 characters (minimum)
        }
        expect(loginSchema.parse(loginData)).toEqual(loginData)
      })

      it('should reject exactly below minimum', () => {
        expect(() =>
          loginSchema.parse({
            username: 'ab', // 2 characters (below minimum)
            password: 'password123',
          })
        ).toThrow()

        expect(() =>
          loginSchema.parse({
            username: 'validuser',
            password: '1234567', // 7 characters (below minimum of 8)
          })
        ).toThrow()
      })
    })
  })
})
