import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import {
  staticAssetsToCopy,
  type ExtensionManifest,
} from './manifest-assets.ts'
import { releaseManifest } from './manifest-release.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

const production = process.env.NODE_ENV === 'production'

const manifest = JSON.parse(
  await readFile(join(root, 'manifest.json'), 'utf8')
) as ExtensionManifest

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })

await esbuild.build({
  entryPoints: [join(root, 'src/background.ts'), join(root, 'src/options.ts')],
  outdir: dist,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  // Manifest V3 extensions only run on Chromium, so there is no reason to
  // down-level past what the service worker already supports.
  target: 'chrome120',
  sourcemap: production ? false : 'linked',
  minify: production,
  logLevel: 'info',
})

for (const asset of staticAssetsToCopy(manifest)) {
  const destination = join(dist, asset)
  await mkdir(dirname(destination), { recursive: true })
  await cp(join(root, asset), destination)
}

// The shipped manifest is not the checked-in one: a production build drops
// the dev server's host permission before it reaches the store.
await writeFile(
  join(dist, 'manifest.json'),
  JSON.stringify(production ? releaseManifest(manifest) : manifest, null, 2) +
    '\n'
)

console.log(`Built extension into ${dist}`)
