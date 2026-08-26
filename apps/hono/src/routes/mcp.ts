import { Hono } from 'hono'
import { mcpAuth } from '../mcp/auth.js'
import { mcpTransport } from '../mcp/server.js'
import { oauthConfig } from '../lib/config.js'
import { mcpLimiter, rateLimitByIp } from '../middleware/rate-limit.js'

const mcpRoute = new Hono()

// Ahead of the auth check on purpose: a caller with no token should not be
// able to spend a database round trip per request. The resource is
// authenticated, so what this bounds is abuse and runaway clients rather than
// credential guessing, which is why the budget is generous.
mcpRoute.use(
  '*',
  rateLimitByIp(mcpLimiter, 'Too many requests. Please try again later.')
)
mcpRoute.use('*', mcpAuth(oauthConfig.resources.mcp))

mcpRoute.all('/', async c => {
  return mcpTransport.handleRequest(c)
})

export { mcpRoute as mcpRoutes }
