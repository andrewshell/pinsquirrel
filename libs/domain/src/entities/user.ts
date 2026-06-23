import type { Role } from './role.js'
import type { UserStatus } from './user-status.js'

export interface User {
  id: string
  username: string
  passwordHash: string | null
  emailHash: string | null
  roles: Role[]
  status: UserStatus
  createdAt: Date
  updatedAt: Date
}

// These are for the repository layer - they work with hashed data
// status is omitted: new users always default to UserStatus.Unverified
export type CreateUserData = Omit<
  User,
  'id' | 'roles' | 'status' | 'createdAt' | 'updatedAt'
>

export type UpdateUserData = Partial<
  Omit<User, 'id' | 'roles' | 'createdAt' | 'updatedAt'>
>
