import type { Context } from 'hono'

/**
 * Embed mode: the page without its chrome, for the extension's popup window.
 *
 * `?embed=1` on any page renders it through the embed layout - no header, no
 * footer, form width - so the window reads as a dialog rather than as the site
 * in miniature. The flag is presentation only. Nothing about what the page
 * shows or accepts changes with it, and a route that forgets to pass it on
 * fails safe: the user sees the full site in a small window, not the wrong
 * data.
 *
 * It travels three ways, and every hop is deliberate:
 * - on the query string of a GET, which is where it starts and how a redirect
 *   keeps it (`withEmbed`);
 * - on a hidden `embed` field of a form, so a POST that re-renders the page
 *   with errors can render it in the same layout;
 * - inside the `redirectTo` that `requireAuth()` carries through sign-in, so
 *   the user lands back where they started, still in embed.
 */

/**
 * Is this request being rendered inside the extension's popup window?
 *
 * Only the literal `1` turns it on: anything else is the ordinary page, so
 * nothing changes for a user who happens to have an `embed` param on a link.
 */
export function isEmbedRequest(c: Context): boolean {
  return new URL(c.req.url).searchParams.get('embed') === '1'
}

/**
 * `path` with `embed=1` on its query string, when `embed` is on.
 *
 * For redirects and links that have to stay inside the popup. A path that
 * already carries the flag is returned as it is, so passing a URL that came
 * in through `withEmbed` back out through it is harmless.
 */
export function withEmbed(path: string, embed: boolean): string {
  if (!embed) return path
  const [pathname, query = ''] = path.split('?', 2)
  const params = new URLSearchParams(query)
  if (params.get('embed') === '1') return path
  const joined = query ? `${query}&embed=1` : 'embed=1'
  return `${pathname}?${joined}`
}
