/** Abort a stuck request rather than relying on Mailgun's default (0 = none). */
export const REQUEST_TIMEOUT_MS = 30_000

const MAX_ATTEMPTS = 3
const RETRY_BASE_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry only on likely-transient failures: network/timeout errors (no status),
 * rate limiting (429), or server errors (5xx). Client errors (4xx) fail fast.
 */
export function isTransient(error: unknown): boolean {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : undefined
  if (status === undefined) return true // no status => network/timeout
  if (status === 429) return true
  return typeof status === 'number' && status >= 500
}

/** Run `send`, retrying transient failures with exponential backoff. */
export async function withRetry(send: () => Promise<unknown>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await send()
      return
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isTransient(error)) throw error
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1))
    }
  }
}
