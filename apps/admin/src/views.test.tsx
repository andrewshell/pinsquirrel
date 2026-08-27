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
  UsersPage,
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
  UsersPage: () =>
    UsersPage({
      envLabel: 'Test Env',
      username: 'root',
      rows: [
        { id: 'u1', username: 'alice', roles: ['user'], isAdmin: false },
        { id: 'u2', username: 'root', roles: ['user', 'admin'], isAdmin: true },
      ],
    }),
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
  ComposePage: () =>
    ComposePage({ envLabel: 'Test Env', username: 'root', recipientCount: 1 }),
  SentPage: () =>
    SentPage({
      envLabel: 'Test Env',
      username: 'root',
      results: [{ recipient: 'alice@example.com', ok: true }],
    }),
} as const

/** The pages behind the session gate all carry the shared header. */
const signedInPages = [
  'UsersPage',
  'WaitlistPage',
  'ComposePage',
  'SentPage',
] as const

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

/**
 * The signed-in pages navigate; the sign-in pages do not.
 *
 * Every page behind the session gate renders one shared Header rather than a
 * heading and a logout button of its own, so switching sections and signing
 * out sit in the same place everywhere.
 */
describe.each(signedInPages)('%s header', name => {
  async function body(): Promise<string> {
    return render(
      pages[name]() as HtmlEscapedString | Promise<HtmlEscapedString>
    )
  }

  it('renders the brand and the logo', async () => {
    const html = await body()

    expect(html).toContain('/static/pinsquirrel.svg')
    expect(html).toContain('>Admin</span>')
  })

  it('links both sections', async () => {
    const html = await body()

    expect(html).toContain('href="/users"')
    expect(html).toContain('href="/waitlist"')
    expect(html).toContain('Users')
    expect(html).toContain('Waitlist')
  })

  it('marks the current section', async () => {
    expect(await body()).toContain('aria-current="page"')
  })

  it('signs out from the account menu', async () => {
    const html = await body()

    // The dropdown contract static/dropdown.js listens for.
    expect(html).toContain('data-dropdown="container"')
    expect(html).toContain('data-dropdown="toggle"')
    expect(html).toContain('data-dropdown="menu"')
    expect(html).toContain('root')
    expect(html).toContain('action="/logout"')
  })
})

describe('UsersPage', () => {
  async function body(): Promise<string> {
    return render(pages.UsersPage() as HtmlEscapedString)
  }

  it('lists each user with their roles', async () => {
    const html = await body()

    expect(html).toContain('alice')
    expect(html).toContain('user')
    expect(html).toContain('admin')
  })

  // The grant is a per-row post, the same shape the waitlist uses, so the id
  // travels with the button rather than being typed into a field.
  it('offers the grant to a user who is not an admin', async () => {
    const html = await body()

    expect(html).toContain('action="/grant-admin"')
    expect(html).toContain('value="u1"')
    expect(html).toContain('Grant admin')
  })

  it('offers no grant to a user who already has the role', async () => {
    expect(await body()).not.toContain('value="u2"')
  })
})
