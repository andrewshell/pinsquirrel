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
  CannotRevokeOwnRoleError,
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

/**
 * Shown when the compose flow is reached on an environment with no key.
 *
 * Mail goes to addresses this console decrypts, so an environment that seals
 * nothing has none to send to. The waitlist hides the entry point; this covers
 * a bookmark or a stale page reaching the routes anyway.
 */
const NO_KEY_TO_SEND =
  'This environment has no decryption key, so waitlist email cannot be sent from here.'

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

/**
 * Who is looking, and with which key.
 *
 * `privateKey` is absent on an environment that seals nothing: there is no key
 * file to unlock, so no session there can ever hold one.
 */
interface Viewer {
  username: string
  privateKey?: string
}

/**
 * What the session gate hands a route: somewhere to work, or somewhere to go.
 *
 * A route that gets a `redirect` returns it untouched — the gate has already
 * decided the session cannot do this here.
 */
type Gate = { env: AdminEnvironment; viewer: Viewer } | { redirect: Response }

async function loadWaitlist(
  env: AdminEnvironment,
  viewer: Viewer
): Promise<WaitlistRow[]> {
  const { userService } = getRuntime(env)
  const ac = await adminAccessControl(env, viewer.username)
  const users = await userService.listByStatus(ac, UserStatus.Waitlist)
  const rows: WaitlistRow[] = []
  for (const user of users) {
    let email = '(no sealed email)'
    if (user.emailEncrypted) {
      // Sealed, but this console holds no key for the environment: the address
      // exists and cannot be read here, which is not the same as never having
      // been collected.
      if (!viewer.privateKey) {
        email = '(locked)'
      } else {
        try {
          email = await openSealedEmail(user.emailEncrypted, viewer.privateKey)
        } catch {
          email = '(decrypt failed)'
        }
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
  isSelf: boolean
}

/**
 * The Users table's columns: every role the domain defines, in enum order.
 *
 * Built from `Role` rather than listed here, so a role added to the domain
 * gets a column and a pair of buttons without this app being edited.
 * `revokeHint` is what the page cannot work out for itself — losing the User
 * role is what stops `login()` from letting the account back in.
 */
const ROLE_COLUMNS = Object.values(Role).map(name => ({
  name,
  revokeHint:
    name === Role.User
      ? 'Revoking the User role suspends this account: it can no longer sign in.'
      : undefined,
}))

/** The submitted role, or null if it is not one the domain defines. */
function parseRole(value: string): Role | null {
  return (Object.values(Role) as string[]).includes(value)
    ? (value as Role)
    : null
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
    // Marked by id rather than username so a rename mid-session cannot make
    // the console offer an admin the self-revoke the service would refuse.
    isSelf: user.id === ac.user?.id,
  }))
}

/**
 * Re-render the users list with the outcome of an action.
 *
 * The same shape as renderWaitlist, and for the same reason: the role routes
 * report on the page they were invoked from rather than redirecting.
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
      roles={ROLE_COLUMNS}
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
  viewer: Viewer,
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
      canCompose={Boolean(env.privateKeyPath)}
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

  /**
   * Where a session belongs right now: the console, or the step before it.
   *
   * The unlock gate is console-wide rather than per page — a half-open session
   * finishes unlocking wherever it was pointed — so it is decided here once.
   * An environment with no key path seals nothing, and a gate with nothing
   * behind it would only lock the operator out.
   */
  function landing(env: AdminEnvironment, session: AdminSession): string {
    return env.privateKeyPath && !session.privateKey ? '/unlock' : '/waitlist'
  }

  /**
   * The session gate every signed-in route runs first.
   *
   * Returns the redirect to send instead when the caller may not proceed, so a
   * route is `const gate = await requireSession(c); if ('redirect' in gate)…`
   * rather than its own copy of the two checks.
   */
  async function requireSession(c: Context): Promise<Gate> {
    const sess = await currentSession(c)
    if (!sess) return { redirect: c.redirect('/login') }
    const env = getEnvironment(config, sess.session.environment)
    if (landing(env, sess.session) === '/unlock') {
      return { redirect: c.redirect('/unlock') }
    }
    return {
      env,
      viewer: {
        username: sess.session.username,
        privateKey: sess.session.privateKey,
      },
    }
  }

  app.get('/', async c => {
    const sess = await currentSession(c)
    if (!sess) return c.redirect('/login')
    const env = getEnvironment(config, sess.session.environment)
    return c.redirect(landing(env, sess.session))
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
      return c.redirect(env.privateKeyPath ? '/unlock' : '/waitlist')
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

    const env = getEnvironment(config, sess.session.environment)
    // Nothing to unlock: either this session already did, or this environment
    // has no key at all.
    const keyPath = env.privateKeyPath
    if (!keyPath || sess.session.privateKey) return c.redirect('/waitlist')

    try {
      const contents = readFileSync(keyPath, 'utf8')
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
          error={`Could not read or unlock the key file at ${keyPath}.`}
        />,
        500
      )
    }
  })

  app.post('/unlock', async c => {
    const sess = await currentSession(c)
    if (!sess) return c.redirect('/login')
    const env = getEnvironment(config, sess.session.environment)
    const keyPath = env.privateKeyPath
    if (!keyPath) return c.redirect('/waitlist')

    const body = await c.req.parseBody()
    const passphrase = field(body, 'passphrase')

    try {
      const contents = readFileSync(keyPath, 'utf8')
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
    const gate = await requireSession(c)
    if ('redirect' in gate) return gate.redirect

    return renderWaitlist(c, gate.env, gate.viewer)
  })

  app.get('/users', async c => {
    const gate = await requireSession(c)
    if ('redirect' in gate) return gate.redirect

    return renderUsers(c, gate.env, gate.viewer.username)
  })

  // Admit one person from the waitlist. Replaces the grant-access script, which
  // could only be run from a dev checkout pointed at the target database.
  app.post('/grant-access', async c => {
    const gate = await requireSession(c)
    if ('redirect' in gate) return gate.redirect

    const { env, viewer } = gate
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

  /**
   * Grant or revoke one role on one account, from its row on the Users page.
   *
   * One handler for both directions: the two differ only in which service
   * method they call and what the notice says, and splitting them duplicated
   * the session gate, the validation and the four error cases.
   */
  async function changeRole(c: Context, action: 'grant' | 'revoke') {
    const gate = await requireSession(c)
    if ('redirect' in gate) return gate.redirect

    const { env } = gate
    const username = gate.viewer.username
    const body = await c.req.parseBody()
    const userId = field(body, 'userId')
    const role = parseRole(field(body, 'role'))

    if (!userId) {
      return renderUsers(
        c,
        env,
        username,
        { error: 'No user was selected.' },
        400
      )
    }

    // The role is a form field, so it is whatever the client sent. Checked
    // against the enum before the service sees it, rather than after.
    if (!role) {
      return renderUsers(
        c,
        env,
        username,
        { error: 'That is not a role.' },
        400
      )
    }

    try {
      const ac = await adminAccessControl(env, username)

      // Read the row before writing: both operations are idempotent and their
      // result cannot say whether anything changed, so "nothing to do" is only
      // distinguishable beforehand. A user missing from this list is left to
      // the service — it, not the listing, decides existence.
      const target = (await loadUsers(env, username)).find(r => r.id === userId)
      if (target && target.roles.includes(role) === (action === 'grant')) {
        return renderUsers(c, env, username, {
          notice:
            action === 'grant'
              ? `${target.username} already has the ${role} role.`
              : `${target.username} does not have the ${role} role.`,
        })
      }

      const { authService } = getRuntime(env)
      if (action === 'grant') {
        const updated = await authService.grantRole(ac, userId, role)
        return renderUsers(c, env, username, {
          notice: `Granted the ${role} role to ${updated.username}.`,
        })
      }

      const updated = await authService.revokeRole(ac, userId, role)
      // Losing Role.User is a suspension rather than a permission tweak —
      // login() requires it — and the table has no other place to say so.
      const suspended = role === Role.User ? ` They can no longer sign in.` : ''
      return renderUsers(c, env, username, {
        notice: `Revoked the ${role} role from ${updated.username}.${suspended}`,
      })
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return renderUsers(c, env, username, { error: GONE }, 404)
      }
      // An admin cannot revoke their own roles. The page hides the button, so
      // this is a stale render or a hand-made post; the service's message
      // already says which role and why.
      if (error instanceof CannotRevokeOwnRoleError) {
        return renderUsers(c, env, username, { error: error.message }, 400)
      }
      return renderUsers(
        c,
        env,
        username,
        { error: dbErrorMessage(env, error) },
        500
      )
    }
  }

  app.post('/roles/grant', c => changeRole(c, 'grant'))
  app.post('/roles/revoke', c => changeRole(c, 'revoke'))

  app.get('/compose', async c => {
    const gate = await requireSession(c)
    if ('redirect' in gate) return gate.redirect

    const { env, viewer } = gate
    if (!env.privateKeyPath) {
      return renderWaitlist(c, env, viewer, { error: NO_KEY_TO_SEND }, 400)
    }

    try {
      const rows = await loadWaitlist(env, viewer)
      const recipientCount = rows.filter(r => r.email.includes('@')).length
      return c.html(
        <ComposePage
          envLabel={env.label}
          username={viewer.username}
          recipientCount={recipientCount}
        />
      )
    } catch (error) {
      return c.html(
        <ComposePage
          envLabel={env.label}
          username={viewer.username}
          recipientCount={0}
          error={dbErrorMessage(env, error)}
        />,
        500
      )
    }
  })

  app.post('/send', async c => {
    const gate = await requireSession(c)
    if ('redirect' in gate) return gate.redirect

    const { env, viewer } = gate
    if (!env.privateKeyPath) {
      return renderWaitlist(c, env, viewer, { error: NO_KEY_TO_SEND }, 400)
    }

    const body = await c.req.parseBody()
    const subject = field(body, 'subject').trim()
    const messageBody = field(body, 'body').trim()

    // Validate before any DB work so an empty submission returns 400 without
    // querying the database or decrypting recipients.
    if (!subject || !messageBody) {
      return c.html(
        <ComposePage
          envLabel={env.label}
          username={viewer.username}
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
      const rows = await loadWaitlist(env, viewer)
      recipients = rows.map(r => r.email).filter(e => e.includes('@'))
    } catch (error) {
      return c.html(
        <ComposePage
          envLabel={env.label}
          username={viewer.username}
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
          username={viewer.username}
          results={results}
        />
      )
    } catch (error) {
      console.error(`[admin] mail provider failure for "${env.name}":`, error)
      return c.html(
        <ComposePage
          envLabel={env.label}
          username={viewer.username}
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
