import type { MiddlewareHandler } from 'hono'
import { isEmbedRequest, withEmbed } from '../lib/embed'
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
      return c.redirect(unlockUrl(c.req.url, isEmbedRequest(c)))
    }

    await next()
  }
}

/**
 * Where a locked request is sent.
 *
 * In embed mode the unlock page has to bring the user back to the page they
 * were on, still in embed - the popup has no nav to find it again - so the
 * path and query travel on `redirectTo`, the way `requireAuth()` does it. The
 * ordinary page keeps the plain redirect: the list is one click away there.
 */
function unlockUrl(requestUrl: string, embed: boolean): string {
  if (!embed) return '/private/unlock'
  const url = new URL(requestUrl)
  const currentPath = url.pathname + url.search
  return withEmbed(
    `/private/unlock?redirectTo=${encodeURIComponent(currentPath)}`,
    true
  )
}
