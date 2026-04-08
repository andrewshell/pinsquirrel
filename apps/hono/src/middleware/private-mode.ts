import type { MiddlewareHandler } from 'hono'
import { getSessionManager } from './session'

export function requirePrivateUnlock(): MiddlewareHandler {
  return async (c, next) => {
    const sessionManager = getSessionManager(c)

    if (!sessionManager.isPrivateUnlocked()) {
      // For HTMX requests, use HX-Redirect header
      if (c.req.header('HX-Request')) {
        c.header('HX-Redirect', '/private/unlock')
        return c.body(null, 200)
      }
      return c.redirect('/private/unlock')
    }

    await next()
  }
}
