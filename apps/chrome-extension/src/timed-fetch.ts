/**
 * How long a request to the server may take before it is abandoned.
 *
 * Under 30 seconds because Chrome tears down an extension service worker whose
 * `fetch` response takes longer than that: a shorter limit fails the request
 * in the worker, which can still record why, instead of losing the worker
 * mid-run. A token refresh holds the lock the options page and the worker
 * share, so a request that never answers must end, or neither can refresh.
 */
const REQUEST_TIMEOUT_SECONDS = 20

/** `fetch`, given up on after `REQUEST_TIMEOUT_SECONDS` with an error naming the URL. */
export async function timedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_SECONDS * 1000)
  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error(
        `${input instanceof Request ? input.url : String(input)} did not answer within ${REQUEST_TIMEOUT_SECONDS} seconds`,
        { cause: error }
      )
    }
    throw error
  }
}
