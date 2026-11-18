export interface DeferredWork {
  /** Runs work the response does not wait for; a failure goes to `onError`. */
  defer(work: () => Promise<void>): void
  readonly pending: number
  /**
   * Waits for every task, including tasks deferred while waiting, for at most
   * `timeoutMs`. Resolves to the number still running when it stopped.
   */
  drain(timeoutMs: number): Promise<number>
}

export function createDeferredWork(
  onError: (error: unknown) => void
): DeferredWork {
  const running = new Set<Promise<void>>()

  return {
    defer(work) {
      const task: Promise<void> = Promise.resolve()
        .then(work)
        .catch(onError)
        .finally(() => running.delete(task))
      running.add(task)
    },

    get pending() {
      return running.size
    },

    async drain(timeoutMs) {
      let timer: NodeJS.Timeout | undefined
      const timedOut = new Promise<true>(resolve => {
        timer = setTimeout(() => resolve(true), timeoutMs)
      })
      while (running.size > 0) {
        const settled = Promise.allSettled([...running]).then(() => false)
        if (await Promise.race([settled, timedOut])) break
      }
      clearTimeout(timer)
      return running.size
    },
  }
}
