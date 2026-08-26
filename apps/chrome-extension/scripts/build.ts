import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import {
  staticAssetsToCopy,
  type ExtensionManifest,
} from './manifest-assets.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

const manifest = JSON.parse(
  await readFile(join(root, 'manifest.json'), 'utf8')
) as ExtensionManifest

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })

await esbuild.build({
  entryPoints: [join(root, 'src/background.ts'), join(root, 'src/popup.ts')],
  outdir: dist,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  // Manifest V3 extensions only run on Chromium, so there is no reason to
  // down-level past what the service worker already supports.
  target: 'chrome120',
  sourcemap: process.env.NODE_ENV === 'production' ? false : 'linked',
  minify: process.env.NODE_ENV === 'production',
  logLevel: 'info',
})

for (const asset of ['manifest.json', ...staticAssetsToCopy(manifest)]) {
  const destination = join(dist, asset)
  await mkdir(dirname(destination), { recursive: true })
  await cp(join(root, asset), destination)
}

console.log(`Built extension into ${dist}`)
