import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

const SALT_LENGTH = 32
const KEY_LENGTH = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer

  // Format: salt:derivedKey (both base64 encoded)
  return `${salt.toString('base64')}:${derivedKey.toString('base64')}`
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    const [saltBase64, keyBase64] = hash.split(':')
    if (!saltBase64 || !keyBase64) {
      return false
    }

    const salt = Buffer.from(saltBase64, 'base64')
    const storedKey = Buffer.from(keyBase64, 'base64')

    const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer

    return timingSafeEqual(storedKey, derivedKey)
  } catch {
    return false
  }
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
