/**
 * The scope check a write tool runs before it touches a service.
 *
 * MCP has no equivalent of an HTTP status, so the refusal travels as a thrown
 * error that `mapDomainErrorToMcp()` turns into a tool error the model can
 * read. That is why the message is written for a model rather than for a log:
 * a tool that simply failed teaches an agent to retry, and the one thing an
 * agent cannot fix by retrying is a scope it was never granted.
 *
 * It lives beside the tools rather than inside `server.ts` so it can be tested
 * without constructing an `McpServer` and the services behind it.
 */

/** The granted scopes, as the SDK hands them to a tool handler. */
interface ScopedExtra {
  authInfo?: { scopes?: string[] }
}

export class InsufficientScopeError extends Error {
  constructor(readonly scope: string) {
    super(
      `This tool requires the ${scope} scope, which this connection was not ` +
        `granted. Reconnect to PinSquirrel and approve ${scope} to use it.`
    )
    this.name = 'InsufficientScopeError'
  }
}

/**
 * Throws unless the connection was granted `scope`.
 *
 * Fails closed: a handler reached with no `authInfo` is a wiring mistake, and
 * reading a missing scope list as "no restrictions" would turn that mistake
 * into an unauthenticated write.
 */
export function requireScope(extra: ScopedExtra, scope: string): void {
  const granted = extra.authInfo?.scopes ?? []
  if (!granted.includes(scope)) {
    throw new InsufficientScopeError(scope)
  }
}
