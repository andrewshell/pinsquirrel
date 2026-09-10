/**
 * Zips `dist/` into `release/` for upload to the Chrome Web Store.
 *
 * Runs after a production build (`pnpm package` chains the two), so what it
 * archives is minified, has no source maps, and carries the release manifest.
 * The store wants `manifest.json` at the root of the zip, so the archive is
 * made from inside `dist/`, not of `dist/` itself.
 */
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ExtensionManifest } from './manifest-assets.ts'
import { releaseArchiveName } from './manifest-release.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const release = join(root, 'release')

const manifest = JSON.parse(
  await readFile(join(dist, 'manifest.json'), 'utf8')
) as ExtensionManifest

const archive = join(release, releaseArchiveName(manifest))

await mkdir(release, { recursive: true })
await rm(archive, { force: true })

// `-X` leaves out the extended attributes macOS would otherwise add, and the
// exclusions keep Finder's droppings out of an archive a reviewer unpacks.
const result = spawnSync(
  'zip',
  ['-r', '-X', archive, '.', '-x', '.DS_Store', '*/.DS_Store'],
  { cwd: dist, stdio: 'inherit' }
)

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

console.log(`Packaged extension into ${archive}`)
