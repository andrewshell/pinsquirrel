import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto'

const FORMAT_VERSION = 1
const SALT_LEN = 16
const IV_LEN = 12
const KEY_LEN = 32
const GCM_TAG_LEN = 16

interface RawKeyFile {
  v: number
  encrypted: false
  privateKey: string
}

interface EncryptedKeyFile {
  v: number
  encrypted: true
  kdf: 'scrypt'
  salt: string
  iv: string
  tag: string
  ciphertext: string
}

type KeyFile = RawKeyFile | EncryptedKeyFile

function invalid(detail: string): never {
  throw new Error(`Invalid private key file: ${detail}`)
}

function requireString(obj: Record<string, unknown>, field: string): string {
  const value = obj[field]
  if (typeof value !== 'string' || value.length === 0) {
    invalid(`missing or invalid "${field}"`)
  }
  return value
}

// Validate a field is canonical base64, optionally with an exact decoded size,
// so malformed crypto material is rejected here as a deterministic parser error
// rather than blowing up later inside createDecipheriv/setAuthTag.
function requireBase64(
  obj: Record<string, unknown>,
  field: string,
  expectedBytes?: number
): string {
  const value = requireString(obj, field)
  const decoded = Buffer.from(value, 'base64')
  if (decoded.toString('base64') !== value) {
    invalid(`"${field}" is not valid base64`)
  }
  if (expectedBytes !== undefined && decoded.length !== expectedBytes) {
    invalid(
      `"${field}" must decode to ${expectedBytes} bytes (got ${decoded.length})`
    )
  }
  return value
}

function parseKeyFile(contents: string): KeyFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    invalid('not valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    invalid('expected a JSON object')
  }
  const obj = parsed as Record<string, unknown>

  if (obj.v !== FORMAT_VERSION) {
    invalid(`unsupported version ${JSON.stringify(obj.v)}`)
  }
  if (typeof obj.encrypted !== 'boolean') {
    invalid('missing or invalid "encrypted" flag')
  }

  if (!obj.encrypted) {
    return {
      v: FORMAT_VERSION,
      encrypted: false,
      privateKey: requireString(obj, 'privateKey'),
    }
  }

  if (obj.kdf !== 'scrypt') {
    invalid(`unsupported kdf ${JSON.stringify(obj.kdf)}`)
  }
  return {
    v: FORMAT_VERSION,
    encrypted: true,
    kdf: 'scrypt',
    salt: requireBase64(obj, 'salt', SALT_LEN),
    iv: requireBase64(obj, 'iv', IV_LEN),
    tag: requireBase64(obj, 'tag', GCM_TAG_LEN),
    ciphertext: requireBase64(obj, 'ciphertext'),
  }
}

/** Serialize an unencrypted private key into the self-describing file format. */
export function serializeRawPrivateKey(privateKeyB64: string): string {
  const file: RawKeyFile = {
    v: FORMAT_VERSION,
    encrypted: false,
    privateKey: privateKeyB64,
  }
  return JSON.stringify(file, null, 2)
}

/**
 * Encrypt a private key under a passphrase (scrypt-derived key + AES-256-GCM)
 * and serialize it into the self-describing file format.
 */
export async function wrapPrivateKey(
  privateKeyB64: string,
  passphrase: string
): Promise<string> {
  const salt = randomBytes(SALT_LEN)
  const key = scryptSync(passphrase, salt, KEY_LEN)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(privateKeyB64, 'utf8')),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  const file: EncryptedKeyFile = {
    v: FORMAT_VERSION,
    encrypted: true,
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  }
  return JSON.stringify(file, null, 2)
}

/** Whether a key file is passphrase-encrypted (so a passphrase must be asked). */
export function isEncryptedPrivateKey(contents: string): boolean {
  return parseKeyFile(contents).encrypted === true
}

/**
 * Load the base64 private key from a key file. Raw files need no passphrase;
 * encrypted files require the correct passphrase (throws otherwise).
 */
export async function loadPrivateKey(
  contents: string,
  passphrase?: string
): Promise<string> {
  const file = parseKeyFile(contents)
  if (!file.encrypted) {
    return file.privateKey
  }
  if (!passphrase) {
    throw new Error('This private key is encrypted; a passphrase is required')
  }

  const salt = Buffer.from(file.salt, 'base64')
  const key = scryptSync(passphrase, salt, KEY_LEN)
  const iv = Buffer.from(file.iv, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(Buffer.from(file.tag, 'base64'))

  try {
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(file.ciphertext, 'base64')),
      decipher.final(),
    ])
    return plaintext.toString('utf8')
  } catch {
    throw new Error('Incorrect passphrase or corrupted key file')
  }
}
