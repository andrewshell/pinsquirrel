import { Hono } from 'hono'

const seo = new Hono()

const DISALLOWED_PATHS = [
  '/pins',
  '/tags',
  '/profile',
  '/import',
  '/export',
  '/private',
  '/api/',
  '/health',
  '/mcp',
  '/signout',
  '/reset-password/',
] as const

const PUBLIC_PATHS = ['/', '/privacy', '/terms'] as const

function getOrigin(requestUrl: string): string {
  const url = new URL(requestUrl)
  return `${url.protocol}//${url.host}`
}

seo.get('/robots.txt', (c) => {
  const origin = getOrigin(c.req.url)
  const lines = [
    'User-agent: *',
    'Content-Signal: search=yes, ai-train=yes, ai-input=yes',
    ...DISALLOWED_PATHS.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ]
  return c.text(lines.join('\n'), 200, {
    'Content-Type': 'text/plain; charset=utf-8',
  })
})

seo.get('/sitemap.xml', (c) => {
  const origin = getOrigin(c.req.url)
  const urls = PUBLIC_PATHS.map(
    (p) => `  <url>\n    <loc>${origin}${p}</loc>\n  </url>`
  ).join('\n')
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
  return c.body(body, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
  })
})

export { seo as seoRoutes }
