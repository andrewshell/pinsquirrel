export interface User {
  id: string
  username: string
  passwordHash: string
  emailHash: string | null
  createdAt: Date
  updatedAt: Date
}

// These are for the repository layer - they work with hashed data
export interface CreateUserData {
  username: string
  passwordHash: string
  emailHash?: string | null
}

export interface UpdateUserData {
  passwordHash?: string
  emailHash?: string | null
}
