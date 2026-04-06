import type { Context, MiddlewareHandler } from 'hono'
import { RateLimiter } from './rate-limiter'

export function getClientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',')
    return parts[parts.length - 1].trim()
  }
  return c.req.header('x-real-ip') ?? 'unknown'
}

export const signinLimiter = new RateLimiter({
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
