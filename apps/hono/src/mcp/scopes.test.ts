import { describe, it, expect } from 'vitest'
import { InsufficientScopeError, requireScope } from './scopes'

/** What the SDK hands a tool handler, narrowed to the part the guard reads. */
function extraWith(scopes: string[]) {
  return { authInfo: { scopes } }
}

describe('requireScope', () => {
  it('returns quietly when the connection was granted the scope', () => {
    expect(() =>
      requireScope(extraWith(['pins:read', 'pins:write']), 'pins:write')
    ).not.toThrow()
  })

  it('refuses when the connection was not granted the scope', () => {
    expect(() =>
      requireScope(extraWith(['pins:read', 'tags:read']), 'pins:write')
    ).toThrow(InsufficientScopeError)
  })

  // The two writes are separate grants (Decision 21): an agent approved for
  // retagging pins has not thereby been approved to merge tags away.
  it('does not accept one write scope in place of the other', () => {
    expect(() => requireScope(extraWith(['pins:write']), 'tags:write')).toThrow(
      InsufficientScopeError
    )
    expect(() => requireScope(extraWith(['tags:write']), 'pins:write')).toThrow(
      InsufficientScopeError
    )
  })

  // The point of the guard. Every token issued before Phase 8 carries only
  // the reads, and being otherwise entirely valid does not earn it a write.
  it('refuses a token minted before the write scopes existed', () => {
    const legacy = extraWith(['pins:read', 'tags:read', 'offline_access'])

    expect(() => requireScope(legacy, 'pins:write')).toThrow(
      InsufficientScopeError
    )
    expect(() => requireScope(legacy, 'tags:write')).toThrow(
      InsufficientScopeError
    )
  })

  // A handler reached with no auth info at all is a wiring mistake, but it
  // must fail closed rather than read `undefined` as "no restrictions".
  it('refuses when there is no auth info to read scopes from', () => {
    expect(() => requireScope({}, 'pins:write')).toThrow(InsufficientScopeError)
  })

  it('names the scope it wanted, so the refusal can say which', () => {
    let thrown: unknown
    try {
      requireScope(extraWith([]), 'tags:write')
    } catch (err) {
      thrown = err
    }

    expect((thrown as InsufficientScopeError).scope).toBe('tags:write')
  })
})
