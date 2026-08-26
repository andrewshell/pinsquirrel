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
  // Forwarding headers are only worth anything when something the operator
  // controls writes them. Without TRUST_PROXY the app is reachable directly,
  // so a caller can set x-forwarded-for itself and rotate it per request to
  // get a fresh budget from every IP-keyed limiter - the socket peer is the
  // only thing it cannot forge. Read per call rather than at module load so
  // the deployment's env is what decides, not import order.
  if (process.env.TRUST_PROXY) {
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
    const realIp = c.req.header('x-real-ip')
    if (realIp) return realIp
  }
  return socketAddress(c) ?? 'unknown'
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

/**
 * Dynamic client registration, per IP.
 *
 * The tightest limit here, because `/oauth/register` is unauthenticated and
 * creates rows. A client registers once per fresh connection, so a handful an
 * hour covers even an office sharing one address; anything past that is
 * something filling the table.
 */
export const oauthRegisterLimiter = new RateLimiter({
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
})

/**
 * Token exchanges and refreshes, per IP.
 *
 * A working connection spends one request on the initial exchange and one an
 * hour refreshing, so this is generous by comparison: the thing being bounded
 * is somebody grinding authorization codes or refresh tokens, not normal use
 * behind a shared address.
 */
export const oauthTokenIpLimiter = new RateLimiter({
  maxAttempts: 60,
  windowMs: 15 * 60 * 1000,
})

/**
 * The same endpoint keyed on `client_id`, because a public client's IP proves
 * little: a native client refreshes from whatever address the user is on.
 *
 * Deliberately far looser than the per-IP limit. A CIMD `client_id` is one
 * string shared by every user of that application, so every Claude Code
 * installation in the world lands in this one bucket - a tight limit here
 * would be a self-inflicted outage rather than a defence.
 */
export const oauthTokenClientLimiter = new RateLimiter({
  maxAttempts: 300,
  windowMs: 15 * 60 * 1000,
})

/**
 * The two protected resources, per IP, one limiter each so a flood at one
 * cannot spend the other's budget.
 *
 * Both are authenticated, so this is about abuse and runaway clients rather
 * than brute force - there is no credential to guess here, and an agent
 * working through a large collection is legitimately chatty.
 */
export const mcpLimiter = new RateLimiter({
  maxAttempts: 300,
  windowMs: 5 * 60 * 1000,
})

export const apiV1Limiter = new RateLimiter({
  maxAttempts: 300,
  windowMs: 5 * 60 * 1000,
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

/**
 * Limit a form-encoded OAuth request on the `client_id` it names.
 *
 * Sits beside `rateLimitByIp` on `/oauth/token` rather than replacing it: the
 * IP bounds one caller, and this bounds one application across every address
 * its users happen to be on.
 *
 * Reading the body here is safe because Hono caches the parsed body on the
 * request, so the handler's own `parseBody()` sees the same object rather than
 * a consumed stream.
 *
 * A request that names no client spends no budget. There would be nothing to
 * key on but a shared empty string, and one malformed caller could then lock
 * every real client out; the IP limiter has already counted it either way.
 */
export function rateLimitByClientId(
  limiter: RateLimiter,
  message = 'Too many requests. Please try again later.'
): MiddlewareHandler {
  return async (c, next) => {
    let clientId: string | undefined
    try {
      const body = await c.req.parseBody()
      const value = body['client_id']
      if (typeof value === 'string' && value !== '') clientId = value
    } catch {
      // Not a body this middleware can read. The endpoint answers 415 to those,
      // which tells the caller far more than a rate-limit refusal would.
    }

    if (clientId) {
      const result = limiter.hit(clientId)
      if (result.limited) {
        c.header('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)))
        return c.text(message, 429)
      }
    }

    await next()
  }
}

export function signinRateLimitKey(c: Context, username: string): string {
  return `${getClientIp(c)}:${username.toLowerCase()}`
}
