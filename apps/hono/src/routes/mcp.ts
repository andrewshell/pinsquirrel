import { Hono } from 'hono'
import { StreamableHTTPTransport } from '@hono/mcp'
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js'
import { mcpAuth } from '../mcp/auth.js'
import { createMcpServer } from '../mcp/server.js'
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

/**
 * A server and a transport per request: the SDK's stateless Streamable HTTP
 * pattern, which is the only shape that serves more than one client.
 *
 * A transport built once at module load holds one session for the whole
 * process. It refuses the second `initialize` anybody sends ("Server already
 * initialized"), 404s any other `mcp-session-id`, and - worse, because it is
 * silent - maps a response back to its HTTP request by JSON-RPC id alone, so
 * two clients that both number a request `1` can be handed each other's
 * answer. Per request, each caller gets its own mapping and its own session
 * state, and `sessionIdGenerator: undefined` means no client has to carry a
 * session header at all.
 *
 * `enableJsonResponse: true` is what makes the cleanup honest: the response is
 * one JSON body rather than an SSE stream, so `handleRequest` resolves only
 * once the tool result has been written, and there is nothing still reading
 * from the transport when we close it. Nothing outlives the request, which is
 * also what keeps the transport's per-request maps from growing without bound.
 */
mcpRoute.post('/', async c => {
  const server = createMcpServer()
  const transport = new StreamableHTTPTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  try {
    await server.connect(transport)
    const response = await transport.handleRequest(c)
    // Typed as optional, but every POST branch returns a response. The
    // fallback matches the one the transport gives a notification-only batch.
    return response ?? c.json(null, 202)
  } finally {
    // Also on the way out of a thrown HTTPException, so a refused request
    // leaves nothing behind either.
    await transport.close()
    await server.close()
  }
})

/**
 * GET and DELETE, plus anything else, are 405.
 *
 * There is no session to resume with a server-initiated stream and none to
 * terminate, which is what stateless means. The MCP spec has clients treat a
 * 405 on the GET stream as "not offered" rather than as an error.
 */
mcpRoute.all('/', c =>
  c.json(
    {
      jsonrpc: '2.0',
      error: {
        code: ErrorCode.ConnectionClosed,
        message: 'Method not allowed.',
      },
      id: null,
    },
    405,
    { Allow: 'POST' }
  )
)

export { mcpRoute as mcpRoutes }
