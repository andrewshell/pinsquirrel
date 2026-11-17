export interface RateLimiterOptions {
  maxAttempts: number
  windowMs: number
  cleanupIntervalMs?: number
}

export interface RateLimitResult {
  limited: boolean
  remaining: number
  retryAfterMs: number
}

export class RateLimiter {
  private attempts = new Map<string, number[]>()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  private readonly maxAttempts: number
  private readonly windowMs: number

  constructor(opts: RateLimiterOptions) {
    this.maxAttempts = opts.maxAttempts
    this.windowMs = opts.windowMs

    const cleanupMs = opts.cleanupIntervalMs ?? opts.windowMs * 2
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupMs)
  }

  /**
   * Record an attempt if the key has budget left. A refused attempt is not
   * recorded, so the lockout ends when the admitted attempts leave the window
   * however many refusals arrive meanwhile, and a key never stores more than
   * `maxAttempts` timestamps.
   */
  hit(key: string): RateLimitResult {
    const now = Date.now()
    const timestamps = this.recent(key, now)
    if (timestamps.length >= this.maxAttempts) {
      return {
        limited: true,
        remaining: 0,
        retryAfterMs: timestamps[0] + this.windowMs - now,
      }
    }

    timestamps.push(now)
    this.attempts.set(key, timestamps)
    return {
      limited: false,
      remaining: this.maxAttempts - timestamps.length,
      retryAfterMs: 0,
    }
  }

  isLimited(key: string): boolean {
    return this.recent(key, Date.now()).length >= this.maxAttempts
  }

  reset(key: string): void {
    this.attempts.delete(key)
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  private recent(key: string, now: number): number[] {
    const cutoff = now - this.windowMs
    return (this.attempts.get(key) ?? []).filter(t => t > cutoff)
  }

  private cleanup(): void {
    const now = Date.now()
    const cutoff = now - this.windowMs
    for (const [key, timestamps] of this.attempts) {
      const recent = timestamps.filter(t => t > cutoff)
      if (recent.length === 0) {
        this.attempts.delete(key)
      } else {
        this.attempts.set(key, recent)
      }
    }
  }
}
