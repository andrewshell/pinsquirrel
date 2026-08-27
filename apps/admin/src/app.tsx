import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie'
import { loginLimiter, loginRateLimitKey } from './rate-limit.js'
import {
  AccessControl,
  Role,
  UserStatus,
  InvalidCredentialsError,
  AccessNotGrantedError,
  MissingRoleError,
  ValidationError,
  UserNotFoundError,
  UserNotEligibleError,
} from '@pinsquirrel/domain'
import { readFileSync } from 'node:fs'
import {
  isEncryptedPrivateKey,
  loadPrivateKey,
  openSealedEmail,
} from '@pinsquirrel/crypto'
import {
  getEnvironment,
  type AdminConfig,
  type AdminEnvironment,
} from './config.js'
import { MailgunEmailService } from '@pinsquirrel/mailgun'
import { getRuntime } from './runtime.js'
import {
  createSession,
  getSession,
  updateSession,
  destroySession,
  type AdminSession,
} from './session.js'
import {
  LoginPage,
  UnlockPage,
  UsersPage,
  WaitlistPage,
  ComposePage,
  SentPage,
} from './views.js'
import type { Context } from 'hono'

const COOKIE = 'admin_session'

/** Shown when a grant target is deleted mid-action. */
const GONE = 'That user no longer exists.'

// Safely read a text field from a parsed form body (values may be File).
function field(body: Record<string, string | File>, name: string): string {
  const value = body[name]
  return typeof value === 'string' ? value : ''
}

// Friendly message for a transient DB/runtime failure after unlock; the
// underlying error is logged to the local console for the operator.
function dbErrorMessage(env: AdminEnvironment, error: unknown): string {
  // listByStatus enforces the Admin role, so a session whose account was
  // demoted mid-flight lands here. Saying "database" would be a lie.
  if (error instanceof MissingRoleError) {
    return 'This account no longer has admin access.'
  }
  console.error(`[admin] database/runtime failure for "${env.name}":`, error)
  return `Couldn't reach the ${env.label} database. Please try again.`
}

interface WaitlistRow {
  id: string
  username: string
  email: string
  joinedAt: string
}

/**
 * Rebuild the AccessControl for the signed-in admin.
 *
 * The session records only the id and username, so the account is re-read per
 * request. That also means losing the Admin role takes effect immediately
 * rather than at the end of the session.
 */
async function adminAccessControl(
  env: AdminEnvironment,
  username: string
): Promise<AccessControl> {
  const user = await getRuntime(env).userService.getUserByUsername(username)
  return new AccessControl(user)
}

async function loadWaitlist(
  env: AdminEnvironment,
  viewer: { username: string; privateKey: string }
): Promise<WaitlistRow[]> {
  const { userService } = getRuntime(env)
  const ac = await adminAccessControl(env, viewer.username)
  const users = await userService.listByStatus(ac, UserStatus.Waitlist)
  const rows: WaitlistRow[] = []
  for (const user of users) {
    let email = '(no sealed email)'
    if (user.emailEncrypted) {
      try {
        email = await openSealedEmail(user.emailEncrypted, viewer.privateKey)
      } catch {
        email = '(decrypt failed)'
      }
    }
    rows.push({
      id: user.id,
      username: user.username,
      email,
      joinedAt: user.createdAt.toISOString().slice(0, 10),
    })
  }
  return rows
}

interface UserRow {
  id: string
  username: string
  roles: string[]
  isAdmin: boolean
}

/** Every active account, with the roles the Users page shows and acts on. */
async function loadUsers(
  env: AdminEnvironment,
  username: string
): Promise<UserRow[]> {
  const { userService } = getRuntime(env)
  const ac = await adminAccessControl(env, username)
  const users = await userService.listByStatus(ac, UserStatus.Active)
  return users.map(user => ({
    id: user.id,
    username: user.username,
    roles: user.roles,
    isAdmin: user.roles.includes(Role.Admin),
  }))
}

/**
 * Re-render the users list with the outcome of an action.
 *
 * The same shape as renderWaitlist, and for the same reason: /grant-admin
 * reports on the page it was invoked from rather than redirecting.
 */
async function renderUsers(
  c: Context,
  env: AdminEnvironment,
  username: string,
  outcome: { notice?: string; error?: string } = {},
  status: 200 | 400 | 404 | 500 = 200
) {
  let rows: UserRow[] = []
  let error = outcome.error
  let code = status
  try {
    rows = await loadUsers(env, username)
  } catch (err) {
    error = error ?? dbErrorMessage(env, err)
    code = 500
  }
  return c.html(
    <UsersPage
      envLabel={env.label}
      username={username}
      rows={rows}
      notice={outcome.notice}
      error={error}
    />,
    code
  )
}

/**
 * Re-render the waitlist with the outcome of an action.
 *
 * The grant routes report their result on the page they were invoked from
 * rather than redirecting, matching how /send renders SentPage. A failure to
 * reload the list is reported alongside the action's own message; the action
 * already happened either way.
 */
async function renderWaitlist(
  c: Context,
  env: AdminEnvironment,
  viewer: { username: string; privateKey: string },
  outcome: { notice?: string; error?: string } = {},
  status: 200 | 400 | 404 | 500 = 200
) {
  let rows: WaitlistRow[] = []
  let error = outcome.error
  let code = status
  try {
    rows = await loadWaitlist(env, viewer)
  } catch (err) {
    error = error ?? dbErrorMessage(env, err)
    code = 500
  }
  return c.html(
    <WaitlistPage
      envLabel={env.label}
      username={viewer.username}
      rows={rows}
      notice={outcome.notice}
      error={error}
    />,
    code
  )
}

/**
 * Build the admin app around one config.
 *
 * Taking the config as an argument rather than reading it at module scope is
 * what lets a test build an app per case — pointing an environment at its own
 * key file, say — instead of resetting the module registry between tests.
 */
export function createApp(config: AdminConfig): Hono {
  const app = new Hono()

  // The compiled stylesheet and the theme script. Mounted before every route
  // that needs a session, so the login page still gets its CSS when the
  // database is unreachable.
  app.use('/static/*', serveStatic({ root: './src' }))

  async function currentSession(
    c: Context
  ): Promise<{ id: string; session: AdminSession } | null> {
    const id = await getSignedCookie(c, config.sessionSecret, COOKIE)
    if (!id) return null
    const session = getSession(id)
    return session ? { id, session } : null
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

    // Checked before the environment lookup and before any database work: a
    // locked-out attempt must cost nothing but the round trip.
    const limitKey = loginRateLimitKey(c, username)
    if (loginLimiter.isLimited(limitKey)) {
      return c.html(
        <LoginPage
          environments={config.environments}
          selected={environment}
          username={username}
          error="Too many failed sign-in attempts. Please try again in 15 minutes."
        />,
        429
      )
    }

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
      const user = await getRuntime(env).authService.login({
        username,
        password,
      })
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
      loginLimiter.reset(limitKey)

      const id = createSession({
        environment,
        userId: user.id,
        username: user.username,
      })
      await setSignedCookie(c, COOKIE, id, config.sessionSecret, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        // Off in local development, where the console is served over plain
        // http and a Secure cookie would never come back.
        secure: process.env.NODE_ENV === 'production',
      })
      return c.redirect('/unlock')
    } catch (error) {
      let message: string
      if (
        error instanceof ValidationError ||
        error instanceof InvalidCredentialsError
      ) {
        // Only a wrong password counts. A validation failure or a demoted
        // account is not a guess, and counting them would let noise lock the
        // console.
        if (error instanceof InvalidCredentialsError) {
          loginLimiter.hit(limitKey)
        }
        message = 'Invalid username or password.'
      } else if (
        error instanceof MissingRoleError ||
        error instanceof AccessNotGrantedError
      ) {
        message = 'This account cannot sign in.'
      } else {
        // The rendered message below is a guess at what went wrong. Whatever
        // actually happened only exists here.
        console.error(`[admin] login failed for "${environment}":`, error)
        message = 'Could not connect to this environment.'
      }
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
      const contents = readFileSync(env.privateKeyPath, 'utf8')
      // Only prompt for a passphrase when the key file is actually encrypted.
      if (isEncryptedPrivateKey(contents)) {
        return c.html(<UnlockPage envLabel={env.label} />)
      }
      // Raw (unencrypted) key — unlock now; only persist/redirect on success.
      updateSession(sess.id, { privateKey: await loadPrivateKey(contents) })
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
      const contents = readFileSync(env.privateKeyPath, 'utf8')
      const privateKey = await loadPrivateKey(contents, passphrase)
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
    return renderWaitlist(c, env, {
      username: sess.session.username,
      privateKey: sess.session.privateKey,
    })
  })

  // The private key is not needed to list accounts, but the unlock gate is the
  // console's, not the page's: a half-open session finishes unlocking first.
  app.get('/users', async c => {
    const sess = await currentSession(c)
    if (!sess) return c.redirect('/login')
    if (!sess.session.privateKey) return c.redirect('/unlock')

    const env = getEnvironment(config, sess.session.environment)
    return renderUsers(c, env, sess.session.username)
  })

  // Admit one person from the waitlist. Replaces the grant-access script, which
  // could only be run from a dev checkout pointed at the target database.
  app.post('/grant-access', async c => {
    const sess = await currentSession(c)
    if (!sess) return c.redirect('/login')
    if (!sess.session.privateKey) return c.redirect('/unlock')

    const env = getEnvironment(config, sess.session.environment)
    const viewer = {
      username: sess.session.username,
      privateKey: sess.session.privateKey,
    }
    const body = await c.req.parseBody()
    const userId = field(body, 'userId')

    if (!userId) {
      return renderWaitlist(
        c,
        env,
        viewer,
        { error: 'No user was selected.' },
        400
      )
    }

    try {
      const ac = await adminAccessControl(env, viewer.username)
      const updated = await getRuntime(env).authService.grantAccess(ac, userId)
      return renderWaitlist(c, env, viewer, {
        notice: `Granted access to ${updated.username}.`,
      })
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return renderWaitlist(c, env, viewer, { error: GONE }, 404)
      }
      // The account has not confirmed its email; activating it would skip the
      // waitlist entirely. The service message names the user.
      if (error instanceof UserNotEligibleError) {
        return renderWaitlist(c, env, viewer, { error: error.message }, 400)
      }
      console.error(`[admin] grant-access failed for "${env.name}":`, error)
      return renderWaitlist(
        c,
        env,
        viewer,
        { error: 'Could not grant access. Please try again.' },
        500
      )
    }
  })

  // Add the Admin role to any account. Replaces the grant-admin script.
  app.post('/grant-admin', async c => {
    const sess = await currentSession(c)
    if (!sess) return c.redirect('/login')
    if (!sess.session.privateKey) return c.redirect('/unlock')

    const env = getEnvironment(config, sess.session.environment)
    const viewer = {
      username: sess.session.username,
      privateKey: sess.session.privateKey,
    }
    const body = await c.req.parseBody()
    const username = field(body, 'username').trim()

    if (!username) {
      return renderWaitlist(
        c,
        env,
        viewer,
        { error: 'Enter a username to grant the Admin role.' },
        400
      )
    }

    try {
      const { userService, authService } = getRuntime(env)
      const ac = await adminAccessControl(env, viewer.username)
      const user = await userService.getUserByUsername(username)

      if (!user) {
        return renderWaitlist(
          c,
          env,
          viewer,
          { error: `No user named ${username}.` },
          404
        )
      }

      // Checked here rather than relying on grantAdmin's idempotence, so the
      // page can tell "nothing to do" apart from "role added".
      if (user.roles.includes(Role.Admin)) {
        return renderWaitlist(c, env, viewer, {
          notice: `${user.username} is already an admin.`,
        })
      }

      const updated = await authService.grantAdmin(ac, user.id)
      return renderWaitlist(c, env, viewer, {
        notice: `Granted the Admin role to ${updated.username}.`,
      })
    } catch (error) {
      // grantAdmin re-reads the user, so a delete between the lookup above and
      // the write surfaces here rather than as a missing-user render.
      if (error instanceof UserNotFoundError) {
        return renderWaitlist(c, env, viewer, { error: GONE }, 404)
      }
      return renderWaitlist(
        c,
        env,
        viewer,
        { error: dbErrorMessage(env, error) },
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
      const rows = await loadWaitlist(env, {
        username: sess.session.username,
        privateKey: sess.session.privateKey,
      })
      const recipientCount = rows.filter(r => r.email.includes('@')).length
      return c.html(
        <ComposePage
          envLabel={env.label}
          username={sess.session.username}
          recipientCount={recipientCount}
        />
      )
    } catch (error) {
      return c.html(
        <ComposePage
          envLabel={env.label}
          username={sess.session.username}
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
          username={sess.session.username}
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
      const rows = await loadWaitlist(env, {
        username: sess.session.username,
        privateKey: sess.session.privateKey,
      })
      recipients = rows.map(r => r.email).filter(e => e.includes('@'))
    } catch (error) {
      return c.html(
        <ComposePage
          envLabel={env.label}
          username={sess.session.username}
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
      const results = await new MailgunEmailService(env.mailgun).sendBulk(
        recipients,
        subject,
        messageBody
      )
      return c.html(
        <SentPage
          envLabel={env.label}
          username={sess.session.username}
          results={results}
        />
      )
    } catch (error) {
      console.error(`[admin] mail provider failure for "${env.name}":`, error)
      return c.html(
        <ComposePage
          envLabel={env.label}
          username={sess.session.username}
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

  return app
}
