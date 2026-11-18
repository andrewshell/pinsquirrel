import { describe, it, expect } from 'vitest'
import { WriteConflictError } from '@pinsquirrel/domain'
import {
  isDeadlockError,
  isLockWaitTimeoutError,
  writeOrConflict,
} from './deadlock.js'

const deadlock = () =>
  new Error('Failed query', {
    cause: Object.assign(new Error('Deadlock found'), {
      code: 'ER_LOCK_DEADLOCK',
    }),
  })

const lockWaitTimeout = () =>
  new Error('Failed query', {
    cause: Object.assign(new Error('Lock wait timeout exceeded'), {
      code: 'ER_LOCK_WAIT_TIMEOUT',
    }),
  })

describe('writeOrConflict', () => {
  it('returns the result of a transaction that commits', async () => {
    let runs = 0

    expect(await writeOrConflict(() => Promise.resolve(++runs))).toBe(1)
  })

  it('runs the transaction once more after a deadlock', async () => {
    let runs = 0
    const transaction = () =>
      ++runs === 1 ? Promise.reject(deadlock()) : Promise.resolve(runs)

    expect(await writeOrConflict(transaction)).toBe(2)
  })

  it('throws a write conflict for a second deadlock, after two runs', async () => {
    let runs = 0
    const transaction = () => {
      runs++
      return Promise.reject(deadlock())
    }

    const thrown: unknown = await writeOrConflict(transaction).catch(
      (error: unknown) => error
    )

    expect(thrown).toBeInstanceOf(WriteConflictError)
    expect((thrown as Error).message).toBe(
      'The write lost two deadlocks and changed nothing'
    )
    expect((thrown as Error).cause).toSatisfy(isDeadlockError)
    expect(runs).toBe(2)
  })

  it('throws a write conflict for a lock wait that timed out, without running again', async () => {
    let runs = 0
    const transaction = () => {
      runs++
      return Promise.reject(lockWaitTimeout())
    }

    const thrown: unknown = await writeOrConflict(transaction).catch(
      (error: unknown) => error
    )

    expect(thrown).toBeInstanceOf(WriteConflictError)
    expect((thrown as Error).message).toBe(
      'The write waited too long for a lock and changed nothing'
    )
    expect((thrown as Error).cause).toSatisfy(isLockWaitTimeoutError)
    expect(runs).toBe(1)
  })

  it('throws a write conflict for a lock wait that timed out on the second run', async () => {
    let runs = 0
    const transaction = () =>
      Promise.reject(++runs === 1 ? deadlock() : lockWaitTimeout())

    await expect(writeOrConflict(transaction)).rejects.toBeInstanceOf(
      WriteConflictError
    )
    expect(runs).toBe(2)
  })

  it('throws any other failure without running again', async () => {
    let runs = 0
    const transaction = () => {
      runs++
      return Promise.reject(new Error('duplicate key'))
    }

    await expect(writeOrConflict(transaction)).rejects.toThrow('duplicate key')
    expect(runs).toBe(1)
  })
})
