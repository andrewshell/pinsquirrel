/* eslint-disable no-console */
import { writeFileSync, existsSync } from 'node:fs'
import { stdin, stdout } from 'node:process'
import { StringDecoder } from 'node:string_decoder'
import { generateKeyPair } from './email-crypto.js'
import { serializeRawPrivateKey, wrapPrivateKey } from './private-key.js'

/**
 * Generate an email-sealing keypair.
 *
 * Usage:
 *   pnpm --filter @pinsquirrel/crypto keygen [outputPath]
 *
 * Writes the (optionally passphrase-encrypted) private key to a file and prints
 * the public key to set as EMAIL_PUBLIC_KEY on the application server. The
 * private key must be kept off that server.
 */

// Control byte codes from raw-mode stdin.
const ENTER_CODES = new Set([10, 13, 4]) // LF, CR, EOT
const CTRL_C = 3
const BACKSPACE_CODES = new Set([127, 8]) // DEL, BS

function promptHidden(question: string): Promise<string> {
  return new Promise(resolve => {
    stdout.write(question)
    let input = ''
    const decoder = new StringDecoder('utf8')

    // Restore the terminal before any exit path so we never leave the
    // operator's shell in raw mode.
    const cleanup = (): void => {
      if (stdin.isTTY) stdin.setRawMode(false)
      stdin.removeListener('data', onData)
      stdin.pause()
    }

    const onData = (data: Buffer): void => {
      // Raw-mode reads can arrive as multi-byte or pasted chunks, so decode and
      // scan the whole chunk rather than inspecting only the first byte.
      for (const char of decoder.write(data)) {
        const code = char.charCodeAt(0)
        if (ENTER_CODES.has(code)) {
          cleanup()
          stdout.write('\n')
          resolve(input)
          return
        }
        if (code === CTRL_C) {
          cleanup()
          stdout.write('\n')
          process.exit(130)
        }
        if (BACKSPACE_CODES.has(code)) {
          input = input.slice(0, -1)
          continue
        }
        input += char
      }
    }

    if (stdin.isTTY) stdin.setRawMode(true)
    stdin.resume()
    stdin.on('data', onData)
  })
}

async function main(): Promise<void> {
  const outputPath = process.argv[2] || 'email-key.json'

  if (existsSync(outputPath)) {
    console.error(`Refusing to overwrite existing key file: ${outputPath}`)
    console.error('Pass a different path or remove the existing file first.')
    process.exit(1)
  }

  const { publicKey, privateKey } = await generateKeyPair()

  const passphrase = await promptHidden(
    'Passphrase to encrypt the private key (leave empty for an unencrypted key): '
  )

  let fileContents: string
  if (passphrase) {
    const confirmation = await promptHidden('Confirm passphrase: ')
    if (confirmation !== passphrase) {
      console.error('Passphrases did not match. Aborting.')
      process.exit(1)
    }
    fileContents = await wrapPrivateKey(privateKey, passphrase)
  } else {
    fileContents = serializeRawPrivateKey(privateKey)
    console.warn('WARNING: writing an UNENCRYPTED private key. Protect it.')
  }

  writeFileSync(outputPath, fileContents, { mode: 0o600 })

  console.log('\nKeypair generated.')
  console.log(
    `Private key written to: ${outputPath} (keep this off the server)`
  )
  console.log('\nSet this on the application server so signups get sealed:\n')
  console.log(`EMAIL_PUBLIC_KEY=${publicKey}`)
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
