import type { ExtensionManifest } from './manifest-assets.ts'

/**
 * The manifest as it ships to the Chrome Web Store.
 *
 * Every `http://` host permission is dropped: the only one there is the dev
 * server, and Chrome lists each host in the install prompt, so a published
 * build that asked for `localhost` would look wrong to users and draw
 * questions from review. Production is `https://` throughout, so the scheme
 * is the whole rule and adding a self-hosted origin needs no change here.
 */
export function releaseManifest(
  manifest: ExtensionManifest
): ExtensionManifest {
  if (!manifest.host_permissions) return { ...manifest }

  return {
    ...manifest,
    host_permissions: manifest.host_permissions.filter(
      pattern => !pattern.startsWith('http://')
    ),
  }
}

/** The zip the store dashboard is handed, named so two uploads cannot be confused. */
export function releaseArchiveName(manifest: ExtensionManifest): string {
  if (!manifest.version) {
    throw new Error('manifest.json has no version; the store requires one')
  }

  return `pinsquirrel-chrome-extension-${manifest.version}.zip`
}
