import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { NotFoundPage } from '../views/pages/not-found'
import { ServerErrorPage } from '../views/pages/server-error'
import { logger, safeError } from './logger.js'

/**
 * Who a failure is addressed to, and therefore what it may be written in.
 *
 * Most of this app answers browsers, and a rendered page is the kindest thing
 * to hand a person who mistyped a URL. The paths below answer programs, where
 * the same page is a defect: an OAuth client probes the discovery documents it
 * might find - `/.well-known/oauth-authorization-server/mcp` before the root
 * form, `openid-configuration` after - and parses each response as JSON. An
 * HTML 404 ends the connection attempt with `Unexpected token '<'` instead of
 * a fallback to the document this server does serve, so the client never
 * reaches the working path at all.
 *
 * `/oauth/authorize` is deliberately absent: it is the consent screen, a page
 * a person looks at, so its failures belong in HTML like the rest of the site.
 */
const JSON_ERROR_PATHS = new Set([
  '/oauth/token',
  '/oauth/register',
  '/oauth/revoke',
])

/** True when the caller of `path` is a program rather than a browser. */
export function expectsJsonError(path: string): boolean {
  if (JSON_ERROR_PATHS.has(path)) return true
  if (path === '/.well-known' || path.startsWith('/.well-known/')) return true
  if (path === '/mcp' || path.startsWith('/mcp/')) return true
  return path.startsWith('/api/')
}

/**
 * The app-level 404. Nothing is reflected back from the request: the body is a
 * constant, so a path a caller invented cannot be echoed into a response.
 */
export function notFoundResponse(c: Context) {
  if (expectsJsonError(c.req.path)) {
    return c.json(
      {
        error: 'not_found',
        error_description: 'There is no resource at this path',
      },
      404
    )
  }

  return c.html(<NotFoundPage />, 404)
}

// Detect MySQL/network errors coming from mysql2 (possibly nested in `cause`)
function isDatabaseConnectionError(err: unknown): boolean {
  const dbCodes = new Set([
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'PROTOCOL_CONNECTION_LOST',
    'ER_ACCESS_DENIED_ERROR',
    'ER_BAD_DB_ERROR',
  ])
  const visited = new Set<unknown>()
  let cur: unknown = err
  while (cur && typeof cur === 'object' && !visited.has(cur)) {
    visited.add(cur)
    const code = (cur as { code?: unknown }).code
    if (typeof code === 'string' && dbCodes.has(code)) return true
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}

/**
 * The app-level 500.
 *
 * An `HTTPException` passes straight through: it carries the response its
 * thrower chose, which for the OAuth middleware is a 401 with the
 * `WWW-Authenticate` header a client follows to discovery. Rewriting it here
 * would strip the pointer.
 *
 * Everything else is logged and answered with one of two fixed messages. The
 * thrown error never reaches the body, so a connection string or a host in an
 * exception cannot be served to whoever provoked it.
 */
export function serverErrorResponse(err: unknown, c: Context) {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }

  logger.error({ err: safeError(err) }, 'Unhandled server error')

  const message = isDatabaseConnectionError(err)
    ? 'Unable to connect to the database. If you are running locally, make sure Docker is running and start the database with `pnpm db:up`.'
    : 'Something went wrong. Please try again later.'

  if (expectsJsonError(c.req.path)) {
    return c.json({ error: 'server_error', error_description: message }, 500)
  }

  return c.html(<ServerErrorPage message={message} />, 500)
}
