import type { Child, FC, PropsWithChildren } from 'hono/jsx'
import { html } from 'hono/html'
import type { SendResult } from '@pinsquirrel/mailgun'
import {
  Alert,
  Button,
  Card,
  CardContent,
  dropdownMenuItemClasses,
  Header,
  Input,
  inputBaseClasses,
  Label,
  NavLink,
  ProfileDropdown,
  Textarea,
} from '@pinsquirrel/ui'

/* The console renders with the shared Neo Brutalism primitives and its own
   Tailwind build (`pnpm --filter @pinsquirrel/admin css:build`), so the tokens
   and the components are the same ones the Hono app uses rather than a copy
   that drifts. Dark mode follows the OS: src/static/theme.js mirrors
   `prefers-color-scheme` onto the `.dark` class the tokens hang off, and there
   is no toggle to remember. */

// `<select>` has no shared primitive; Input's own classes keep it a matched
// pair with the inputs stacked under it.
const selectClasses = inputBaseClasses

const tableClasses =
  'w-full border-collapse text-sm [&_tbody_tr:last-child_td]:border-b-0'
const thClasses =
  'text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b-2 border-foreground'
const tdClasses = 'text-left px-3 py-2.5 border-b-2 border-foreground/20'

const okClasses = 'text-green-700 dark:text-green-200 font-bold'
const badClasses = 'text-red-700 dark:text-red-200 font-bold'

/**
 * The console's header, on every page behind the session gate.
 *
 * `currentPath` is the section the page belongs to rather than the request
 * path: /compose and /send are waitlist work, so the Waitlist link stays lit
 * while they are open.
 */
const AdminHeader: FC<{ username: string; currentPath: string }> = ({
  username,
  currentPath,
}) => (
  <Header
    logoSrc="/static/pinsquirrel.svg"
    brand="Admin"
    nav={
      <>
        <NavLink href="/users" currentPath={currentPath}>
          Users
        </NavLink>
        <NavLink href="/waitlist" currentPath={currentPath}>
          Waitlist
        </NavLink>
      </>
    }
    actions={
      <ProfileDropdown username={username}>
        <form method="post" action="/logout">
          <button type="submit" class={dropdownMenuItemClasses}>
            Sign out
          </button>
        </form>
      </ProfileDropdown>
    }
  />
)

// The header spans the viewport, so it sits outside the content column rather
// than inside it. The sign-in pages pass none.
const Layout: FC<PropsWithChildren<{ title: string; header?: Child }>> = ({
  title,
  header,
  children,
}) =>
  html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title} · PinSquirrel Admin</title>
        <link rel="icon" type="image/x-icon" href="/static/favicon.ico" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/static/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/static/favicon-16x16.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/static/apple-touch-icon.png"
        />
        <!-- Not deferred: the theme class must be on <html> before first
             paint, or the light theme flashes first. -->
        <script src="/static/theme.js"></script>
        <!-- Deferred: it only wires listeners onto markup already parsed. -->
        <script defer src="/static/dropdown.js"></script>
        <link rel="stylesheet" href="/static/styles.css" />
      </head>
      <body class="bg-background text-foreground min-h-screen">
        ${header ?? ''}
        <div class="max-w-4xl mx-auto px-5 pt-10 pb-16">${children}</div>
      </body>
    </html>`

export const LoginPage: FC<{
  environments: { name: string; label: string }[]
  error?: string
  selected?: string
  username?: string
}> = ({ environments, error, selected, username }) => (
  <Layout title="Sign in">
    <h1 class="text-3xl font-black uppercase tracking-tight">
      PinSquirrel Admin
    </h1>
    <p class="text-muted-foreground text-sm mt-2">
      Sign in with an admin account for the chosen environment.
    </p>
    <Card class="mt-7">
      <CardContent class="space-y-4">
        {error ? <Alert variant="destructive">{error}</Alert> : ''}
        <form method="post" action="/login" class="space-y-4">
          <div class="space-y-2">
            <Label for="environment">Environment</Label>
            <select id="environment" name="environment" class={selectClasses}>
              {environments.map(e => (
                <option value={e.name} selected={e.name === selected}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div class="space-y-2">
            <Label for="username">Username</Label>
            <Input
              id="username"
              name="username"
              value={username ?? ''}
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Button type="submit">Sign in</Button>
        </form>
      </CardContent>
    </Card>
  </Layout>
)

/**
 * The cold start: an environment nobody administers yet.
 *
 * Carries no header, like the other two pages before the console — the
 * operator is signed in but there is nothing yet to navigate to, and the one
 * account this page can act on is the one it was reached with, so the form is
 * a single button rather than a picker.
 */
export const BootstrapPage: FC<{
  envLabel: string
  username: string
  error?: string
}> = ({ envLabel, username, error }) => (
  <Layout title="Claim admin">
    <h1 class="text-3xl font-black uppercase tracking-tight">
      Claim admin access
    </h1>
    <p class="text-muted-foreground text-sm mt-2">
      No admin accounts exist in {envLabel}.
    </p>
    <Card class="mt-7">
      <CardContent class="space-y-4">
        {error ? <Alert variant="destructive">{error}</Alert> : ''}
        <p class="text-sm">
          Nobody administers this environment yet, so the first signed-in
          account may take the role. Claiming it activates{' '}
          <strong>{username}</strong> and makes it the admin. Everyone after
          this one is granted their roles from the Users page.
        </p>
        <form method="post" action="/bootstrap">
          <Button type="submit">Activate {username} and claim admin</Button>
        </form>
      </CardContent>
    </Card>
  </Layout>
)

export const UnlockPage: FC<{ envLabel: string; error?: string }> = ({
  envLabel,
  error,
}) => (
  <Layout title="Unlock key">
    <h1 class="text-3xl font-bold">Unlock decryption key</h1>
    <p class="text-muted-foreground text-sm mt-2">
      {envLabel} — this key file is encrypted.
    </p>
    <Card class="mt-7">
      <CardContent class="space-y-4">
        {error ? <Alert variant="destructive">{error}</Alert> : ''}
        <form method="post" action="/unlock" class="space-y-4">
          <div class="space-y-2">
            <Label for="passphrase">Passphrase</Label>
            <Input id="passphrase" name="passphrase" type="password" required />
          </div>
          <Button type="submit">Unlock</Button>
        </form>
      </CardContent>
    </Card>
  </Layout>
)

/**
 * One role's column on the Users table.
 *
 * The list comes from the app rather than the domain enum directly, so the
 * page has no opinion about which roles exist or which one is load-bearing —
 * `revokeHint` carries that as copy, and today only the User role has one.
 */
type RoleColumn = { name: string; revokeHint?: string }

/**
 * One role's state for one user, and the single button that changes it.
 *
 * The state and the action share a cell because the state _is_ what the button
 * offers: a role the user holds can only be revoked, one they lack only
 * granted. The exception is the signed-in admin's own row — the service
 * refuses a self-revoke, so the row does not offer the button that earns it.
 */
const RoleCell: FC<{
  userId: string
  role: RoleColumn
  has: boolean
  isSelf: boolean
}> = ({ userId, role, has, isSelf }) => (
  <div class="flex items-center gap-2">
    <span class={has ? okClasses : 'text-muted-foreground'}>
      {has ? 'yes' : 'no'}
    </span>
    {has && isSelf ? (
      ''
    ) : (
      <form method="post" action={has ? '/roles/revoke' : '/roles/grant'}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="role" value={role.name} />
        <Button
          type="submit"
          size="sm"
          variant={has ? 'outline' : 'default'}
          title={has ? role.revokeHint : undefined}
        >
          {has ? 'Revoke' : 'Grant'}
        </Button>
      </form>
    )}
  </div>
)

export const UsersPage: FC<{
  envLabel: string
  username: string
  roles: RoleColumn[]
  rows: { id: string; username: string; roles: string[]; isSelf: boolean }[]
  notice?: string
  error?: string
}> = ({ envLabel, username, roles, rows, notice, error }) => (
  <Layout
    title="Users"
    header={<AdminHeader username={username} currentPath="/users" />}
  >
    <h1 class="text-3xl font-bold">Users · {rows.length}</h1>
    <p class="text-muted-foreground text-sm mt-2">
      {envLabel} — active accounts
    </p>
    <Card class="mt-7">
      <CardContent class="space-y-4">
        {notice ? <Alert variant="success">{notice}</Alert> : ''}
        {error ? <Alert variant="destructive">{error}</Alert> : ''}
        {rows.length === 0 ? (
          error ? (
            ''
          ) : (
            <p class="text-muted-foreground text-sm">No active accounts yet.</p>
          )
        ) : (
          <table class={tableClasses}>
            <thead>
              <tr>
                <th class={thClasses}>Username</th>
                {roles.map(role => (
                  <th class={thClasses}>{role.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr>
                  <td class={tdClasses}>
                    {r.username}
                    {r.isSelf ? (
                      <span class="text-muted-foreground text-xs"> (you)</span>
                    ) : (
                      ''
                    )}
                  </td>
                  {roles.map(role => (
                    <td class={tdClasses}>
                      <RoleCell
                        userId={r.id}
                        role={role}
                        has={r.roles.includes(role.name)}
                        isSelf={r.isSelf}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  </Layout>
)

export const WaitlistPage: FC<{
  envLabel: string
  username: string
  rows: { id: string; username: string; email: string; joinedAt: string }[]
  /**
   * Whether this environment can produce addresses to write to.
   *
   * False where nothing is sealed and there is no key: the message would have
   * nowhere to go, so the page does not offer to write one.
   */
  canCompose: boolean
  notice?: string
  error?: string
}> = ({ envLabel, username, rows, canCompose, notice, error }) => (
  <Layout
    title="Waitlist"
    header={<AdminHeader username={username} currentPath="/waitlist" />}
  >
    <h1 class="text-3xl font-bold">Waitlist · {rows.length}</h1>
    <p class="text-muted-foreground text-sm mt-2">{envLabel}</p>
    <Card class="mt-7">
      <CardContent class="space-y-4">
        {notice ? <Alert variant="success">{notice}</Alert> : ''}
        {error ? <Alert variant="destructive">{error}</Alert> : ''}
        {rows.length === 0 ? (
          error ? (
            ''
          ) : (
            <p class="text-muted-foreground text-sm">
              No one is on the waitlist.
            </p>
          )
        ) : (
          <table class={tableClasses}>
            <thead>
              <tr>
                <th class={thClasses}>Username</th>
                <th class={thClasses}>Email</th>
                <th class={thClasses}>Joined</th>
                <th class={thClasses}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr>
                  <td class={tdClasses}>{r.username}</td>
                  <td class={tdClasses}>{r.email}</td>
                  <td class={`${tdClasses} text-muted-foreground`}>
                    {r.joinedAt}
                  </td>
                  <td class={tdClasses}>
                    {/* Granting flips the user to Active, so the row drops off
                        the next render — the list is queried by Waitlist status. */}
                    <form method="post" action="/grant-access">
                      <input type="hidden" name="userId" value={r.id} />
                      <Button type="submit" size="sm">
                        Grant access
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > 0 && canCompose ? (
          <Button href="/compose">Compose message</Button>
        ) : (
          ''
        )}
      </CardContent>
    </Card>
  </Layout>
)

export const ComposePage: FC<{
  envLabel: string
  username: string
  recipientCount: number
  error?: string
  subject?: string
  body?: string
}> = ({ envLabel, username, recipientCount, error, subject, body }) => (
  <Layout
    title="Compose"
    header={<AdminHeader username={username} currentPath="/waitlist" />}
  >
    <h1 class="text-3xl font-bold">Compose message</h1>
    <p class="text-muted-foreground text-sm mt-2">
      {envLabel} — sends individually to {recipientCount} waitlisted{' '}
      {recipientCount === 1 ? 'person' : 'people'}.
    </p>
    <Card class="mt-7">
      <CardContent class="space-y-4">
        {error ? <Alert variant="destructive">{error}</Alert> : ''}
        <form method="post" action="/send" class="space-y-4">
          <div class="space-y-2">
            <Label for="subject">Subject</Label>
            <Input id="subject" name="subject" value={subject ?? ''} required />
          </div>
          <div class="space-y-2">
            <Label for="body">Message (plain text)</Label>
            <Textarea
              id="body"
              name="body"
              value={body ?? ''}
              rows={10}
              class="min-h-[200px] resize-y"
              required
            />
          </div>
          <Button type="submit">Send to {recipientCount}</Button>
        </form>
      </CardContent>
    </Card>
  </Layout>
)

export const SentPage: FC<{
  envLabel: string
  username: string
  results: SendResult[]
}> = ({ envLabel, username, results }) => {
  const sent = results.filter(r => r.ok).length
  const failed = results.length - sent
  return (
    <Layout
      title="Sent"
      header={<AdminHeader username={username} currentPath="/waitlist" />}
    >
      <h1 class="text-3xl font-bold">Sent</h1>
      <p class="text-muted-foreground text-sm mt-2">
        {envLabel} — <span class={okClasses}>{sent} delivered</span>
        {failed > 0 ? (
          <span class={badClasses}>{`, ${failed} failed`}</span>
        ) : (
          ''
        )}
      </p>
      <Card class="mt-7">
        <CardContent class="space-y-4">
          <table class={tableClasses}>
            <thead>
              <tr>
                <th class={thClasses}>Recipient</th>
                <th class={thClasses}>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr>
                  <td class={tdClasses}>{r.recipient}</td>
                  <td class={`${tdClasses} ${r.ok ? okClasses : badClasses}`}>
                    {r.ok ? 'sent' : (r.error ?? 'failed')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button variant="outline" href="/waitlist">
            Back to waitlist
          </Button>
        </CardContent>
      </Card>
    </Layout>
  )
}
