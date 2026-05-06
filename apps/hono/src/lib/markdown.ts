import { load } from 'cheerio'
import TurndownService from 'turndown'

export function prefersMarkdown(acceptHeader: string | undefined): boolean {
  if (!acceptHeader) return false
  const weights = parseAcceptWeights(acceptHeader.toLowerCase())
  const md = weights.get('text/markdown')
  if (md === undefined) return false
  const html = weights.get('text/html')
  if (html === undefined) return true
  return md >= html
}

function parseAcceptWeights(header: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const part of header.split(',')) {
    const [type, ...params] = part.trim().split(';')
    if (!type) continue
    let q = 1
    for (const p of params) {
      const [k, v] = p.trim().split('=')
      if (k === 'q' && v !== undefined) {
        const parsed = Number(v)
        if (!Number.isNaN(parsed)) q = parsed
      }
    }
    out.set(type.trim(), q)
  }
  return out
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
})

export function htmlToMarkdown(html: string): string {
  const $ = load(html)
  $('script, style, noscript').remove()
  const root = $('main').first()
  const subtree = root.length > 0 ? root : $('body')
  const inner = subtree.html() ?? ''
  return turndown.turndown(inner).trim()
}
