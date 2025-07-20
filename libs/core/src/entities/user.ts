export interface User {
  id: string
  username: string
  passwordHash: string
  emailHash: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateUserData {
  username: string
  passwordHash: string
  emailHash?: string | null
}

export interface UpdateUserData {
  passwordHash?: string
  emailHash?: string | null
}
