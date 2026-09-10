import { describe, it, expect } from 'vitest'
import { releaseArchiveName, releaseManifest } from './manifest-release.ts'

describe('releaseManifest', () => {
  it('drops plaintext host permissions, which only ever name a dev server', () => {
    const manifest = releaseManifest({
      host_permissions: [
        'https://pinsquirrel.com/*',
        'http://localhost:8100/*',
      ],
    })

    expect(manifest.host_permissions).toEqual(['https://pinsquirrel.com/*'])
  })

  it('leaves the rest of the manifest as it was', () => {
    const manifest = releaseManifest({
      version: '3.6.0',
      options_page: 'options.html',
      host_permissions: [
        'http://localhost:8100/*',
        'https://pinsquirrel.com/*',
      ],
    })

    expect(manifest).toEqual({
      version: '3.6.0',
      options_page: 'options.html',
      host_permissions: ['https://pinsquirrel.com/*'],
    })
  })

  it('does not touch the manifest it was given', () => {
    const input = {
      host_permissions: [
        'http://localhost:8100/*',
        'https://pinsquirrel.com/*',
      ],
    }

    releaseManifest(input)

    expect(input.host_permissions).toEqual([
      'http://localhost:8100/*',
      'https://pinsquirrel.com/*',
    ])
  })

  it('copes with a manifest that has no host permissions at all', () => {
    expect(releaseManifest({ version: '1.0.0' })).toEqual({ version: '1.0.0' })
  })
})

describe('releaseArchiveName', () => {
  it('names the zip after the extension and its version', () => {
    expect(releaseArchiveName({ version: '3.6.0' })).toBe(
      'pinsquirrel-chrome-extension-3.6.0.zip'
    )
  })

  it('refuses a manifest without a version, since the store needs one', () => {
    expect(() => releaseArchiveName({})).toThrow(/version/)
  })
})
