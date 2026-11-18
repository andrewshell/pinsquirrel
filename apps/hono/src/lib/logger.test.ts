import { describe, it, expect } from 'vitest'
import { safeError } from './logger'

class QueryError extends Error {
  constructor(
    readonly query: string,
    readonly params: unknown[]
  ) {
    super(`Failed query: ${query}\nparams: ${params.join(',')}`)
    this.name = 'DrizzleQueryError'
  }
}

describe('safeError', () => {
  it('keeps the message and stack of an ordinary error', () => {
    const logged = safeError(new Error('socket hang up'))

    expect(logged.message).toBe('socket hang up')
    expect(logged.stack).toContain('socket hang up')
  })

  it('leaves the bound parameters of a failed query out of the log', () => {
    const logged = safeError(
      new QueryError('insert into `users` values (?, ?)', [
        'alice',
        'alice@example.com',
      ])
    )

    expect(logged.message).toBe(
      'Failed query: insert into `users` values (?, ?)'
    )
    expect(JSON.stringify(logged)).not.toContain('alice')
  })
})
