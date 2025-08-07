import { describe, it, expect } from 'vitest'
import type {
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  UserCreateInput,
  UserUpdateInput,
  PaginationInput,
  ValidationSuccess,
  ValidationError,
  ValidationResult,
  FieldErrors,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  User,
  PaginatedResponse,
} from './types'

describe('Validation Types', () => {
  describe('ApiSuccessResponse', () => {
    it('should have correct structure for success response', () => {
      const response: ApiSuccessResponse<string> = {
        success: true,
        data: 'test data',
      }

      expect(response.success).toBe(true)
      expect(response.data).toBe('test data')
    })

    it('should work with different data types', () => {
      const numberResponse: ApiSuccessResponse<number> = {
        success: true,
        data: 42,
      }

      const objectResponse: ApiSuccessResponse<{ id: string }> = {
        success: true,
        data: { id: '123' },
      }

      expect(numberResponse.data).toBe(42)
      expect(objectResponse.data.id).toBe('123')
    })
  })

  describe('ApiErrorResponse', () => {
    it('should have correct structure for error response', () => {
      const response: ApiErrorResponse = {
        success: false,
        errors: { username: 'Username is required' },
      }

      expect(response.success).toBe(false)
      expect(response.errors.username).toBe('Username is required')
    })

    it('should handle multiple field errors', () => {
      const response: ApiErrorResponse = {
        success: false,
        errors: {
          username: 'Username is required',
          password: 'Password too short',
          _form: 'General error',
        },
      }

      expect(Object.keys(response.errors)).toHaveLength(3)
    })
  })

  describe('ApiResponse union type', () => {
    it('should allow success response', () => {
      const response: ApiResponse<string> = {
        success: true,
        data: 'success',
      }

      if (response.success) {
        expect(response.data).toBe('success')
      }
    })

    it('should allow error response', () => {
      const response: ApiResponse<string> = {
        success: false,
        errors: { field: 'error' },
      }

      if (!response.success) {
        expect(response.errors.field).toBe('error')
      }
    })
  })

  describe('User interface', () => {
    it('should have required fields', () => {
      const user: User = {
        id: '123',
        username: 'testuser',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(user.id).toBe('123')
      expect(user.username).toBe('testuser')
      expect(user.createdAt).toBeInstanceOf(Date)
      expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it('should allow optional email field', () => {
      const userWithEmail: User = {
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const userWithoutEmail: User = {
        id: '123',
        username: 'testuser',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(userWithEmail.email).toBe('test@example.com')
      expect(userWithoutEmail.email).toBeUndefined()
    })
  })

  describe('PaginatedResponse interface', () => {
    it('should have correct structure', () => {
      const response: PaginatedResponse<string> = {
        items: ['item1', 'item2'],
        total: 10,
        page: 1,
        limit: 5,
        pages: 2,
      }

      expect(response.items).toHaveLength(2)
      expect(response.total).toBe(10)
      expect(response.page).toBe(1)
      expect(response.limit).toBe(5)
      expect(response.pages).toBe(2)
    })

    it('should work with different item types', () => {
      const numberResponse: PaginatedResponse<number> = {
        items: [1, 2, 3],
        total: 3,
        page: 1,
        limit: 10,
        pages: 1,
      }

      const objectResponse: PaginatedResponse<User> = {
        items: [
          {
            id: '1',
            username: 'user1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      }

      expect(numberResponse.items[0]).toBe(1)
      expect(objectResponse.items[0].username).toBe('user1')
    })
  })

  describe('Input Types', () => {
    describe('LoginInput', () => {
      it('should properly type LoginInput', () => {
        const loginInput: LoginInput = {
          username: 'testuser',
          password: 'password123',
        }

        expect(loginInput.username).toBe('testuser')
        expect(loginInput.password).toBe('password123')
        expect(typeof loginInput.username).toBe('string')
        expect(typeof loginInput.password).toBe('string')
      })
    })

    describe('RegisterInput', () => {
      it('should properly type RegisterInput with email', () => {
        const registerInput: RegisterInput = {
          username: 'testuser',
          password: 'password123',
          email: 'test@example.com',
        }

        expect(registerInput.username).toBe('testuser')
        expect(registerInput.password).toBe('password123')
        expect(registerInput.email).toBe('test@example.com')
        expect(typeof registerInput.email).toBe('string')
      })

      it('should properly type RegisterInput without email', () => {
        const registerInput: RegisterInput = {
          username: 'testuser',
          password: 'password123',
          email: undefined,
        }

        expect(registerInput.username).toBe('testuser')
        expect(registerInput.password).toBe('password123')
        expect(registerInput.email).toBeUndefined()
      })
    })

    describe('UpdateProfileInput', () => {
      it('should properly type UpdateProfileInput', () => {
        const updateInput: UpdateProfileInput = {
          email: 'new@example.com',
          currentPassword: 'oldpass',
          newPassword: 'newpass123',
        }

        expect(updateInput.email).toBe('new@example.com')
        expect(updateInput.currentPassword).toBe('oldpass')
        expect(updateInput.newPassword).toBe('newpass123')
      })

      it('should handle optional fields', () => {
        const minimalUpdate: UpdateProfileInput = {
          email: undefined,
          currentPassword: undefined,
          newPassword: undefined,
        }

        expect(minimalUpdate.email).toBeUndefined()
        expect(minimalUpdate.currentPassword).toBeUndefined()
        expect(minimalUpdate.newPassword).toBeUndefined()
      })
    })

    describe('UserCreateInput', () => {
      it('should properly type UserCreateInput', () => {
        const userInput: UserCreateInput = {
          username: 'testuser',
          password: 'password123',
          email: 'test@example.com',
          role: 'admin',
        }

        expect(userInput.username).toBe('testuser')
        expect(userInput.password).toBe('password123')
        expect(userInput.email).toBe('test@example.com')
        expect(userInput.role).toBe('admin')
      })
    })

    describe('UserUpdateInput', () => {
      it('should properly type UserUpdateInput', () => {
        const updateInput: UserUpdateInput = {
          email: 'updated@example.com',
          role: 'user',
        }

        expect(updateInput.email).toBe('updated@example.com')
        expect(updateInput.role).toBe('user')
      })
    })

    describe('PaginationInput', () => {
      it('should properly type PaginationInput', () => {
        const paginationInput: PaginationInput = {
          page: 2,
          limit: 50,
        }

        expect(paginationInput.page).toBe(2)
        expect(paginationInput.limit).toBe(50)
        expect(typeof paginationInput.page).toBe('number')
        expect(typeof paginationInput.limit).toBe('number')
      })
    })
  })

  describe('Validation Result Types', () => {
    describe('ValidationSuccess', () => {
      it('should properly type ValidationSuccess', () => {
        const successResult: ValidationSuccess<{ name: string }> = {
          success: true,
          data: { name: 'test' },
        }

        expect(successResult.success).toBe(true)
        expect(successResult.data.name).toBe('test')
        expect(typeof successResult.success).toBe('boolean')
        expect(typeof successResult.data).toBe('object')
      })
    })

    describe('ValidationError', () => {
      it('should properly type ValidationError', () => {
        const errorResult: ValidationError = {
          success: false,
          errors: {
            username: 'Required',
            password: ['Too short', 'Invalid characters'],
            _form: 'General error',
          },
        }

        expect(errorResult.success).toBe(false)
        expect(errorResult.errors.username).toBe('Required')
        expect(Array.isArray(errorResult.errors.password)).toBe(true)
        expect(errorResult.errors.password).toEqual([
          'Too short',
          'Invalid characters',
        ])
        expect(errorResult.errors._form).toBe('General error')
      })
    })

    describe('ValidationResult', () => {
      it('should properly type ValidationResult union', () => {
        const successResult: ValidationResult<string> = {
          success: true,
          data: 'test',
        }

        const errorResult: ValidationResult<string> = {
          success: false,
          errors: { field: 'error' },
        }

        if (successResult.success) {
          expect(successResult.data).toBe('test')
        }

        if (!errorResult.success) {
          expect(errorResult.errors.field).toBe('error')
        }
      })

      it('should properly narrow ValidationResult types', () => {
        const result: ValidationResult<string> = {
          success: true,
          data: 'test data',
        }

        // Type guard functionality
        if (result.success) {
          // In this block, TypeScript knows result is ValidationSuccess<string>
          expect(result.data).toBe('test data')
          expect('errors' in result).toBe(false)
        } else {
          // This block would be ValidationError
          expect('data' in result).toBe(false)
          expect('errors' in result).toBe(true)
        }
      })
    })

    describe('FieldErrors', () => {
      it('should properly type FieldErrors', () => {
        const fieldErrors: FieldErrors = {
          username: 'Username is required',
          password: ['Too short', 'Must contain numbers'],
          email: 'Invalid format',
          _form: ['Server error', 'Connection failed'],
        }

        expect(fieldErrors.username).toBe('Username is required')
        expect(Array.isArray(fieldErrors.password)).toBe(true)
        expect(fieldErrors.password).toEqual([
          'Too short',
          'Must contain numbers',
        ])
        expect(fieldErrors.email).toBe('Invalid format')
        expect(Array.isArray(fieldErrors._form)).toBe(true)
        expect(fieldErrors._form).toEqual(['Server error', 'Connection failed'])
      })

      it('should handle FieldErrors flexible structure', () => {
        const mixedErrors: FieldErrors = {
          stringError: 'Simple string error',
          arrayError: ['Multiple', 'Error', 'Messages'],
          undefinedError: undefined,
          _form: 'Form-level error',
        }

        expect(typeof mixedErrors.stringError).toBe('string')
        expect(Array.isArray(mixedErrors.arrayError)).toBe(true)
        expect(mixedErrors.undefinedError).toBeUndefined()
        expect(typeof mixedErrors._form).toBe('string')

        // Test that _form can also be an array
        const formArrayError: FieldErrors = {
          _form: ['Error 1', 'Error 2'],
        }

        expect(Array.isArray(formArrayError._form)).toBe(true)
        expect(formArrayError._form).toEqual(['Error 1', 'Error 2'])
      })
    })
  })

  describe('Complex Type Interactions', () => {
    it('should handle complex nested types', () => {
      const complexResponse: ApiResponse<PaginatedResponse<User>> = {
        success: true,
        data: {
          items: [
            {
              id: 'user1',
              username: 'testuser1',
              email: 'test1@example.com',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'user2',
              username: 'testuser2',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          total: 2,
          page: 1,
          limit: 10,
          pages: 1,
        },
      }

      if (complexResponse.success) {
        expect(Array.isArray(complexResponse.data.items)).toBe(true)
        expect(complexResponse.data.items.length).toBe(2)
        expect(complexResponse.data.items[0].username).toBe('testuser1')
        expect(complexResponse.data.items[0].email).toBe('test1@example.com')
        expect(complexResponse.data.items[1].email).toBeUndefined()
        expect(typeof complexResponse.data.total).toBe('number')
      }
    })

    it('should properly narrow ApiResponse types with type guards', () => {
      const response: ApiResponse<{ value: number }> = {
        success: false,
        errors: { field: 'error message' },
      }

      // Type guard functionality
      if (response.success) {
        // This block would be ApiSuccessResponse<{ value: number }>
        expect('data' in response).toBe(true)
      } else {
        // In this block, TypeScript knows response is ApiErrorResponse
        expect(response.errors.field).toBe('error message')
        expect('data' in response).toBe(false)
      }
    })

    it('should handle type compatibility across input and response types', () => {
      // Simulate a workflow where input types are used to create response types
      const loginInput: LoginInput = {
        username: 'testuser',
        password: 'password123',
      }

      const successResponse: ApiSuccessResponse<User> = {
        success: true,
        data: {
          id: 'user-123',
          username: loginInput.username, // Using input username
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }

      const errorResponse: ApiErrorResponse = {
        success: false,
        errors: {
          username: 'Invalid username',
          password: 'Invalid password',
          _form: 'Login failed',
        },
      }

      expect(successResponse.data.username).toBe(loginInput.username)
      expect(errorResponse.errors.username).toBe('Invalid username')
    })
  })
})
