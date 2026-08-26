/** The parts of a Manifest V3 document the build script cares about. */
export type ExtensionManifest = {
  action?: {
    default_popup?: string
    default_icon?: Record<string, string>
  }
  icons?: Record<string, string>
  background?: {
    service_worker?: string
    type?: string
  }
}

/**
 * The files the build has to copy into `dist/` verbatim, derived from the
 * manifest rather than from a hand-kept list — a manifest that names an icon
 * the build does not ship is a broken extension, and this is what makes the
 * build notice.
 *
 * The service worker is deliberately absent: esbuild emits it.
 */
export function staticAssetsToCopy(manifest: ExtensionManifest): string[] {
  const paths = [
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
    ...(manifest.action?.default_popup ? [manifest.action.default_popup] : []),
  ]

  return [...new Set(paths)].sort()
}
