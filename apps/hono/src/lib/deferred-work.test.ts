import { describe, expect, it, vi } from 'vitest'
import { createDeferredWork } from './deferred-work'

function gate() {
  let open = () => {}
  const opened = new Promise<void>(resolve => (open = resolve))
  return { open, opened }
}

describe('deferred work', () => {
  it('drains only once the work it holds has finished', async () => {
    const deferred = createDeferredWork(() => {})
    const { open, opened } = gate()
    let finished = false
    deferred.defer(async () => {
      await opened
      finished = true
    })
    expect(deferred.pending).toBe(1)

    const drained = deferred.drain(1000)
    open()

    expect(await drained).toBe(0)
    expect(finished).toBe(true)
    expect(deferred.pending).toBe(0)
  })

  it('also waits for work deferred while draining', async () => {
    const deferred = createDeferredWork(() => {})
    const { open, opened } = gate()
    let finished = false
    deferred.defer(async () => {
      await opened
      deferred.defer(async () => {
        await new Promise(resolve => setTimeout(resolve, 5))
        finished = true
      })
    })

    const drained = deferred.drain(1000)
    open()

    expect(await drained).toBe(0)
    expect(finished).toBe(true)
  })

  it('gives up at the timeout and counts what it abandons', async () => {
    const deferred = createDeferredWork(() => {})
    deferred.defer(() => new Promise(() => {}))
    deferred.defer(() => Promise.resolve())

    expect(await deferred.drain(10)).toBe(1)
  })

  it('reports failed work and does not count it as pending', async () => {
    const onError = vi.fn()
    const deferred = createDeferredWork(onError)
    const failure = new Error('mail down')
    deferred.defer(() => Promise.reject(failure))

    expect(await deferred.drain(1000)).toBe(0)
    expect(onError).toHaveBeenCalledWith(failure)
  })
})
