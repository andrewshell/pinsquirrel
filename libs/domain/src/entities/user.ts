export interface User {
  id: string
  username: string
  passwordHash: string
  emailHash: string | null
  createdAt: Date
  updatedAt: Date
}

// These are for the repository layer - they work with hashed data
export type CreateUserData = Omit<User, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateUserData = Omit<User, 'createdAt' | 'updatedAt'>
