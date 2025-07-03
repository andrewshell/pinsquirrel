import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './auth';

describe('Password Hashing', () => {
  it('should hash a password and return salt:hash format', () => {
    const password = 'testpassword123';
    const hashed = hashPassword(password);

    expect(hashed).toMatch(/^[a-f0-9]{64}:[a-f0-9]{128}$/);
    expect(hashed.split(':').length).toBe(2);
  });

  it('should generate different hashes for the same password', () => {
    const password = 'testpassword123';
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });

  it('should verify correct password', () => {
    const password = 'testpassword123';
    const hashed = hashPassword(password);

    expect(verifyPassword(password, hashed)).toBe(true);
  });

  it('should reject incorrect password', () => {
    const password = 'testpassword123';
    const wrongPassword = 'wrongpassword';
    const hashed = hashPassword(password);

    expect(verifyPassword(wrongPassword, hashed)).toBe(false);
  });

  it('should handle empty passwords', () => {
    const password = '';
    const hashed = hashPassword(password);

    expect(verifyPassword('', hashed)).toBe(true);
    expect(verifyPassword('notempty', hashed)).toBe(false);
  });
});
