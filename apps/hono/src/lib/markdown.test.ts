import { describe, it, expect } from 'vitest'

import { prefersMarkdown, htmlToMarkdown } from './markdown'

describe('prefersMarkdown', () => {
  it('returns false when Accept header is missing', () => {
    expect(prefersMarkdown(undefined)).toBe(false)
  })

  it('returns false for */* (default browser-style)', () => {
    expect(prefersMarkdown('*/*')).toBe(false)
  })

  it('returns false for text/html only', () => {
    expect(prefersMarkdown('text/html,application/xhtml+xml')).toBe(false)
  })

  it('returns true for text/markdown only', () => {
    expect(prefersMarkdown('text/markdown')).toBe(true)
  })

  it('returns true when markdown weight is higher than html', () => {
    expect(prefersMarkdown('text/markdown,text/html;q=0.9')).toBe(true)
  })

  it('returns true when markdown ties with html', () => {
    expect(prefersMarkdown('text/markdown;q=0.8,text/html;q=0.8')).toBe(true)
  })

  it('returns false when html weight is higher than markdown', () => {
    expect(prefersMarkdown('text/html;q=0.9,text/markdown;q=0.5')).toBe(false)
  })

  it('returns false for unrelated media types', () => {
    expect(prefersMarkdown('application/json')).toBe(false)
  })

  it('ignores case in media type names', () => {
    expect(prefersMarkdown('TEXT/MARKDOWN')).toBe(true)
  })
})

describe('htmlToMarkdown', () => {
  const fullPage = (mainContent: string, extras = '') => `
    <!doctype html>
    <html>
      <head>
        <title>Test</title>
        <style>body { color: red; }</style>
      </head>
      <body>
        <header><nav><a href="/">PinSquirrel Header Nav</a></nav></header>
        <main>${mainContent}</main>
        <footer><p>PinSquirrel Footer Copyright</p></footer>
        <script>console.log('chrome script')</script>
        ${extras}
      </body>
    </html>
  `

  it('extracts only the <main> content, dropping header/footer/scripts', () => {
    const md = htmlToMarkdown(fullPage('<h1>Hello</h1><p>World</p>'))

    expect(md).toContain('# Hello')
    expect(md).toContain('World')
    expect(md).not.toContain('PinSquirrel Header Nav')
    expect(md).not.toContain('PinSquirrel Footer Copyright')
    expect(md).not.toContain('chrome script')
  })

  it('converts headings, paragraphs, lists, and links', () => {
    const html = fullPage(`
      <h1>Privacy Policy</h1>
      <h2>Section</h2>
      <p>Visit <a href="https://example.com">our site</a>.</p>
      <ul>
        <li>One</li>
        <li>Two</li>
      </ul>
    `)
    const md = htmlToMarkdown(html)

    expect(md).toContain('# Privacy Policy')
    expect(md).toContain('## Section')
    expect(md).toContain('[our site](https://example.com)')
    expect(md).toMatch(/[-*]\s+One/)
    expect(md).toMatch(/[-*]\s+Two/)
  })

  it('strips inline <script>, <style>, and <noscript> inside main', () => {
    const html = fullPage(`
      <h1>Title</h1>
      <script>alert('inline')</script>
      <style>.x { color: red }</style>
      <noscript>Please enable JavaScript</noscript>
      <p>Body text</p>
    `)
    const md = htmlToMarkdown(html)

    expect(md).toContain('# Title')
    expect(md).toContain('Body text')
    expect(md).not.toContain('alert')
    expect(md).not.toContain('color: red')
    expect(md).not.toContain('Please enable JavaScript')
  })

  it('falls back to <body> when <main> is absent', () => {
    const md = htmlToMarkdown(
      '<!doctype html><html><body><h1>No Main</h1><p>Text</p></body></html>'
    )

    expect(md).toContain('# No Main')
    expect(md).toContain('Text')
  })
})
