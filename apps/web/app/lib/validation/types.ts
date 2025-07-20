// Re-export types from schemas for easier imports
export type {
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  UserCreateInput,
  UserUpdateInput,
  PaginationInput,
} from './schemas'

// Re-export validation types
export type {
  ValidationSuccess,
  ValidationError,
  ValidationResult,
  FieldErrors,
} from './helpers'

// API response types
export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  errors: import('./helpers').FieldErrors
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

// Common entity types
export interface User {
  id: string
  username: string
  email?: string
  createdAt: Date
  updatedAt: Date
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}
