import type { FC, PropsWithChildren } from 'hono/jsx'
import { html } from 'hono/html'
import type { SendResult } from '@pinsquirrel/mailgun'
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  inputBaseClasses,
  Label,
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

const Layout: FC<PropsWithChildren<{ title: string }>> = ({
  title,
  children,
}) =>
  html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title} · PinSquirrel Admin</title>
        <!-- Not deferred: the theme class must be on <html> before first
             paint, or the light theme flashes first. -->
        <script src="/static/theme.js"></script>
        <!-- Deferred: it only wires listeners onto markup already parsed. -->
        <script defer src="/static/dropdown.js"></script>
        <link rel="stylesheet" href="/static/styles.css" />
      </head>
      <body class="bg-background text-foreground min-h-screen">
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

export const WaitlistPage: FC<{
  envLabel: string
  username: string
  rows: { id: string; username: string; email: string; joinedAt: string }[]
  notice?: string
  error?: string
}> = ({ envLabel, username, rows, notice, error }) => (
  <Layout title="Waitlist">
    <div class="flex gap-4 items-center justify-between flex-wrap">
      <div>
        <h1 class="text-3xl font-bold">Waitlist · {rows.length}</h1>
        <p class="text-muted-foreground text-sm mt-2">
          {envLabel} — signed in as {username}
        </p>
      </div>
      <form method="post" action="/logout">
        <Button variant="outline" type="submit">
          Sign out
        </Button>
      </form>
    </div>
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
        {rows.length > 0 ? (
          <Button href="/compose">Compose message</Button>
        ) : (
          ''
        )}
      </CardContent>
    </Card>
    <Card class="mt-7">
      <CardHeader>
        <CardTitle>Grant admin</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-muted-foreground text-sm mb-4">
          Adds the Admin role to any existing account, on or off the waitlist.
          Roles are additive and granting twice changes nothing.
        </p>
        <form method="post" action="/grant-admin" class="space-y-2">
          <Label for="admin-username">Username</Label>
          <div class="flex gap-3 items-start">
            <div class="flex-1">
              {/* h-11 only because the field sits inline with the h-11 button */}
              <Input
                id="admin-username"
                name="username"
                class="h-11"
                required
              />
            </div>
            <Button type="submit">Grant admin</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  </Layout>
)

export const ComposePage: FC<{
  envLabel: string
  recipientCount: number
  error?: string
  subject?: string
  body?: string
}> = ({ envLabel, recipientCount, error, subject, body }) => (
  <Layout title="Compose">
    <div class="flex gap-4 items-center justify-between flex-wrap">
      <div>
        <h1 class="text-3xl font-bold">Compose message</h1>
        <p class="text-muted-foreground text-sm mt-2">
          {envLabel} — sends individually to {recipientCount} waitlisted{' '}
          {recipientCount === 1 ? 'person' : 'people'}.
        </p>
      </div>
      <Button variant="outline" href="/waitlist">
        Back
      </Button>
    </div>
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

export const SentPage: FC<{ envLabel: string; results: SendResult[] }> = ({
  envLabel,
  results,
}) => {
  const sent = results.filter(r => r.ok).length
  const failed = results.length - sent
  return (
    <Layout title="Sent">
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
