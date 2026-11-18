export interface Session {
  id: string
  userId: string
  data: Record<string, unknown> | null
  expiresAt: Date
  createdAt: Date
}

export interface CreateSessionData {
  id: string
  userId: string
  data?: Record<string, unknown> | null
  expiresAt: Date
}

export interface UpdateSessionData {
  data?: Record<string, unknown> | null
  expiresAt?: Date
}
