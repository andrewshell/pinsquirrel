import { describe, it, expect } from 'vitest'
import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  generateKeyPair,
  serializeRawPrivateKey,
  wrapPrivateKey,
} from '@pinsquirrel/crypto'
import { readKeyFile, keyNeedsPassphrase, unlockPrivateKey } from './key.js'

describe('admin key handling', () => {
  it('reads and unlocks a raw key without a passphrase', async () => {
    const { privateKey } = await generateKeyPair()
    const path = join(tmpdir(), `admin-raw-${process.pid}.json`)
    writeFileSync(path, serializeRawPrivateKey(privateKey))
    try {
      const contents = readKeyFile(path)
      expect(keyNeedsPassphrase(contents)).toBe(false)
      expect(await unlockPrivateKey(contents)).toBe(privateKey)
    } finally {
      rmSync(path, { force: true })
    }
  })

  it('detects an encrypted key and unlocks it with the passphrase', async () => {
    const { privateKey } = await generateKeyPair()
    const path = join(tmpdir(), `admin-enc-${process.pid}.json`)
    writeFileSync(path, await wrapPrivateKey(privateKey, 'pw'))
    try {
      const contents = readKeyFile(path)
      expect(keyNeedsPassphrase(contents)).toBe(true)
      expect(await unlockPrivateKey(contents, 'pw')).toBe(privateKey)
    } finally {
      rmSync(path, { force: true })
    }
  })

  it('rejects an encrypted key with a wrong or missing passphrase', async () => {
    const { privateKey } = await generateKeyPair()
    const path = join(tmpdir(), `admin-enc-neg-${process.pid}.json`)
    writeFileSync(path, await wrapPrivateKey(privateKey, 'correct-pass'))
    try {
      const contents = readKeyFile(path)
      expect(keyNeedsPassphrase(contents)).toBe(true)
      await expect(unlockPrivateKey(contents, 'wrong-pass')).rejects.toThrow()
      await expect(unlockPrivateKey(contents)).rejects.toThrow()
    } finally {
      rmSync(path, { force: true })
    }
  })

  it('throws a clear error when the key file is missing', () => {
    expect(() =>
      readKeyFile(join(tmpdir(), 'admin-nope-does-not-exist.json'))
    ).toThrow('Could not read private key')
  })
})
