import { describe, it, expect } from 'vitest'
import {
  generateKeyPair,
  sealEmail,
  openSealedEmail,
  assertValidPublicKey,
} from './email-crypto.js'

describe('email sealing', () => {
  it('seals an email to a public key and opens it with the keypair', async () => {
    const { publicKey, privateKey } = await generateKeyPair()
    const sealed = await sealEmail('user@example.com', publicKey)

    expect(sealed).not.toContain('user@example.com')
    expect(await openSealedEmail(sealed, privateKey)).toBe('user@example.com')
  })

  it('produces different ciphertext each time (anonymous, randomized)', async () => {
    const { publicKey } = await generateKeyPair()
    const a = await sealEmail('user@example.com', publicKey)
    const b = await sealEmail('user@example.com', publicKey)
    expect(a).not.toBe(b)
  })

  it('cannot be opened with the wrong keypair', async () => {
    const recipient = await generateKeyPair()
    const attacker = await generateKeyPair()
    const sealed = await sealEmail('user@example.com', recipient.publicKey)

    await expect(openSealedEmail(sealed, attacker.privateKey)).rejects.toThrow()
  })
})

describe('assertValidPublicKey', () => {
  it('accepts a generated public key', async () => {
    const { publicKey } = await generateKeyPair()
    expect(() => assertValidPublicKey(publicKey)).not.toThrow()
  })

  it('rejects an empty string', () => {
    expect(() => assertValidPublicKey('')).toThrow()
  })

  it('rejects a key of the wrong length', () => {
    // base64 of "tooshort" -> 8 bytes, not 32
    expect(() => assertValidPublicKey('dG9vc2hvcnQ=')).toThrow()
  })

  it('rejects a private key pasted in place of a public key', async () => {
    const { privateKey } = await generateKeyPair()
    expect(() => assertValidPublicKey(privateKey)).toThrow()
  })
})
