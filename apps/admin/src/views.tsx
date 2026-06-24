import type { FC, PropsWithChildren } from 'hono/jsx'
import { html, raw } from 'hono/html'
import type { SendResult } from './mailer.js'

const styles = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 2rem 1.25rem; }
  h1 { font-size: 1.35rem; margin: 0 0 0.25rem; }
  .muted { color: #94a3b8; font-size: 0.9rem; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 1.25rem; margin-top: 1rem; }
  label { display: block; font-size: 0.85rem; margin: 0.75rem 0 0.25rem; color: #cbd5e1; }
  input, select, textarea { width: 100%; padding: 0.55rem 0.65rem; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; font: inherit; }
  textarea { min-height: 200px; resize: vertical; }
  button, .btn { display: inline-block; margin-top: 1rem; padding: 0.55rem 1rem; border-radius: 8px; border: 0; background: #6366f1; color: #fff; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; }
  .btn-secondary { background: #334155; }
  .row { display: flex; gap: 1rem; align-items: center; justify-content: space-between; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid #334155; }
  th { color: #94a3b8; font-weight: 600; }
  .error { background: #7f1d1d; color: #fecaca; padding: 0.6rem 0.8rem; border-radius: 8px; margin-top: 0.75rem; font-size: 0.9rem; }
  .ok { color: #86efac; } .bad { color: #fca5a5; }
  code { background: #0f172a; padding: 0.1rem 0.35rem; border-radius: 4px; }
`

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
        <style>
          ${raw(styles)}
        </style>
      </head>
      <body>
        <div class="wrap">${children}</div>
      </body>
    </html>`

export const LoginPage: FC<{
  environments: { name: string; label: string }[]
  error?: string
  selected?: string
  username?: string
}> = ({ environments, error, selected, username }) => (
  <Layout title="Sign in">
    <h1>PinSquirrel Admin</h1>
    <p class="muted">
      Sign in with an admin account for the chosen environment.
    </p>
    <div class="card">
      {error ? <div class="error">{error}</div> : ''}
      <form method="post" action="/login">
        <label for="environment">Environment</label>
        <select id="environment" name="environment">
          {environments.map(e => (
            <option value={e.name} selected={e.name === selected}>
              {e.label}
            </option>
          ))}
        </select>
        <label for="username">Username</label>
        <input id="username" name="username" value={username ?? ''} required />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required />
        <button type="submit">Sign in</button>
      </form>
    </div>
  </Layout>
)

export const UnlockPage: FC<{ envLabel: string; error?: string }> = ({
  envLabel,
  error,
}) => (
  <Layout title="Unlock key">
    <h1>Unlock decryption key</h1>
    <p class="muted">{envLabel} — this key file is encrypted.</p>
    <div class="card">
      {error ? <div class="error">{error}</div> : ''}
      <form method="post" action="/unlock">
        <label for="passphrase">Passphrase</label>
        <input id="passphrase" name="passphrase" type="password" required />
        <button type="submit">Unlock</button>
      </form>
    </div>
  </Layout>
)

export const WaitlistPage: FC<{
  envLabel: string
  username: string
  rows: { username: string; email: string; joinedAt: string }[]
  error?: string
}> = ({ envLabel, username, rows, error }) => (
  <Layout title="Waitlist">
    <div class="row">
      <div>
        <h1>Waitlist · {rows.length}</h1>
        <p class="muted">
          {envLabel} — signed in as {username}
        </p>
      </div>
      <form method="post" action="/logout">
        <button class="btn-secondary" type="submit">
          Sign out
        </button>
      </form>
    </div>
    <div class="card">
      {error ? <div class="error">{error}</div> : ''}
      {rows.length === 0 ? (
        error ? (
          ''
        ) : (
          <p class="muted">No one is on the waitlist.</p>
        )
      ) : (
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr>
                <td>{r.username}</td>
                <td>{r.email}</td>
                <td class="muted">{r.joinedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length > 0 ? (
        <a class="btn" href="/compose">
          Compose message
        </a>
      ) : (
        ''
      )}
    </div>
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
    <div class="row">
      <div>
        <h1>Compose message</h1>
        <p class="muted">
          {envLabel} — sends individually to {recipientCount} waitlisted{' '}
          {recipientCount === 1 ? 'person' : 'people'}.
        </p>
      </div>
      <a class="btn btn-secondary" href="/waitlist">
        Back
      </a>
    </div>
    <div class="card">
      {error ? <div class="error">{error}</div> : ''}
      <form method="post" action="/send">
        <label for="subject">Subject</label>
        <input id="subject" name="subject" value={subject ?? ''} required />
        <label for="body">Message (plain text)</label>
        <textarea id="body" name="body" required>
          {body ?? ''}
        </textarea>
        <button type="submit">Send to {recipientCount}</button>
      </form>
    </div>
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
      <h1>Sent</h1>
      <p class="muted">
        {envLabel} — <span class="ok">{sent} delivered</span>
        {failed > 0 ? <span class="bad">{`, ${failed} failed`}</span> : ''}
      </p>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => (
              <tr>
                <td>{r.recipient}</td>
                <td class={r.ok ? 'ok' : 'bad'}>
                  {r.ok ? 'sent' : (r.error ?? 'failed')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <a class="btn btn-secondary" href="/waitlist">
          Back to waitlist
        </a>
      </div>
    </Layout>
  )
}
