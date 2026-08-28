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
  BootstrapPage,
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
  BootstrapPage: () =>
    BootstrapPage({ envLabel: 'Test Env', username: 'alice' }),
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

  // The header's account menu is driven by static/dropdown.js and the Users
  // table by static/users.js, both deferred because they only touch the
  // document after it is parsed. Every page shares one Layout, so every page
  // gets both.
  it('defers the behaviour scripts', async () => {
    const body = await render(
      pages[name]() as HtmlEscapedString | Promise<HtmlEscapedString>
    )

    expect(body).toContain('<script defer src="/static/dropdown.js">')
    expect(body).toContain('<script defer src="/static/users.js">')
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

describe('BootstrapPage', () => {
  async function body(): Promise<string> {
    return render(pages.BootstrapPage() as HtmlEscapedString)
  }

  it('names the environment that has no admin', async () => {
    expect(await body()).toContain('No admin accounts exist in Test Env')
  })

  // The claim does both — a fresh database leaves the operator on the waitlist
  // — and a button that only said "claim admin" would hide half of what it
  // changes about their account.
  it('says the claim activates the account as well', async () => {
    const html = await body()

    expect(html).toContain('activates')
    expect(html).toContain('alice')
    expect(html).toContain('action="/bootstrap"')
  })

  // The operator is signed in but not in the console yet, so there is nothing
  // to navigate to — the same reason Login and Unlock carry no header.
  it('carries no console header', async () => {
    const html = await body()

    expect(html).not.toContain('data-dropdown="container"')
    expect(html).not.toContain('href="/users"')
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
   * The markup of one `<tr>`, found by an attribute on the row itself.
   *
   * Each user renders as a pair of rows — the display row users.js listens on
   * and the hidden edit row it swaps in — so a per-row assertion is scoped by
   * the data attribute that names which of the pair it is about.
   */
  function rowByAttr(html: string, attr: string): string {
    const row = html.split(/<tr[ >]/).find(part => part.includes(attr))
    expect(row, `no <tr> carries ${attr}`).toBeDefined()
    return row!
  }

  /** The `<select>` for one role inside an edit row. */
  function selectFor(row: string, role: string): string {
    const select = row
      .split('<select')
      .find(part => part.includes(`name="role-${role}"`))
    expect(select, `no select is named role-${role}`).toBeDefined()
    return select!
  }

  it('gives every role in the enum a column', async () => {
    const html = await body()

    expect(html).toContain('>Admin</th>')
    expect(html).toContain('>User</th>')
  })

  it('shows whether each user holds each role', async () => {
    const row = rowByAttr(await body(), 'data-user-row="u1"')

    expect(row).toContain('alice')
    expect(row).toContain('yes')
    expect(row).toContain('no')
  })

  // The row itself is the edit affordance — users.js swaps it for the edit row
  // on click — so the pair is linked by the same id on both data attributes.
  it('pairs every editable row with a hidden edit row', async () => {
    const html = await body()

    for (const id of ['u1', 'u3']) {
      expect(html).toContain(`data-user-row="${id}"`)
      const edit = rowByAttr(html, `data-user-edit="${id}"`)
      expect(edit).toContain('hidden')
    }
  })

  it('renders each role as a dropdown preset to what the user holds', async () => {
    const edit = rowByAttr(await body(), 'data-user-edit="u1"')

    // alice holds User but not Admin, so only the User select opens on yes.
    expect(selectFor(edit, 'User')).toMatch(/value="yes"[^>]*selected/)
    expect(selectFor(edit, 'Admin')).toMatch(/value="no"[^>]*selected/)
    expect(selectFor(edit, 'Admin')).not.toMatch(/value="yes"[^>]*selected/)
  })

  // One save posts the whole row: the selects join the actions cell's form by
  // its id, because a <form> element cannot span table cells.
  it('saves the row as one post to /users/update', async () => {
    const edit = rowByAttr(await body(), 'data-user-edit="u1"')

    expect(edit).toContain('action="/users/update"')
    expect(edit).toContain('id="edit-u1"')
    expect(edit).toContain('value="u1"')
    expect(selectFor(edit, 'Admin')).toContain('form="edit-u1"')
    expect(selectFor(edit, 'User')).toContain('form="edit-u1"')
  })

  // Cancel is client-side only — users.js resets the selects and swaps the
  // display row back — so it must never submit the form it sits in.
  it('offers a cancel that never posts', async () => {
    const edit = rowByAttr(await body(), 'data-user-edit="u1"')

    expect(edit).toContain('data-edit-cancel')
    expect(edit).toMatch(
      /type="button"[^>]*data-edit-cancel|data-edit-cancel[^>]*type="button"/
    )
  })

  it('offers a delete on the display row, with a confirm', async () => {
    const row = rowByAttr(await body(), 'data-user-row="u1"')

    expect(row).toContain('action="/users/delete"')
    expect(row).toContain('value="u1"')
    expect(row).toContain('data-confirm')
  })

  // Revoking User is a suspension, not a permission tweak — login() requires
  // that role. The select says so rather than leaving it to be discovered.
  it('warns that revoking the User role suspends sign-in', async () => {
    expect(await body()).toContain('Revoking User suspends sign-in.')
  })

  // The service refuses a self-revoke and a self-delete outright; the row
  // offers neither the edit that would earn one nor the delete.
  it('leaves the signed-in admin their own row inert', async () => {
    const html = await body()

    expect(html).not.toContain('data-user-row="u2"')
    expect(html).not.toContain('data-user-edit="u2"')
    expect(html).not.toContain('value="u2"')
    expect(html).toContain('(you)')
  })
})
