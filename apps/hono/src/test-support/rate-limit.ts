import type { RateLimiter } from '../middleware/rate-limiter'

/**
 * Under `app.request()` there is no socket and no trusted proxy header, so
 * `getClientIp` reports this for every request. It is the key every IP-keyed
 * limiter in a route test buckets under.
 */
export const TEST_CLIENT_IP = 'unknown'

/**
 * Spend a limiter's whole budget for one key.
 *
 * Written against `isLimited` rather than a repeated count so a test says
 * "once the quota is gone" and stays true when the quota is retuned.
 */
export function exhaust(limiter: RateLimiter, key: string): void {
  while (!limiter.isLimited(key)) limiter.hit(key)
}
