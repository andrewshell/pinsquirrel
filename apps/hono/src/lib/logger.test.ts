import pino from 'pino'
import { describe, it, expect } from 'vitest'
import { safeError } from './logger'

class QueryError extends Error {
  constructor(
    readonly query: string,
    readonly params: unknown[],
    cause?: unknown
  ) {
    super(`Failed query: ${query}\nparams: ${params.join(',')}`, { cause })
    this.name = 'DrizzleQueryError'
  }
}

function mysqlError(code: string, errno: number, message: string): Error {
  return Object.assign(new Error(message), { code, errno })
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

  const deadlock = () =>
    new QueryError(
      'insert into `oauth_tokens` values (?)',
      ['alice'],
      mysqlError(
        'ER_LOCK_DEADLOCK',
        1213,
        'Deadlock found when trying to get lock; try restarting transaction'
      )
    )

  it('keeps the MySQL error code and message under a failed query', () => {
    const logged = safeError(deadlock())

    expect(logged).toMatchObject({
      message: 'Failed query: insert into `oauth_tokens` values (?)',
      code: 'ER_LOCK_DEADLOCK',
      errno: 1213,
      cause:
        'Deadlock found when trying to get lock; try restarting transaction',
    })
    expect(JSON.stringify(logged)).not.toContain('alice')
  })

  it('keeps the MySQL error code through the logger error serializer', () => {
    const serialized = pino.stdSerializers.err(
      safeError(deadlock()) as unknown as Error
    )

    expect(serialized).toMatchObject({
      code: 'ER_LOCK_DEADLOCK',
      errno: 1213,
      cause:
        'Deadlock found when trying to get lock; try restarting transaction',
    })
  })

  it.each([
    [
      'ER_DUP_ENTRY',
      1062,
      "Duplicate entry 'alice' for key 'users.users_username_unique'",
      "Duplicate entry [REDACTED] for key 'users.users_username_unique'",
    ],
    [
      'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD',
      1366,
      "Incorrect string value: 'alice' for column 'title' at row 1",
      "Incorrect string value: [REDACTED] for column 'title' at row 1",
    ],
  ])(
    'leaves the value a %s message repeats out of the log',
    (code, errno, message, expected) => {
      const logged = safeError(
        new QueryError(
          'insert into `users` values (?)',
          ['x'],
          mysqlError(code, errno, message)
        )
      )

      expect(logged.cause).toBe(expected)
      expect(JSON.stringify(logged)).not.toContain('alice')
    }
  )
})
