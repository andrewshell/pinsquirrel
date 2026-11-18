import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DuplicatePinError,
  PinNotFoundError,
  TagNotFoundError,
  UnauthorizedPinAccessError,
  UnauthorizedTagAccessError,
  ValidationError,
} from '@pinsquirrel/domain'
vi.mock('../lib/logger.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/logger.js')>()),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { logger, safeError } from '../lib/logger.js'
import { mapDomainErrorToMcp } from './errors'
import { InsufficientScopeError } from './scopes'

function textOf(result: ReturnType<typeof mapDomainErrorToMcp>) {
  return result.content[0].text
}

describe('mapDomainErrorToMcp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports a validation failure without echoing the input', () => {
    const result = mapDomainErrorToMcp(new ValidationError({}))
    expect(result.isError).toBe(true)
    expect(textOf(result)).toBe('Invalid request')
  })

  it('logs an unknown error through safeError', () => {
    const failure = new Error(
      'Failed query: insert into `pins` values (?)\nparams: secret'
    )

    mapDomainErrorToMcp(failure)

    expect(logger.error).toHaveBeenCalledWith(
      { err: safeError(failure) },
      expect.any(String)
    )
  })

  it('does not log a refusal it maps', () => {
    mapDomainErrorToMcp(new PinNotFoundError('pin-1'))
    mapDomainErrorToMcp(new ValidationError({}))

    expect(logger.error).not.toHaveBeenCalled()
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

  // The duplicate is a pin the caller can already list over this surface, so
  // naming it leaks nothing and turns a dead end into the next call.
  it('names the existing pin on a duplicate URL and says what to call instead', () => {
    const result = mapDomainErrorToMcp(
      new DuplicatePinError('https://example.com', {
        id: 'pin-123',
        createdAt: new Date('2024-01-01'),
        isPrivate: false,
      })
    )

    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('pin-123')
    expect(textOf(result)).toContain('update_pin')
  })

  // The duplicate lookup is scoped to the user, not to what this surface may
  // see, so the collision can be a private pin - one that get_pin, update_pin
  // and delete_pin all report as missing. Naming its id here would hand back
  // an identifier for a pin the caller is otherwise told does not exist.
  it('withholds the id when the colliding pin is private', () => {
    const result = mapDomainErrorToMcp(
      new DuplicatePinError('https://example.com', {
        id: 'pin-123',
        createdAt: new Date('2024-01-01'),
        isPrivate: true,
      })
    )

    expect(result.isError).toBe(true)
    expect(textOf(result)).not.toContain('pin-123')
    expect(textOf(result)).toContain('already exists')
    expect(textOf(result)).toContain('update_pin')
  })

  // Fails closed: an error thrown without the flag is one whose collision we
  // cannot classify, and an unclassified pin is treated as unnameable.
  it('withholds the id when the error does not say', () => {
    const result = mapDomainErrorToMcp(
      new DuplicatePinError('https://example.com')
    )

    expect(textOf(result)).toContain('already exists')
    expect(textOf(result)).not.toContain('id:')
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
