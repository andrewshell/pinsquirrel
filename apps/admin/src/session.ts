import { randomBytes } from 'node:crypto'

export interface AdminSession {
  environment: string
  userId: string
  username: string
  // The unlocked base64 private key. Held only in this process's memory, never
  // written to a cookie or any database. Undefined until the key is unlocked.
  privateKey?: string
}

// In-memory only: sessions (and the unlocked key) clear on restart, and are
// never persisted to the target databases.
const sessions = new Map<string, AdminSession>()

export function createSession(data: AdminSession): string {
  const id = randomBytes(32).toString('base64url')
  sessions.set(id, data)
  return id
}

export function getSession(id: string | undefined): AdminSession | undefined {
  return id ? sessions.get(id) : undefined
}

export function updateSession(id: string, patch: Partial<AdminSession>): void {
  const existing = sessions.get(id)
  if (existing) sessions.set(id, { ...existing, ...patch })
}

export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id)
}
