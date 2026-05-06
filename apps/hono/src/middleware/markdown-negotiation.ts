import type { MiddlewareHandler } from 'hono'

import { htmlToMarkdown, prefersMarkdown } from '../lib/markdown'

export const markdownNegotiation = (): MiddlewareHandler => {
  return async (c, next) => {
    await next()

    if (!prefersMarkdown(c.req.header('Accept'))) return
    if (c.res.status !== 200) return

    const contentType = c.res.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().startsWith('text/html')) return

    const html = await c.res.clone().text()
    const markdown = htmlToMarkdown(html)

    c.res = new Response(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        Vary: 'Accept',
      },
    })
  }
}
