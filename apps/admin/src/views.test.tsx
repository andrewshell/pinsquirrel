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

/** One waitlisted person, so the compose entry point has something to act on. */
const waitlistProps = {
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
}

const pages = {
  LoginPage: () =>
    LoginPage({ environments: [{ name: 'test', label: 'Test Env' }] }),
  UnlockPage: () => UnlockPage({ envLabel: 'Test Env' }),
  UsersPage: () =>
    UsersPage({
      envLabel: 'Test Env',
      username: 'root',
      roles: [
        { name: 'Admin' },
        { name: 'User', revokeHint: 'Revoking User suspends sign-in.' },
      ],
      rows: [
        { id: 'u1', username: 'alice', roles: ['User'], isSelf: false },
        { id: 'u2', username: 'root', roles: ['Admin'], isSelf: true },
        { id: 'u3', username: 'carol', roles: [], isSelf: false },
      ],
    }),
  WaitlistPage: () => WaitlistPage({ ...waitlistProps, canCompose: true }),
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

  // The console ships the same icon set as the Hono app, so a pinned admin
  // tab looks like a PinSquirrel tab rather than a blank sheet.
  it('links the favicons', async () => {
    const body = await render(
      pages[name]() as HtmlEscapedString | Promise<HtmlEscapedString>
    )

    expect(body).toContain(
      '<link rel="icon" type="image/x-icon" href="/static/favicon.ico"'
    )
    expect(body).toContain('href="/static/favicon-32x32.png"')
    expect(body).toContain('href="/static/favicon-16x16.png"')
    expect(body).toContain('href="/static/apple-touch-icon.png"')
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

describe('WaitlistPage', () => {
  it('offers to write to the list when the console can decrypt it', async () => {
    const html = await render(
      WaitlistPage({ ...waitlistProps, canCompose: true }) as HtmlEscapedString
    )

    expect(html).toContain('href="/compose"')
    expect(html).toContain('Compose message')
  })

  // An environment that seals nothing has no addresses to write to, so the
  // page does not offer a form whose only outcome would be an error.
  it('offers no compose link when it cannot', async () => {
    const html = await render(
      WaitlistPage({ ...waitlistProps, canCompose: false }) as HtmlEscapedString
    )

    expect(html).not.toContain('/compose')
    // The rest of the page is unchanged: the list is still worked from here.
    expect(html).toContain('alice')
    expect(html).toContain('action="/grant-access"')
  })
})

describe('UsersPage', () => {
  async function body(): Promise<string> {
    return render(pages.UsersPage() as HtmlEscapedString)
  }

  /**
   * The markup of one user's row, so a per-row assertion stays per-row.
   *
   * Scoped to the body of the table: the header carries the signed-in admin's
   * username too, in the account menu.
   */
  function rowFor(html: string, username: string): string {
    const row = html
      .split('<tbody>')[1]
      .split('<tr>')
      .find(part => part.includes(username))
    expect(row).toBeDefined()
    return row!
  }

  it('gives every role in the enum a column', async () => {
    const html = await body()

    expect(html).toContain('>Admin</th>')
    expect(html).toContain('>User</th>')
  })

  it('shows whether each user holds each role', async () => {
    const html = await body()

    expect(rowFor(html, 'alice')).toContain('alice')
    expect(rowFor(html, 'carol')).toContain('carol')
  })

  // The change is a per-row post, the same shape the waitlist uses, so the id
  // and the role travel with the button rather than being typed into a field.
  it('offers a grant for a role the user lacks', async () => {
    const row = rowFor(await body(), 'carol')

    expect(row).toContain('action="/roles/grant"')
    expect(row).toContain('value="u3"')
    expect(row).toContain('value="Admin"')
    expect(row).toContain('Grant')
  })

  it('offers a revoke for a role the user holds', async () => {
    const row = rowFor(await body(), 'alice')

    expect(row).toContain('action="/roles/revoke"')
    expect(row).toContain('value="u1"')
    expect(row).toContain('Revoke')
  })

  // Revoking User is a suspension, not a permission tweak — login() requires
  // that role. The button says so rather than leaving it to be discovered.
  it('warns that revoking the User role suspends sign-in', async () => {
    expect(await body()).toContain('Revoking User suspends sign-in.')
  })

  // The service refuses a self-revoke outright; the row does not offer the
  // button that would earn that error.
  it('offers the signed-in admin no revoke on their own row', async () => {
    const row = rowFor(await body(), 'root')

    expect(row).not.toContain('action="/roles/revoke"')
    // A role they lack is still theirs to grant themselves.
    expect(row).toContain('action="/roles/grant"')
  })
})
