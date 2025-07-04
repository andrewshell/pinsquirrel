import { randomBytes, pbkdf2Sync, createHash } from 'crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(
  password: string,
  hashedPassword: string
): boolean {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString(
    'hex'
  );
  return hash === verifyHash;
}

export function hashEmail(email: string): string {
  // Use SHA-256 for email hashing (deterministic, one-way)
  // Normalize email to lowercase to ensure consistent hashing
  const normalizedEmail = email.toLowerCase().trim();
  return createHash('sha256').update(normalizedEmail).digest('hex');
}
