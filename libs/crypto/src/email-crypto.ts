import {
  generateKeyPairSync,
  createPublicKey,
  createPrivateKey,
  diffieHellman,
  hkdfSync,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type KeyObject,
} from 'node:crypto'

export interface KeyPair {
  /** Base64 raw X25519 public key — safe to put in server env. */
  publicKey: string
  /** Base64 PKCS8 X25519 private key — keep off the server. */
  privateKey: string
}

const EPH_PUB_LEN = 32
const IV_LEN = 12
const TAG_LEN = 16
const PUBLIC_KEY_LEN = 32

function rawPublicKey(key: KeyObject): Buffer {
  const jwk = key.export({ format: 'jwk' }) as JsonWebKey
  return Buffer.from(jwk.x as string, 'base64url')
}

function importPublicKey(publicKeyB64: string): KeyObject {
  const raw = Buffer.from(publicKeyB64, 'base64')
  return createPublicKey({
    key: { kty: 'OKP', crv: 'X25519', x: raw.toString('base64url') },
    format: 'jwk',
  })
}

function importPrivateKey(privateKeyB64: string): KeyObject {
  return createPrivateKey({
    key: Buffer.from(privateKeyB64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  })
}

/**
 * Derive a 32-byte AES key from an X25519 shared secret, bound to both the
 * ephemeral and recipient public keys (ECIES-style HKDF info).
 */
function deriveKey(
  shared: Buffer,
  ephPubRaw: Buffer,
  recipientPubRaw: Buffer
): Buffer {
  const info = Buffer.concat([ephPubRaw, recipientPubRaw])
  return Buffer.from(hkdfSync('sha256', shared, Buffer.alloc(0), info, 32))
}

/**
 * Validate that a string is a usable X25519 sealing public key, throwing a
 * descriptive error otherwise. Intended for boot-time config validation so a
 * bad EMAIL_PUBLIC_KEY fails fast instead of 500ing later in seal calls.
 *
 * Note: this confirms structure only (decodable, 32-byte, importable). It
 * cannot detect a well-formed but wrong key, since the server has no private
 * key to round-trip against.
 */
export function assertValidPublicKey(publicKeyB64: string): void {
  const raw = Buffer.from(publicKeyB64, 'base64')
  if (raw.length !== PUBLIC_KEY_LEN) {
    throw new Error(
      `expected a base64-encoded ${PUBLIC_KEY_LEN}-byte X25519 public key, got ${raw.length} bytes`
    )
  }
  try {
    importPublicKey(publicKeyB64)
  } catch {
    throw new Error('not a valid X25519 public key')
  }
}

/** Generate an X25519 keypair for sealing/opening emails. */
export async function generateKeyPair(): Promise<KeyPair> {
  const { publicKey, privateKey } = generateKeyPairSync('x25519')
  return {
    publicKey: rawPublicKey(publicKey).toString('base64'),
    privateKey: Buffer.from(
      privateKey.export({ type: 'pkcs8', format: 'der' })
    ).toString('base64'),
  }
}

/**
 * Anonymously seal an email to a public key (ECIES: ephemeral X25519 -> ECDH ->
 * HKDF-SHA256 -> AES-256-GCM). The public key alone cannot recover the
 * plaintext — only the matching private key can. Output is base64. Randomized:
 * each call uses a fresh ephemeral key, so ciphertext differs every time.
 */
export async function sealEmail(
  email: string,
  publicKeyB64: string
): Promise<string> {
  const recipient = importPublicKey(publicKeyB64)
  const ephemeral = generateKeyPairSync('x25519')
  const shared = diffieHellman({
    privateKey: ephemeral.privateKey,
    publicKey: recipient,
  })
  const ephPubRaw = rawPublicKey(ephemeral.publicKey)
  const recipientPubRaw = Buffer.from(publicKeyB64, 'base64')
  const key = deriveKey(shared, ephPubRaw, recipientPubRaw)

  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(email, 'utf8')),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return Buffer.concat([ephPubRaw, iv, tag, ciphertext]).toString('base64')
}

/** Open an email sealed with {@link sealEmail}. Throws if the key is wrong. */
export async function openSealedEmail(
  sealedB64: string,
  privateKeyB64: string
): Promise<string> {
  const blob = Buffer.from(sealedB64, 'base64')
  const ephPubRaw = blob.subarray(0, EPH_PUB_LEN)
  const iv = blob.subarray(EPH_PUB_LEN, EPH_PUB_LEN + IV_LEN)
  const tag = blob.subarray(
    EPH_PUB_LEN + IV_LEN,
    EPH_PUB_LEN + IV_LEN + TAG_LEN
  )
  const ciphertext = blob.subarray(EPH_PUB_LEN + IV_LEN + TAG_LEN)

  const privateKey = importPrivateKey(privateKeyB64)
  const ephPub = createPublicKey({
    key: { kty: 'OKP', crv: 'X25519', x: ephPubRaw.toString('base64url') },
    format: 'jwk',
  })
  const shared = diffieHellman({ privateKey, publicKey: ephPub })
  const recipientPubRaw = rawPublicKey(createPublicKey(privateKey))
  const key = deriveKey(shared, ephPubRaw, recipientPubRaw)

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
