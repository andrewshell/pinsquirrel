/**
 * A per-process failure counter for the admin login form.
 *
 * Deliberately a local ~40 lines rather than a dependency or a shared package:
 * this app runs as one process, so a Map is the whole implementation, and the
 * hono app's `RateLimiter` lives behind a middleware stack (conninfo, typed
 * context) that admin does not have. The behaviour mirrors it — sliding
 * window, only failures counted, success clears the key.
 */
import type { Context } from 'hono'
import { getConnInfo } from '@hono/node-server/conninfo'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

export class LoginLimiter {
  private attempts = new Map<string, number[]>()

  constructor(
    private readonly maxAttempts = MAX_ATTEMPTS,
    private readonly windowMs = WINDOW_MS
  ) {}

  private recent(key: string): number[] {
    const cutoff = Date.now() - this.windowMs
    return (this.attempts.get(key) ?? []).filter(t => t > cutoff)
  }

  isLimited(key: string): boolean {
    const recent = this.recent(key)
    if (recent.length === 0) {
      this.attempts.delete(key)
      return false
    }
    this.attempts.set(key, recent)
    return recent.length >= this.maxAttempts
  }

  hit(key: string): void {
    this.attempts.set(key, [...this.recent(key), Date.now()])
  }

  reset(key: string): void {
    this.attempts.delete(key)
  }
}

export const loginLimiter = new LoginLimiter()

/**
 * The key one login attempt counts against.
 *
 * Username *and* address, so a shared office address cannot lock a colleague
 * out of the console, and so a single attacker cannot get a fresh budget by
 * switching accounts. `getConnInfo` reaches into the Node server's socket and
 * throws under `app.request()`, hence the catch.
 */
export function loginRateLimitKey(c: Context, username: string): string {
  let address: string | undefined
  try {
    address = getConnInfo(c).remote.address
  } catch {
    address = undefined
  }
  return `${address ?? 'unknown'}:${username.toLowerCase()}`
}
