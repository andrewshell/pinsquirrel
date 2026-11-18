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

export type Reservation =
  | { limited: true; retryAfterMs: number }
  | { limited: false; release: () => void }

/**
 * Count an attempt against every bucket before doing the work it guards.
 *
 * Checking and recording happen in one synchronous step, so attempts that
 * arrive together cannot all see an empty bucket while the first one is still
 * being checked. It is all or nothing: a refusal from one bucket spends none
 * of the others.
 */
export function reserve(
  buckets: ReadonlyArray<readonly [RateLimiter, string]>
): Reservation {
  const now = Date.now()
  const retryAfterMs = Math.max(
    0,
    ...buckets.map(([limiter, key]) => limiter.retryAfterMs(key, now))
  )
  if (retryAfterMs > 0) return { limited: true, retryAfterMs }

  for (const [limiter, key] of buckets) limiter.record(key, now)
  let released = false
  return {
    limited: false,
    release: () => {
      if (released) return
      released = true
      for (const [limiter, key] of buckets) limiter.forget(key, now)
    },
  }
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
    const retryAfterMs = this.retryAfterMs(key, now)
    if (retryAfterMs > 0) return { limited: true, remaining: 0, retryAfterMs }

    const recorded = this.record(key, now)
    return {
      limited: false,
      remaining: this.maxAttempts - recorded,
      retryAfterMs: 0,
    }
  }

  isLimited(key: string): boolean {
    return this.retryAfterMs(key, Date.now()) > 0
  }

  /** How long until `key` has budget again; 0 when it has budget now. */
  retryAfterMs(key: string, now: number): number {
    const timestamps = this.recent(key, now)
    if (timestamps.length < this.maxAttempts) return 0
    return timestamps[0] + this.windowMs - now
  }

  record(key: string, now: number): number {
    const timestamps = this.recent(key, now)
    timestamps.push(now)
    this.attempts.set(key, timestamps)
    return timestamps.length
  }

  forget(key: string, at: number): void {
    const timestamps = this.attempts.get(key)
    if (!timestamps) return
    const i = timestamps.lastIndexOf(at)
    if (i !== -1) timestamps.splice(i, 1)
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
