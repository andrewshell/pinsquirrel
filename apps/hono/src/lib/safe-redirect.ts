/**
 * Resolve a user-supplied `redirectTo` against our own origin and keep it
 * only if it stays there.
 *
 * String prefix checks are not enough: browsers normalise `/\evil.test` to
 * `//evil.test`, and the URL parser strips tabs and newlines, so `/<tab>/evil`
 * is protocol-relative too. Parsing is the only way to see what the browser
 * will see. The resolved path is what gets returned, so any such smuggled
 * characters are gone from the `Location` header as well.
 */
export function safeRedirect(
  redirectTo: string | undefined,
  requestUrl: string,
  fallback: string
): string {
  if (!redirectTo || !redirectTo.startsWith('/')) return fallback

  const origin = new URL(requestUrl).origin

  try {
    const resolved = new URL(redirectTo, origin)
    if (resolved.origin !== origin) return fallback
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return fallback
  }
}
