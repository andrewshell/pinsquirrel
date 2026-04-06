import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimiter } from './rate-limiter'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    limiter?.destroy()
    vi.useRealTimers()
  })

  describe('hit', () => {
    it('allows requests under the limit', () => {
      limiter = new RateLimiter({ maxAttempts: 3, windowMs: 60_000 })

      const result = limiter.hit('key1')

      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(2)
    })

    it('returns limited after exceeding maxAttempts', () => {
      limiter = new RateLimiter({ maxAttempts: 3, windowMs: 60_000 })

      limiter.hit('key1')
      limiter.hit('key1')
      limiter.hit('key1')
      const result = limiter.hit('key1')

      expect(result.limited).toBe(true)
      expect(result.remaining).toBe(0)
      expect(result.retryAfterMs).toBeGreaterThan(0)
    })

    it('allows requests again after the window expires', () => {
      limiter = new RateLimiter({ maxAttempts: 2, windowMs: 60_000 })

      limiter.hit('key1')
      limiter.hit('key1')
      expect(limiter.hit('key1').limited).toBe(true)

      vi.advanceTimersByTime(60_001)

      const result = limiter.hit('key1')
      expect(result.limited).toBe(false)
      expect(result.remaining).toBe(1)
    })

    it('tracks different keys independently', () => {
      limiter = new RateLimiter({ maxAttempts: 1, windowMs: 60_000 })

      limiter.hit('key1')
      expect(limiter.hit('key1').limited).toBe(true)

      const result = limiter.hit('key2')
      expect(result.limited).toBe(false)
    })
  })

  describe('isLimited', () => {
    it('returns false when under the limit', () => {
      limiter = new RateLimiter({ maxAttempts: 3, windowMs: 60_000 })

      limiter.hit('key1')

      expect(limiter.isLimited('key1')).toBe(false)
    })

    it('returns true when at the limit without recording a new attempt', () => {
      limiter = new RateLimiter({ maxAttempts: 2, windowMs: 60_000 })

      limiter.hit('key1')
      limiter.hit('key1')

      expect(limiter.isLimited('key1')).toBe(true)
      // calling isLimited again should still be true (didn't add another attempt)
      expect(limiter.isLimited('key1')).toBe(true)
    })

    it('returns false for unknown keys', () => {
      limiter = new RateLimiter({ maxAttempts: 3, windowMs: 60_000 })

      expect(limiter.isLimited('nonexistent')).toBe(false)
    })
  })

  describe('reset', () => {
    it('clears attempts for a key', () => {
      limiter = new RateLimiter({ maxAttempts: 2, windowMs: 60_000 })

      limiter.hit('key1')
      limiter.hit('key1')
      expect(limiter.isLimited('key1')).toBe(true)

      limiter.reset('key1')

      expect(limiter.isLimited('key1')).toBe(false)
      expect(limiter.hit('key1').remaining).toBe(1)
    })
  })

  describe('cleanup', () => {
    it('removes stale entries after cleanup interval', () => {
      limiter = new RateLimiter({
        maxAttempts: 3,
        windowMs: 60_000,
        cleanupIntervalMs: 120_000,
      })

      limiter.hit('key1')

      // Advance past the window + cleanup interval
      vi.advanceTimersByTime(120_001)

      // After cleanup, the key should be gone — hit should start fresh
      const result = limiter.hit('key1')
      expect(result.remaining).toBe(2)
    })
  })
})
