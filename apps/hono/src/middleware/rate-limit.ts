import type { Context, MiddlewareHandler } from 'hono'
import { getConnInfo } from '@hono/node-server/conninfo'
import { RateLimiter } from './rate-limiter'

// getConnInfo reaches into c.env.incoming.socket, which only exists when the
// request came through the Node server. Under app.request() in tests, and in
// any other non-Node context, it throws rather than returning undefined.
function socketAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address
  } catch {
    return undefined
  }
}

export function getClientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff) {
    // The last entry, not the first: a single trusted proxy appends the peer
    // it actually received from, so anything earlier is client-supplied and
    // spoofable.
    const parts = xff.split(',')
    return parts[parts.length - 1].trim()
  }
  // No proxy header means the request did not come through the reverse proxy.
  // Falling back to the socket peer keeps each such caller in its own bucket;
  // a single shared literal here would let one attacker exhaust the limit for
  // everyone else at once.
  return c.req.header('x-real-ip') ?? socketAddress(c) ?? 'unknown'
}

export const signinLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
})

// Keyed on the address alone, so it still counts when the attacker rotates
// usernames. Deliberately far looser than signinLimiter: a shared office NAT
// or CGNAT puts real users behind one address, and this must not trip for them.
export const signinIpLimiter = new RateLimiter({
  maxAttempts: 20,
  windowMs: 15 * 60 * 1000,
})

// Keyed on the user id rather than the address: unlocking requires an
// authenticated session, so whoever is guessing already holds the cookie and
// their IP proves nothing - rotating it must not buy them a fresh budget.
export const privateUnlockLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
})

export const signupLimiter = new RateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
})

export const forgotPasswordLimiter = new RateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
})

export function rateLimitByIp(
  limiter: RateLimiter,
  message = 'Too many requests. Please try again later.'
): MiddlewareHandler {
  return async (c, next) => {
    const ip = getClientIp(c)
    const result = limiter.hit(ip)
    if (result.limited) {
      c.header('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)))
      return c.text(message, 429)
    }
    await next()
  }
}

export function signinRateLimitKey(c: Context, username: string): string {
  return `${getClientIp(c)}:${username.toLowerCase()}`
}
