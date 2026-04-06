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

  hit(key: string): RateLimitResult {
    const now = Date.now()
    const cutoff = now - this.windowMs
    const timestamps = (this.attempts.get(key) ?? []).filter((t) => t > cutoff)
    timestamps.push(now)
    this.attempts.set(key, timestamps)

    const limited = timestamps.length > this.maxAttempts
    const remaining = Math.max(0, this.maxAttempts - timestamps.length)
    const retryAfterMs = limited ? timestamps[0] + this.windowMs - now : 0

    return { limited, remaining, retryAfterMs }
  }

  isLimited(key: string): boolean {
    const now = Date.now()
    const cutoff = now - this.windowMs
    const timestamps = this.attempts.get(key)
    if (!timestamps) return false

    const recent = timestamps.filter((t) => t > cutoff)
    return recent.length >= this.maxAttempts
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

  private cleanup(): void {
    const now = Date.now()
    const cutoff = now - this.windowMs
    for (const [key, timestamps] of this.attempts) {
      const recent = timestamps.filter((t) => t > cutoff)
      if (recent.length === 0) {
        this.attempts.delete(key)
      } else {
        this.attempts.set(key, recent)
      }
    }
  }
}
