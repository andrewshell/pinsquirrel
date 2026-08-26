import type { ExtensionStorage, StorageKey } from './types.ts'

/**
 * `chrome.storage.local`, typed against `ExtensionStorage`.
 *
 * The point of the wrapper is the type: `chrome.storage` is a bag of
 * `unknown`, so without one every reader casts, and a key typo reads as
 * `undefined` forever rather than failing to compile.
 *
 * `local` and nothing else. `chrome.storage.sync` replicates across every
 * machine a user is signed into and is not a secret store, so refresh tokens
 * must never go near it (Decision 17). Keeping the area name in exactly one
 * place is what makes that reviewable.
 */

function area(): chrome.storage.StorageArea {
  return chrome.storage.local
}

/** One value, or `undefined` if it was never written. */
export async function get<K extends StorageKey>(
  key: K
): Promise<ExtensionStorage[K] | undefined> {
  const items = await area().get<Partial<ExtensionStorage>>(key)
  return items[key]
}

/** Several values at once, for a caller that would otherwise await in a loop. */
export async function getMany<K extends StorageKey>(
  keys: K[]
): Promise<Partial<Pick<ExtensionStorage, K>>> {
  return area().get<Partial<Pick<ExtensionStorage, K>>>(keys)
}

/** Write the given keys, leaving every other key alone. */
export async function set(values: Partial<ExtensionStorage>): Promise<void> {
  await area().set(values)
}

/** Drop the given keys. Removing a key that is not there is not an error. */
export async function remove(keys: StorageKey[]): Promise<void> {
  await area().remove(keys)
}

/** Drop everything the extension has stored. */
export async function clear(): Promise<void> {
  await area().clear()
}
