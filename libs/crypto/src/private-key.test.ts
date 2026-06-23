import { describe, it, expect } from 'vitest'
import { generateKeyPair } from './email-crypto.js'
import {
  serializeRawPrivateKey,
  wrapPrivateKey,
  isEncryptedPrivateKey,
  loadPrivateKey,
} from './private-key.js'

describe('private key file', () => {
  it('round-trips a passphrase-wrapped private key', async () => {
    const { privateKey } = await generateKeyPair()
    const file = await wrapPrivateKey(
      privateKey,
      'correct horse battery staple'
    )

    expect(isEncryptedPrivateKey(file)).toBe(true)
    expect(file).not.toContain(privateKey)
    expect(await loadPrivateKey(file, 'correct horse battery staple')).toBe(
      privateKey
    )
  })

  it('fails to load a wrapped key with the wrong passphrase', async () => {
    const { privateKey } = await generateKeyPair()
    const file = await wrapPrivateKey(privateKey, 'right passphrase here')

    await expect(
      loadPrivateKey(file, 'wrong passphrase here')
    ).rejects.toThrow()
  })

  it('requires a passphrase for an encrypted key', async () => {
    const { privateKey } = await generateKeyPair()
    const file = await wrapPrivateKey(privateKey, 'some passphrase here')

    await expect(loadPrivateKey(file)).rejects.toThrow()
  })

  it('loads a raw (unencrypted) key file without a passphrase', async () => {
    const { privateKey } = await generateKeyPair()
    const file = serializeRawPrivateKey(privateKey)

    expect(isEncryptedPrivateKey(file)).toBe(false)
    expect(await loadPrivateKey(file)).toBe(privateKey)
  })
})

describe('invalid key files', () => {
  it('rejects non-JSON', () => {
    expect(() => isEncryptedPrivateKey('not json')).toThrow(
      'Invalid private key file'
    )
  })

  it('rejects a non-object', () => {
    expect(() => isEncryptedPrivateKey('123')).toThrow(
      'Invalid private key file'
    )
  })

  it('rejects an unsupported version', async () => {
    const file = '{"v":2,"encrypted":false,"privateKey":"x"}'
    expect(() => isEncryptedPrivateKey(file)).toThrow(
      'Invalid private key file'
    )
    await expect(loadPrivateKey(file)).rejects.toThrow(
      'Invalid private key file'
    )
  })

  it('rejects a raw file missing the private key', async () => {
    await expect(loadPrivateKey('{"v":1,"encrypted":false}')).rejects.toThrow(
      'Invalid private key file'
    )
  })

  it('rejects an encrypted file missing required fields', async () => {
    await expect(
      loadPrivateKey('{"v":1,"encrypted":true,"kdf":"scrypt"}', 'pw')
    ).rejects.toThrow('Invalid private key file')
  })

  it('rejects an encrypted file with an unsupported kdf', async () => {
    const file =
      '{"v":1,"encrypted":true,"kdf":"argon2id","salt":"x","iv":"y","tag":"z","ciphertext":"c"}'
    await expect(loadPrivateKey(file, 'pw')).rejects.toThrow(
      'Invalid private key file'
    )
  })

  // Build a valid encrypted file and tamper a single field.
  async function tamperedEncryptedFile(
    overrides: Record<string, string>
  ): Promise<string> {
    const { privateKey } = await generateKeyPair()
    const valid = JSON.parse(await wrapPrivateKey(privateKey, 'pw'))
    return JSON.stringify({ ...valid, ...overrides })
  }

  it('rejects an encrypted file with a non-base64 field', async () => {
    const file = await tamperedEncryptedFile({ ciphertext: 'not base64 @@@' })
    await expect(loadPrivateKey(file, 'pw')).rejects.toThrow(
      'Invalid private key file'
    )
  })

  it('rejects an encrypted file with a wrong-length salt', async () => {
    const file = await tamperedEncryptedFile({
      salt: Buffer.from('short').toString('base64'),
    })
    await expect(loadPrivateKey(file, 'pw')).rejects.toThrow(
      'Invalid private key file'
    )
  })

  it('rejects an encrypted file with a wrong-length iv', async () => {
    const file = await tamperedEncryptedFile({
      iv: Buffer.from('short').toString('base64'),
    })
    await expect(loadPrivateKey(file, 'pw')).rejects.toThrow(
      'Invalid private key file'
    )
  })

  it('rejects an encrypted file with a wrong-length tag', async () => {
    const file = await tamperedEncryptedFile({
      tag: Buffer.from('short').toString('base64'),
    })
    await expect(loadPrivateKey(file, 'pw')).rejects.toThrow(
      'Invalid private key file'
    )
  })
})
