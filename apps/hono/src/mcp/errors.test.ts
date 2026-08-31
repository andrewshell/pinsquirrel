import { describe, it, expect } from 'vitest'
import {
  PinNotFoundError,
  TagNotFoundError,
  UnauthorizedPinAccessError,
  UnauthorizedTagAccessError,
  ValidationError,
} from '@pinsquirrel/domain'
import { mapDomainErrorToMcp } from './errors'
import { InsufficientScopeError } from './scopes'

function textOf(result: ReturnType<typeof mapDomainErrorToMcp>) {
  return result.content[0].text
}

describe('mapDomainErrorToMcp', () => {
  it('reports a validation failure without echoing the input', () => {
    const result = mapDomainErrorToMcp(new ValidationError({}))
    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe('Invalid request')
  })

  it('collapses an unknown error to a generic message', () => {
    expect(textOf(mapDomainErrorToMcp(new Error('connection refused')))).toBe(
      'Internal server error'
    )
  })

  // Ownership stays opaque: a pin that belongs to another user is reported
  // exactly as a pin that does not exist, down to the wording.
  it('reports a missing pin and another user’s pin identically', () => {
    const missing = mapDomainErrorToMcp(new PinNotFoundError('pin-1'))
    const foreign = mapDomainErrorToMcp(new UnauthorizedPinAccessError('pin-1'))
    expect(textOf(missing)).toBe('Pin not found')
    expect(textOf(foreign)).toBe('Pin not found')
  })

  it('reports a missing tag and another user’s tag identically', () => {
    const missing = mapDomainErrorToMcp(new TagNotFoundError('tag-1'))
    const foreign = mapDomainErrorToMcp(new UnauthorizedTagAccessError('tag-1'))
    expect(textOf(missing)).toBe('Tag not found')
    expect(textOf(foreign)).toBe('Tag not found')
  })

  // A scope refusal is the one failure an agent must not retry its way out of,
  // so unlike the others it says exactly what is wrong and what fixes it. The
  // scope names itself because the model reads this and nothing else.
  it('says which scope is missing and that reconnecting is the fix', () => {
    const result = mapDomainErrorToMcp(new InsufficientScopeError('pins:write'))

    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('pins:write')
    expect(textOf(result)).toContain('Reconnect')
    expect(textOf(result)).not.toBe('Internal server error')
  })
})
