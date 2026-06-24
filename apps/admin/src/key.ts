import { readFileSync } from 'node:fs'
import { isEncryptedPrivateKey, loadPrivateKey } from '@pinsquirrel/crypto'

/** Read a private key file from disk, with a clear error if it's missing. */
export function readKeyFile(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    throw new Error(`Could not read private key at ${path}`, { cause: error })
  }
}

/** Whether the key file is passphrase-encrypted (so the UI must prompt). */
export function keyNeedsPassphrase(contents: string): boolean {
  return isEncryptedPrivateKey(contents)
}

/** Decrypt/return the base64 private key. Throws on a wrong/missing passphrase. */
export function unlockPrivateKey(
  contents: string,
  passphrase?: string
): Promise<string> {
  return loadPrivateKey(contents, passphrase)
}
