import { secureHeaders } from 'hono/secure-headers'
import { cors } from 'hono/cors'
import type { Context, Next } from 'hono'

export const corsMiddleware = cors({
  origin:
    process.env.NODE_ENV === 'development'
      ? ['http://localhost:3000', 'http://localhost:5173']
      : [],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
})

export const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
  },
})

export const rateLimitMiddleware = (
  limit: number = 100,
  windowMs: number = 60000
) => {
  const requests = new Map<string, { count: number; resetTime: number }>()

  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const now = Date.now()

    const clientData = requests.get(ip)

    if (!clientData || now > clientData.resetTime) {
      requests.set(ip, { count: 1, resetTime: now + windowMs })
      return next()
    }

    if (clientData.count >= limit) {
      return c.json({ error: 'Rate limit exceeded' }, 429)
    }

    clientData.count++
    return next()
  }
}
