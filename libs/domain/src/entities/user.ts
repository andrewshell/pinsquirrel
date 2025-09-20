import type { Role } from './role.js'

export interface User {
  id: string
  username: string
  passwordHash: string | null
  emailHash: string | null
  roles: Role[]
  createdAt: Date
  updatedAt: Date
}

// These are for the repository layer - they work with hashed data
export type CreateUserData = Omit<
  User,
  'id' | 'roles' | 'createdAt' | 'updatedAt'
>

export type UpdateUserData = Partial<
  Omit<User, 'id' | 'roles' | 'createdAt' | 'updatedAt'>
>
