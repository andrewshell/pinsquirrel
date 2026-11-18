import { describe, it, expect } from 'vitest'
import { WriteConflictError } from '@pinsquirrel/domain'
import { isDeadlockError, retryOnDeadlock } from './deadlock.js'

const deadlock = () =>
  new Error('Failed query', {
    cause: Object.assign(new Error('Deadlock found'), {
      code: 'ER_LOCK_DEADLOCK',
    }),
  })

describe('retryOnDeadlock', () => {
  it('returns the result of a transaction that commits', async () => {
    let runs = 0

    expect(await retryOnDeadlock(() => Promise.resolve(++runs))).toBe(1)
  })

  it('runs the transaction once more after a deadlock', async () => {
    let runs = 0
    const transaction = () =>
      ++runs === 1 ? Promise.reject(deadlock()) : Promise.resolve(runs)

    expect(await retryOnDeadlock(transaction)).toBe(2)
  })

  it('throws a write conflict for a second deadlock, after two runs', async () => {
    let runs = 0
    const transaction = () => {
      runs++
      return Promise.reject(deadlock())
    }

    const thrown: unknown = await retryOnDeadlock(transaction).catch(
      (error: unknown) => error
    )

    expect(thrown).toBeInstanceOf(WriteConflictError)
    expect((thrown as Error).cause).toSatisfy(isDeadlockError)
    expect(runs).toBe(2)
  })

  it('throws any other failure without running again', async () => {
    let runs = 0
    const transaction = () => {
      runs++
      return Promise.reject(new Error('duplicate key'))
    }

    await expect(retryOnDeadlock(transaction)).rejects.toThrow('duplicate key')
    expect(runs).toBe(1)
  })
})
