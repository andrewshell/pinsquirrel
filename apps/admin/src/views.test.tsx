/**
 * The console renders with @pinsquirrel/ui, not markup of its own.
 *
 * These assertions are what "pixel-consistent with the Hono app" reduces to at
 * this level: every page links the compiled stylesheet, loads the theme script
 * that puts `.dark` on <html>, and composes a shared Button rather than a
 * hand-styled one. A page that quietly grew its own button or dropped the
 * stylesheet would still pass the route tests in app.test.tsx.
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import type { HtmlEscapedString } from 'hono/utils/html'
import {
  LoginPage,
  UnlockPage,
  WaitlistPage,
  ComposePage,
  SentPage,
} from './views.js'

/** Tokens only the shared Button's class list carries, checked independently
 *  so a pure reorder of that list doesn't fail the suite. */
const SHARED_BUTTON_TOKENS = [
  'cursor-pointer',
  'active:neobrutalism-shadow-pressed',
]

async function render(
  node: HtmlEscapedString | Promise<HtmlEscapedString>
): Promise<string> {
  const app = new Hono()
  app.get('/', c => c.html(node))
  return (await app.request('/')).text()
}

const pages = {
  LoginPage: () =>
    LoginPage({ environments: [{ name: 'test', label: 'Test Env' }] }),
  UnlockPage: () => UnlockPage({ envLabel: 'Test Env' }),
  WaitlistPage: () =>
    WaitlistPage({
      envLabel: 'Test Env',
      username: 'root',
      rows: [
        {
          id: 'u1',
          username: 'alice',
          email: 'alice@example.com',
          joinedAt: '2026-01-01',
        },
      ],
    }),
  ComposePage: () => ComposePage({ envLabel: 'Test Env', recipientCount: 1 }),
  SentPage: () =>
    SentPage({
      envLabel: 'Test Env',
      results: [{ recipient: 'alice@example.com', ok: true }],
    }),
} as const

describe.each(Object.keys(pages) as (keyof typeof pages)[])('%s', name => {
  it('links the compiled stylesheet and the theme script', async () => {
    const body = await render(
      pages[name]() as HtmlEscapedString | Promise<HtmlEscapedString>
    )

    expect(body).toContain('<link rel="stylesheet" href="/static/styles.css"')
    expect(body).toContain('<script src="/static/theme.js">')
  })

  // The header's account menu is driven by static/dropdown.js, which is
  // deferred because it only touches the document after it is parsed. Every
  // page shares one Layout, so every page gets it.
  it('defers the dropdown script', async () => {
    const body = await render(
      pages[name]() as HtmlEscapedString | Promise<HtmlEscapedString>
    )

    expect(body).toContain('<script defer src="/static/dropdown.js">')
  })

  it('composes a shared @pinsquirrel/ui button', async () => {
    const body = await render(
      pages[name]() as HtmlEscapedString | Promise<HtmlEscapedString>
    )

    for (const token of SHARED_BUTTON_TOKENS) {
      expect(body).toContain(token)
    }
  })
})
