import { Hono } from 'hono'
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie'
import {
  Role,
  UserStatus,
  InvalidCredentialsError,
  AccessNotGrantedError,
  MissingRoleError,
  ValidationError,
} from '@pinsquirrel/domain'
import { openSealedEmail } from '@pinsquirrel/crypto'
import { loadConfig, getEnvironment, type AdminEnvironment } from './config.js'
import { getRuntime } from './runtime.js'
import { readKeyFile, keyNeedsPassphrase, unlockPrivateKey } from './key.js'
import {
  createSession,
  getSession,
  updateSession,
  destroySession,
  type AdminSession,
} from './session.js'
import { sendBulk } from './mailer.js'
import {
  LoginPage,
  UnlockPage,
  WaitlistPage,
  ComposePage,
  SentPage,
} from './views.js'
import type { Context } from 'hono'

const config = loadConfig()
const COOKIE = 'admin_session'

export const app = new Hono()

// Safely read a text field from a parsed form body (values may be File).
function field(body: Record<string, string | File>, name: string): string {
  const value = body[name]
  return typeof value === 'string' ? value : ''
}

// Friendly message for a transient DB/runtime failure after unlock; the
// underlying error is logged to the local console for the operator.
function dbErrorMessage(env: AdminEnvironment, error: unknown): string {
  console.error(`[admin] database/runtime failure for "${env.name}":`, error)
  return `Couldn't reach the ${env.label} database. Please try again.`
}

async function currentSession(
  c: Context
): Promise<{ id: string; session: AdminSession } | null> {
  const id = await getSignedCookie(c, config.sessionSecret, COOKIE)
  if (!id) return null
  const session = getSession(id)
  return session ? { id, session } : null
}

interface WaitlistRow {
  username: string
  email: string
  joinedAt: string
}

async function loadWaitlist(
  env: AdminEnvironment,
  privateKey: string
): Promise<WaitlistRow[]> {
  const { userRepository } = getRuntime(env)
  const users = await userRepository.findByStatus(UserStatus.Waitlist)
  const rows: WaitlistRow[] = []
  for (const user of users) {
    let email = '(no sealed email)'
    if (user.emailEncrypted) {
      try {
        email = await openSealedEmail(user.emailEncrypted, privateKey)
      } catch {
        email = '(decrypt failed)'
      }
    }
    rows.push({
      username: user.username,
      email,
      joinedAt: user.createdAt.toISOString().slice(0, 10),
    })
  }
  return rows
}

app.get('/', async c => {
  const sess = await currentSession(c)
  if (!sess) return c.redirect('/login')
  return c.redirect(sess.session.privateKey ? '/waitlist' : '/unlock')
})

app.get('/login', async c => {
  if (await currentSession(c)) return c.redirect('/')
  return c.html(<LoginPage environments={config.environments} />)
})

app.post('/login', async c => {
  const body = await c.req.parseBody()
  const environment = field(body, 'environment')
  const username = field(body, 'username')
  const password = field(body, 'password')

  let env: AdminEnvironment
  try {
    env = getEnvironment(config, environment)
  } catch {
    return c.html(
      <LoginPage
        environments={config.environments}
        username={username}
        error="Unknown environment."
      />,
      400
    )
  }

  try {
    const user = await getRuntime(env).authService.login({ username, password })
    if (!user.roles.includes(Role.Admin)) {
      return c.html(
        <LoginPage
          environments={config.environments}
          selected={environment}
          username={username}
          error="This account is not an admin."
        />,
        403
      )
    }
    const id = createSession({
      environment,
      userId: user.id,
      username: user.username,
    })
    await setSignedCookie(c, COOKIE, id, config.sessionSecret, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    })
    return c.redirect('/unlock')
  } catch (error) {
    const message =
      error instanceof ValidationError ||
      error instanceof InvalidCredentialsError
        ? 'Invalid username or password.'
        : error instanceof MissingRoleError ||
            error instanceof AccessNotGrantedError
          ? 'This account cannot sign in.'
          : 'Could not connect to this environment.'
    return c.html(
      <LoginPage
        environments={config.environments}
        selected={environment}
        username={username}
        error={message}
      />,
      400
    )
  }
})

app.get('/unlock', async c => {
  const sess = await currentSession(c)
  if (!sess) return c.redirect('/login')
  if (sess.session.privateKey) return c.redirect('/waitlist')

  const env = getEnvironment(config, sess.session.environment)
  try {
    const contents = readKeyFile(env.privateKeyPath)
    // Only prompt for a passphrase when the key file is actually encrypted.
    if (keyNeedsPassphrase(contents)) {
      return c.html(<UnlockPage envLabel={env.label} />)
    }
    // Raw (unencrypted) key — unlock now; only persist/redirect on success.
    updateSession(sess.id, { privateKey: await unlockPrivateKey(contents) })
    return c.redirect('/waitlist')
  } catch {
    return c.html(
      <UnlockPage
        envLabel={env.label}
        error={`Could not read or unlock the key file at ${env.privateKeyPath}.`}
      />,
      500
    )
  }
})

app.post('/unlock', async c => {
  const sess = await currentSession(c)
  if (!sess) return c.redirect('/login')
  const env = getEnvironment(config, sess.session.environment)
  const body = await c.req.parseBody()
  const passphrase = field(body, 'passphrase')

  try {
    const contents = readKeyFile(env.privateKeyPath)
    const privateKey = await unlockPrivateKey(contents, passphrase)
    updateSession(sess.id, { privateKey })
    return c.redirect('/waitlist')
  } catch {
    return c.html(
      <UnlockPage
        envLabel={env.label}
        error="Incorrect passphrase or unreadable key file."
      />,
      400
    )
  }
})

app.get('/waitlist', async c => {
  const sess = await currentSession(c)
  if (!sess) return c.redirect('/login')
  if (!sess.session.privateKey) return c.redirect('/unlock')

  const env = getEnvironment(config, sess.session.environment)
  try {
    const rows = await loadWaitlist(env, sess.session.privateKey)
    return c.html(
      <WaitlistPage
        envLabel={env.label}
        username={sess.session.username}
        rows={rows}
      />
    )
  } catch (error) {
    return c.html(
      <WaitlistPage
        envLabel={env.label}
        username={sess.session.username}
        rows={[]}
        error={dbErrorMessage(env, error)}
      />,
      500
    )
  }
})

app.get('/compose', async c => {
  const sess = await currentSession(c)
  if (!sess) return c.redirect('/login')
  if (!sess.session.privateKey) return c.redirect('/unlock')

  const env = getEnvironment(config, sess.session.environment)
  try {
    const rows = await loadWaitlist(env, sess.session.privateKey)
    const recipientCount = rows.filter(r => r.email.includes('@')).length
    return c.html(
      <ComposePage envLabel={env.label} recipientCount={recipientCount} />
    )
  } catch (error) {
    return c.html(
      <ComposePage
        envLabel={env.label}
        recipientCount={0}
        error={dbErrorMessage(env, error)}
      />,
      500
    )
  }
})

app.post('/send', async c => {
  const sess = await currentSession(c)
  if (!sess) return c.redirect('/login')
  if (!sess.session.privateKey) return c.redirect('/unlock')

  const env = getEnvironment(config, sess.session.environment)
  const body = await c.req.parseBody()
  const subject = field(body, 'subject').trim()
  const messageBody = field(body, 'body').trim()

  // Validate before any DB work so an empty submission returns 400 without
  // querying the database or decrypting recipients.
  if (!subject || !messageBody) {
    return c.html(
      <ComposePage
        envLabel={env.label}
        recipientCount={0}
        subject={subject}
        body={messageBody}
        error="Subject and message are both required."
      />,
      400
    )
  }

  // Recompute recipients from the live DB so we never trust a client-supplied
  // list and never put plaintext emails on the wire until send time.
  let recipients: string[]
  try {
    const rows = await loadWaitlist(env, sess.session.privateKey)
    recipients = rows.map(r => r.email).filter(e => e.includes('@'))
  } catch (error) {
    return c.html(
      <ComposePage
        envLabel={env.label}
        recipientCount={0}
        subject={subject}
        body={messageBody}
        error={dbErrorMessage(env, error)}
      />,
      500
    )
  }

  // Per-recipient send failures are captured inside sendBulk and shown on
  // SentPage; this guard only covers an unexpected provider/client-setup throw.
  try {
    const results = await sendBulk(
      env.mailgun,
      recipients,
      subject,
      messageBody
    )
    return c.html(<SentPage envLabel={env.label} results={results} />)
  } catch (error) {
    console.error(`[admin] mail provider failure for "${env.name}":`, error)
    return c.html(
      <ComposePage
        envLabel={env.label}
        recipientCount={recipients.length}
        subject={subject}
        body={messageBody}
        error="Couldn't reach the email provider. Please try again."
      />,
      500
    )
  }
})

app.post('/logout', async c => {
  const sess = await currentSession(c)
  if (sess) destroySession(sess.id)
  deleteCookie(c, COOKIE, { path: '/' })
  return c.redirect('/login')
})
