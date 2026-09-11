/**
 * The contract between the options page and the service worker.
 *
 * `chrome.runtime.sendMessage` carries `any` in both directions, so without a
 * shared module the two halves of the extension would each describe the
 * message in their own words and a rename on one side would compile fine on
 * the other. Both sides import these types; the guards are how the untyped
 * value coming off the channel is turned into one of them.
 *
 * The options page sends. The service worker answers.
 */

/** "Sync the selected tags into bookmarks now." */
export interface SyncRequest {
  type: 'sync'
}

/**
 * "Connect to this server": open the consent screen in a tab.
 *
 * The page cannot run this itself. The flow ends in a tab the worker watches,
 * and the answer can come minutes later - after the page has been closed, and
 * after the worker that opened the tab has been unloaded. So the page asks the
 * worker, which is woken again by the tab's navigation, and reads the tokens
 * out of storage next time it opens.
 */
export interface ConnectRequest {
  type: 'connect'
  /** The origin to connect to, already normalized by the options page. */
  baseUrl: string
}

/** Every message the options page can send. */
export type ExtensionMessage = SyncRequest | ConnectRequest

/**
 * The worker's word that the consent tab has answered, sent to whoever is
 * listening - the options page, if it is still open.
 *
 * Sent rather than answered: the `ConnectRequest` was answered when the tab
 * opened, and this is what came of it. Nothing rests on it arriving; the
 * tokens are in storage first, and a page that opens later reads them there.
 */
export interface ConnectFinished {
  type: 'connect-finished'
  result: ConnectResponse
}

/**
 * What the worker answers a `SyncRequest` with.
 *
 * A failure travels as a value rather than a rejection: an exception thrown
 * inside a message handler does not cross the channel, it just leaves the
 * sender waiting on a response that never comes.
 */
export type SyncResponse = { ok: true } | { ok: false; error: string }

/**
 * What the worker answers a `ConnectRequest` with - `ok` meaning the consent
 * tab is open, not that the user is connected - and what a `ConnectFinished`
 * carries once the tab has answered.
 *
 * `reauthorizationRequired` is how the one failure the options page renders
 * differently survives the trip: `ReauthorizationRequiredError` is a class, and
 * a class does not cross the message channel - only its message would arrive,
 * and the page would show it as ordinary status text.
 */
export type ConnectResponse =
  { ok: true } | { ok: false; error: string; reauthorizationRequired?: boolean }

/** The sync request itself, which carries no arguments. */
export const SYNC_REQUEST: SyncRequest = { type: 'sync' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** For the worker: is this untyped message the options page's sync request? */
export function isSyncRequest(value: unknown): value is SyncRequest {
  return isRecord(value) && value.type === 'sync'
}

/** For the worker: is this untyped message the options page's connect request? */
export function isConnectRequest(value: unknown): value is ConnectRequest {
  return (
    isRecord(value) &&
    value.type === 'connect' &&
    typeof value.baseUrl === 'string'
  )
}

/** For the options page: did the worker answer in the shape it promised? */
export function isSyncResponse(value: unknown): value is SyncResponse {
  if (!isRecord(value)) return false
  if (value.ok === true) return true
  return value.ok === false && typeof value.error === 'string'
}

/** For the options page: is this untyped message the worker's word that the tab answered? */
export function isConnectFinished(value: unknown): value is ConnectFinished {
  return (
    isRecord(value) &&
    value.type === 'connect-finished' &&
    isConnectResponse(value.result)
  )
}

/** For the options page: did the worker answer in the shape it promised? */
export function isConnectResponse(value: unknown): value is ConnectResponse {
  if (!isRecord(value)) return false
  if (value.ok === true) return true
  if (value.ok !== false || typeof value.error !== 'string') return false
  const flag = value.reauthorizationRequired
  return flag === undefined || typeof flag === 'boolean'
}

/**
 * Ask the service worker to sync, and always come back with a `SyncResponse`.
 *
 * Two things that are not failures of the sync itself are reported as one
 * anyway, because the page has the same job either way - say why nothing
 * happened. A worker that is not installed yet rejects the send with "Receiving
 * end does not exist"; a worker that returns without answering resolves it with
 * `undefined`.
 */
export async function requestSync(): Promise<SyncResponse> {
  return send(SYNC_REQUEST, isSyncResponse, 'sync')
}

/**
 * Ask the service worker to open the consent screen for `baseUrl`.
 *
 * Answers the same way `requestSync` does, and `ok` means only that the tab
 * is open. What came of it arrives later through `onConnectFinished`, if the
 * page is still there to hear it; either way the worker has stored the tokens
 * before saying so, and a page that opens later reads them from storage.
 */
export async function requestConnect(
  baseUrl: string
): Promise<ConnectResponse> {
  return send({ type: 'connect', baseUrl }, isConnectResponse, 'connect')
}

/**
 * For the options page: hear the worker say the consent tab has answered.
 *
 * Messages from anything else on the channel are not for this listener and
 * are left alone, including the page's own requests echoing past.
 */
export function onConnectFinished(
  listener: (result: ConnectResponse) => void
): void {
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (isConnectFinished(message)) listener(message.result)
    return false
  })
}

/**
 * For the worker: tell the options page the consent tab has answered.
 *
 * A page that is not open rejects the send with "Receiving end does not
 * exist", which is nothing to act on - the tokens are already in storage,
 * and the page reads them there next time. So the rejection is swallowed.
 */
export async function notifyConnectFinished(
  result: ConnectResponse
): Promise<void> {
  const message: ConnectFinished = { type: 'connect-finished', result }
  try {
    await chrome.runtime.sendMessage(message)
  } catch {
    // Nobody listening. See above.
  }
}

/** One round trip to the worker, with both of its non-answers as failures. */
async function send<T extends { ok: boolean }>(
  message: ExtensionMessage,
  isResponse: (value: unknown) => value is T,
  what: string
): Promise<T | { ok: false; error: string }> {
  let answer: unknown
  try {
    answer = await chrome.runtime.sendMessage(message)
  } catch (error) {
    return { ok: false, error: messageOf(error) }
  }

  if (isResponse(answer)) return answer
  return {
    ok: false,
    error: `The extension background worker did not answer the ${what} request`,
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
