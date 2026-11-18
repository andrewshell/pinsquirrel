import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimiter, reserve } from './rate-limiter'

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

  describe('refused hits', () => {
    beforeEach(() => {
      vi.setSystemTime(0)
      limiter = new RateLimiter({ maxAttempts: 3, windowMs: 1000 })
    })

    it('admits a hit made after waiting the advertised retry delay', () => {
      limiter.hit('k')
      vi.advanceTimersByTime(1)
      limiter.hit('k')
      vi.advanceTimersByTime(1)
      limiter.hit('k')
      vi.advanceTimersByTime(498)
      const refused = limiter.hit('k')
      expect(refused.limited).toBe(true)

      vi.advanceTimersByTime(refused.retryAfterMs)

      expect(limiter.hit('k').limited).toBe(false)
    })

    it('do not extend the lockout past the window of the admitted hits', () => {
      for (let i = 0; i < 3; i++) limiter.hit('k')
      for (let i = 0; i < 1000; i++) {
        vi.advanceTimersByTime(1)
        limiter.hit('k')
      }
      vi.advanceTimersByTime(1)

      expect(limiter.hit('k').limited).toBe(false)
    })

    it('are not counted once the admitted hits leave the window', () => {
      for (let i = 0; i < 3; i++) limiter.hit('k')
      for (let i = 0; i < 999; i++) {
        vi.advanceTimersByTime(1)
        expect(limiter.hit('k').limited).toBe(true)
      }
      vi.advanceTimersByTime(2)

      expect(limiter.hit('k').remaining).toBe(2)
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

  describe('reserve', () => {
    let other: RateLimiter

    beforeEach(() => {
      vi.setSystemTime(0)
      limiter = new RateLimiter({ maxAttempts: 2, windowMs: 1000 })
      other = new RateLimiter({ maxAttempts: 5, windowMs: 1000 })
    })

    afterEach(() => {
      other.destroy()
    })

    it('spends one attempt from every bucket when all have budget', () => {
      expect(
        reserve([
          [limiter, 'a'],
          [other, 'b'],
        ]).limited
      ).toBe(false)

      expect(limiter.hit('a').remaining).toBe(0)
      expect(other.hit('b').remaining).toBe(3)
    })

    it('refuses without spending any bucket when one is spent', () => {
      limiter.hit('a')
      limiter.hit('a')

      const attempt = reserve([
        [limiter, 'a'],
        [other, 'b'],
      ])

      expect(attempt.limited).toBe(true)
      expect(other.hit('b').remaining).toBe(4)
    })

    it('reports the wait until every bucket has budget again', () => {
      limiter.hit('a')
      limiter.hit('a')
      vi.advanceTimersByTime(300)

      const attempt = reserve([
        [limiter, 'a'],
        [other, 'b'],
      ])

      expect(attempt).toEqual({ limited: true, retryAfterMs: 700 })
    })

    it('gives the attempt back to every bucket on release', () => {
      const attempt = reserve([
        [limiter, 'a'],
        [other, 'b'],
      ])
      if (attempt.limited) throw new Error('expected an admitted attempt')

      attempt.release()

      expect(limiter.hit('a').remaining).toBe(1)
      expect(other.hit('b').remaining).toBe(4)
    })

    it('removes only its own attempt when released twice', () => {
      const first = reserve([[other, 'b']])
      const second = reserve([[other, 'b']])
      if (first.limited || second.limited) throw new Error('expected admits')

      first.release()
      first.release()

      expect(other.hit('b').remaining).toBe(3)
    })
  })
})
