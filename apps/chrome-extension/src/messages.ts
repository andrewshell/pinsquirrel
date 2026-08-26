/**
 * The contract between the popup and the service worker.
 *
 * `chrome.runtime.sendMessage` carries `any` in both directions, so without a
 * shared module the two halves of the extension would each describe the
 * message in their own words and a rename on one side would compile fine on
 * the other. Both sides import these types; the guards are how the untyped
 * value coming off the channel is turned into one of them.
 *
 * The popup (5d) sends. The service worker (5f) answers.
 */

/** "Sync the selected tags into bookmarks now." */
export interface SyncRequest {
  type: 'sync'
}

/** Every message the popup can send. One so far. */
export type ExtensionMessage = SyncRequest

/**
 * What the worker answers a `SyncRequest` with.
 *
 * A failure travels as a value rather than a rejection: an exception thrown
 * inside a message handler does not cross the channel, it just leaves the
 * sender waiting on a response that never comes.
 */
export type SyncResponse = { ok: true } | { ok: false; error: string }

/** The request itself, which carries no arguments. */
export const SYNC_REQUEST: SyncRequest = { type: 'sync' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** For the worker: is this untyped message the popup's sync request? */
export function isSyncRequest(value: unknown): value is SyncRequest {
  return isRecord(value) && value.type === 'sync'
}

/** For the popup: did the worker answer in the shape it promised? */
export function isSyncResponse(value: unknown): value is SyncResponse {
  if (!isRecord(value)) return false
  if (value.ok === true) return true
  return value.ok === false && typeof value.error === 'string'
}

/**
 * Ask the service worker to sync, and always come back with a `SyncResponse`.
 *
 * Two things that are not failures of the sync itself are reported as one
 * anyway, because the popup has the same job either way - say why nothing
 * happened. A worker that is not installed yet rejects the send with "Receiving
 * end does not exist"; a worker that returns without answering resolves it with
 * `undefined`.
 */
export async function requestSync(): Promise<SyncResponse> {
  let answer: unknown
  try {
    answer = await chrome.runtime.sendMessage(SYNC_REQUEST)
  } catch (error) {
    return { ok: false, error: messageOf(error) }
  }

  if (isSyncResponse(answer)) return answer
  return {
    ok: false,
    error: 'The extension background worker did not answer the sync request',
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
