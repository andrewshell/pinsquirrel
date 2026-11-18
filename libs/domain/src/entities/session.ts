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

/**
 * A change to named keys of a session's data, applied without reading the
 * rest, so two requests that touch different keys do not undo each other.
 */
export interface SessionDataPatch {
  set: Record<string, unknown>
  unset: string[]
}
