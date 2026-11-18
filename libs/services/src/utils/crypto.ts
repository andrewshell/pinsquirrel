import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
  type ScryptOptions,
} from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>

const SALT_LENGTH = 32
const KEY_LENGTH = 64

interface ScryptParams {
  N: number
  r: number
  p: number
}

const CURRENT_PARAMS: ScryptParams = { N: 2 ** 17, r: 8, p: 1 }
// What every `salt:key` hash written before the parameters were recorded used:
// node's scrypt defaults.
const LEGACY_PARAMS: ScryptParams = { N: 2 ** 14, r: 8, p: 1 }

interface ParsedHash {
  params: ScryptParams
  salt: Buffer
  key: Buffer
}

function deriveKey(
  password: string,
  salt: Buffer,
  { N, r, p }: ScryptParams
): Promise<Buffer> {
  // scrypt needs 128 * N * r bytes; node refuses anything over 32 MiB unless
  // told otherwise.
  return scryptAsync(password, salt, KEY_LENGTH, {
    N,
    r,
    p,
    maxmem: 256 * N * r,
  })
}

function formatHash(
  { N, r, p }: ScryptParams,
  salt: Buffer,
  key: Buffer
): string {
  return [
    'scrypt',
    N,
    r,
    p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$')
}

// Stored as `scrypt$N$r$p$salt$key`, or the legacy `salt:key`.
function parseHash(hash: string): ParsedHash | null {
  const parts = hash.split('$')
  if (parts[0] === 'scrypt' && parts.length === 6) {
    const [, N, r, p, salt, key] = parts
    const params = { N: Number(N), r: Number(r), p: Number(p) }
    const valid = Object.values(params).every(
      n => Number.isSafeInteger(n) && n > 0
    )
    if (!valid) return null
    return {
      params,
      salt: Buffer.from(salt, 'base64'),
      key: Buffer.from(key, 'base64'),
    }
  }

  const [salt, key] = hash.split(':')
  if (!salt || !key) return null
  return {
    params: LEGACY_PARAMS,
    salt: Buffer.from(salt, 'base64'),
    key: Buffer.from(key, 'base64'),
  }
}

const DUMMY_HASH = formatHash(
  CURRENT_PARAMS,
  randomBytes(SALT_LENGTH),
  randomBytes(KEY_LENGTH)
)

export function getDummyHash(): string {
  return DUMMY_HASH
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const key = await deriveKey(password, salt, CURRENT_PARAMS)
  return formatHash(CURRENT_PARAMS, salt, key)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    const parsed = parseHash(hash)
    if (!parsed) return false

    const key = await deriveKey(password, parsed.salt, parsed.params)
    return timingSafeEqual(parsed.key, key)
  } catch {
    return false
  }
}

/** True when a hash was made with weaker parameters than hashPassword uses now. */
export function needsRehash(hash: string): boolean {
  const parsed = parseHash(hash)
  if (!parsed) return false
  const { N, r, p } = parsed.params
  return N < CURRENT_PARAMS.N || r < CURRENT_PARAMS.r || p < CURRENT_PARAMS.p
}

export function hashEmail(email: string): string {
  // Normalize email to lowercase for consistent hashing
  const normalizedEmail = email.toLowerCase()
  const hash = createHash('sha256')
  hash.update(normalizedEmail)
  return hash.digest('hex')
}

export function generateSecureToken(): string {
  // Generate 32 bytes of random data and convert to URL-safe base64
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  // Hash the token for secure storage in database
  const hash = createHash('sha256')
  hash.update(token)
  return hash.digest('hex')
}

export function md5(input: string): string {
  return createHash('md5').update(input).digest('hex')
}
