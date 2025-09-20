import type { Role } from './role.js'

export interface User {
  id: string
  username: string
  passwordHash: string
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

export type UpdateUserData = Omit<User, 'roles' | 'createdAt' | 'updatedAt'>
