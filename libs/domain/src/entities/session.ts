export interface Session {
  id: string
  userId: string
  data: Record<string, unknown> | null
  expiresAt: Date
  createdAt: Date
}

export interface CreateSessionData {
  // The SHA-256 of the cookie value, never the cookie value itself.
  id: string
  userId: string
  data?: Record<string, unknown> | null
  expiresAt: Date
}

export interface UpdateSessionData {
  data?: Record<string, unknown> | null
  expiresAt?: Date
}
