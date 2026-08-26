/**
 * The types shared across the extension.
 *
 * Decision 5: this package has no workspace dependencies, so anything the
 * server also knows about is restated here rather than imported from
 * `@pinsquirrel/domain`. It talks to PinSquirrel over HTTP and nothing else.
 */

/**
 * Everything the extension keeps in `chrome.storage.local`.
 *
 * One flat record rather than a nested object, because `chrome.storage` reads
 * and writes by top-level key: a nested shape would mean reading the whole
 * blob to change one field, and two writers racing on it would lose data.
 *
 * Every key is optional at rest - `storage.get` answers `undefined` for one
 * that was never written - so the type describes what a key means, not what is
 * guaranteed to be there.
 */
export interface ExtensionStorage {
  /** The PinSquirrel origin the user connected to, e.g. `https://pinsquirrel.com`. */
  baseUrl: string
  /** The `client_id` the current tokens were issued to. */
  clientId: string
  /** The `pso_` bearer token, bound to the `<baseUrl>/api/v1` resource. */
  accessToken: string
  /** Rotated on every refresh; the newest one is always the stored one. */
  refreshToken: string
  /** When `accessToken` stops working, as epoch milliseconds. */
  expiresAt: number
  /** Tags the user picked to mirror into bookmarks (Phase 5d). */
  selectedTagIds: string[]
  /** Epoch milliseconds of the last successful sync (Phase 5e). */
  lastSyncAt: number
  /** Why the last sync failed, or absent if it did not (Phase 5e). */
  lastSyncError: string
  /**
   * Dynamically registered `client_id`s, keyed by the base URL they were
   * registered with, so connecting a second time reuses the first
   * registration instead of posting to `/oauth/register` again.
   */
  registeredClients: Record<string, string>
}

/** A key `chrome.storage.local` holds for this extension. */
export type StorageKey = keyof ExtensionStorage

/**
 * One OAuth grant as the extension holds it: which server, which client, and
 * the two tokens with the moment the first of them dies.
 */
export type StoredTokens = Pick<
  ExtensionStorage,
  'baseUrl' | 'clientId' | 'accessToken' | 'refreshToken' | 'expiresAt'
>
