import { randomBytes } from 'node:crypto'

export interface AdminSession {
  environment: string
  userId: string
  username: string
  // The unlocked base64 private key. Held only in this process's memory, never
  // written to a cookie or any database. Undefined until the key is unlocked.
  privateKey?: string
}

interface StoredSession extends AdminSession {
  /** Wall-clock ms after which this session is dead. */
  expiresAt: number
}

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000

// Read per call rather than at module load so the deployment's env decides,
// not import order — the same reason the hono app reads TRUST_PROXY per call.
function ttlMs(): number {
  const configured = Number(process.env.ADMIN_SESSION_TTL_MS)
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TTL_MS
}

// In-memory only: sessions (and the unlocked key) clear on restart, and are
// never persisted to the target databases.
const sessions = new Map<string, StoredSession>()

export function createSession(data: AdminSession): string {
  const id = randomBytes(32).toString('base64url')
  sessions.set(id, { ...data, expiresAt: Date.now() + ttlMs() })
  return id
}

/**
 * The live session for this id, if there is one.
 *
 * Expiry is absolute and evaluated on read: an idle operator's session dies on
 * schedule, and the unlocked private key it holds is dropped from memory
 * rather than sitting there until the process restarts. Activity does not
 * extend it — a sliding window on a session that carries a production key
 * would keep that key resident for as long as anyone kept clicking.
 */
export function getSession(id: string | undefined): AdminSession | undefined {
  if (!id) return undefined
  const session = sessions.get(id)
  if (!session) return undefined
  if (session.expiresAt <= Date.now()) {
    sessions.delete(id)
    return undefined
  }
  return session
}

export function updateSession(id: string, patch: Partial<AdminSession>): void {
  const existing = sessions.get(id)
  // Patch through getSession's view so an expired entry is reaped rather than
  // revived by the write.
  if (existing && getSession(id)) {
    sessions.set(id, { ...existing, ...patch })
  }
}

export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id)
}
