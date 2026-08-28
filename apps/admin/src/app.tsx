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
  CannotDeleteOwnAccountError,
  AdminAlreadyExistsError,
} from '@pinsquirrel/domain'
import type { User } from '@pinsquirrel/domain'
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
  BootstrapPage,
  LoginPage,
  UnlockPage,
  UsersPage,
  WaitlistPage,
  ComposePage,
  SentPage,
} from './views.js'
import type { Context } from 'hono'

const COOKIE = 'admin_session'

/** Where landing() sends a session that has cleared every gate before it. */
const CONSOLE = '/waitlist'

/** Shown when a grant target is deleted mid-action. */
const GONE = 'That user no longer exists.'

/**
 * Shown when a sign-in is valid but the console is not this account's to open.
 *
 * The same words whether the account simply is not an admin or lost a race for
 * the first admin role: both mean this system has one and it is not them.
 */
const NOT_AN_ADMIN = 'This account is not an admin.'

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
   * Where a session belongs right now: the console, or a step before it.
   *
   * Both gates are console-wide rather than per page — a half-open session
   * finishes opening wherever it was pointed — so they are decided here once,
   * in the order they have to clear. An environment with no key path seals
   * nothing, and a gate with nothing behind it would only lock the operator
   * out.
   *
   * Claiming admin comes before unlocking: an account that is not an admin yet
   * would be refused by every service call behind the key, so prompting it for
   * a passphrase asks for work with nothing at the end of it.
   */
  function landing(env: AdminEnvironment, session: AdminSession): string {
    if (session.bootstrap) return '/bootstrap'
    if (env.privateKeyPath && !session.privateKey) return '/unlock'
    return CONSOLE
  }

  /**
   * The session gate every signed-in route runs first.
   *
   * Returns the redirect to send instead when the caller may not proceed, so a
   * route is `const gate = await requireSession(c); if ('redirect' in gate)…`
   * rather than its own copy of the checks. A session that landing() puts on
   * an earlier step is sent there, which is what keeps a pre-claim session off
   * the console pages entirely: the services would refuse those calls anyway,
   * but a page that renders nothing but its own error tells nobody what to do
   * next.
   */
  async function requireSession(c: Context): Promise<Gate> {
    const sess = await currentSession(c)
    if (!sess) return { redirect: c.redirect('/login') }
    const env = getEnvironment(config, sess.session.environment)
    const step = landing(env, sess.session)
    if (step !== CONSOLE) {
      return { redirect: c.redirect(step) }
    }
    return {
      env,
      viewer: {
        username: sess.session.username,
        privateKey: sess.session.privateKey,
      },
    }
  }

  /**
   * Sign in, or find out that this account may claim the first admin role.
   *
   * Two of login()'s outcomes describe an account an unadministered system
   * should still admit: a valid sign-in without the Admin role, and an account
   * the waitlist still holds — which is where a fresh database leaves the
   * operator, because admitting them needs an admin who does not exist.
   *
   * Which of those the environment actually accepts is not decided here.
   * loginForBootstrap re-verifies the credentials and the zero-admin invariant
   * for itself and refuses on its own terms; this only chooses which question
   * to ask, and reports whichever refusal came back. Nothing proceeds past a
   * service saying no.
   */
  async function signIn(
    env: AdminEnvironment,
    username: string,
    password: string
  ): Promise<{ user: User; bootstrap: boolean } | { notAdmin: true }> {
    const { authService } = getRuntime(env)
    let waitlisted: AccessNotGrantedError | null = null

    try {
      const user = await authService.login({ username, password })
      if (user.roles.includes(Role.Admin)) {
        return { user, bootstrap: false }
      }
    } catch (error) {
      // Only "you are on the waitlist" is worth a second question. A wrong
      // password is not an operator waiting to be let in, and asking twice
      // would double what a guess costs the server.
      if (!(error instanceof AccessNotGrantedError)) throw error
      waitlisted = error
    }

    try {
      return {
        user: await authService.loginForBootstrap({ username, password }),
        bootstrap: true,
      }
    } catch (error) {
      // There is an admin, so there was never a claim to make. Report what
      // stopped the ordinary sign-in instead of the claim's own refusal.
      if (error instanceof AdminAlreadyExistsError) {
        if (waitlisted) throw waitlisted
        return { notAdmin: true }
      }
      throw error
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
      const outcome = await signIn(env, username, password)
      if ('notAdmin' in outcome) {
        return c.html(
          <LoginPage
            environments={config.environments}
            selected={environment}
            username={username}
            error={NOT_AN_ADMIN}
          />,
          403
        )
      }
      loginLimiter.reset(limitKey)

      const session: AdminSession = {
        environment,
        userId: outcome.user.id,
        username: outcome.user.username,
        bootstrap: outcome.bootstrap,
      }
      const id = createSession(session)
      await setSignedCookie(c, COOKIE, id, config.sessionSecret, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        // Off in local development, where the console is served over plain
        // http and a Secure cookie would never come back.
        secure: process.env.NODE_ENV === 'production',
      })
      return c.redirect(landing(env, session))
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
        error instanceof AccessNotGrantedError ||
        // The account never confirmed its email, so it is not eligible for the
        // claim either. Said the same way as the waitlist refusal: which of
        // the two it is, is the account holder's business, not a visitor's.
        error instanceof UserNotEligibleError
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

  /**
   * The claim has been settled by someone other than this page.
   *
   * A claim only exists while nobody holds Admin, so once one does it cannot
   * be offered again — but this account may have been granted the role in the
   * meantime, by the new admin or by this session's own earlier submit.
   * Re-reading decides between carrying on into the console and going back to
   * sign in, so neither outcome is a page that refuses everything it renders.
   */
  async function claimSettled(
    c: Context,
    sess: { id: string; session: AdminSession },
    env: AdminEnvironment
  ): Promise<Response> {
    const user = await getRuntime(env).userService.getUserByUsername(
      sess.session.username
    )

    if (user?.roles.includes(Role.Admin)) {
      const session = { ...sess.session, bootstrap: false }
      updateSession(sess.id, session)
      return c.redirect(landing(env, session))
    }

    // The session was opened only to make a claim that is gone, so it is
    // closed rather than left pointing at pages that would all refuse it.
    destroySession(sess.id)
    deleteCookie(c, COOKIE, { path: '/' })
    return c.html(
      <LoginPage
        environments={config.environments}
        selected={env.name}
        username={sess.session.username}
        error={NOT_AN_ADMIN}
      />,
      403
    )
  }

  app.get('/bootstrap', async c => {
    const sess = await currentSession(c)
    if (!sess) return c.redirect('/login')

    const env = getEnvironment(config, sess.session.environment)
    const step = landing(env, sess.session)
    if (step !== '/bootstrap') return c.redirect(step)

    // The session was flagged at sign-in and another operator may have claimed
    // the role since. Asking again means the page never offers a claim that is
    // certain to be refused; the submit re-checks it in the service anyway.
    if (await getRuntime(env).userService.hasAdmin()) {
      return claimSettled(c, sess, env)
    }

    return c.html(
      <BootstrapPage envLabel={env.label} username={sess.session.username} />
    )
  })

  app.post('/bootstrap', async c => {
    const sess = await currentSession(c)
    if (!sess) return c.redirect('/login')

    const env = getEnvironment(config, sess.session.environment)
    const step = landing(env, sess.session)
    if (step !== '/bootstrap') return c.redirect(step)

    try {
      // The claimant is whoever is signed in, taken off the session — the form
      // carries no user, so there is nothing on it to swap for someone else.
      await getRuntime(env).authService.bootstrapAdmin(sess.session.userId)

      // Clear the flag before deciding where they land, or landing() would
      // send them straight back to the page they just finished with.
      const session = { ...sess.session, bootstrap: false }
      updateSession(sess.id, session)
      return c.redirect(landing(env, session))
    } catch (error) {
      if (error instanceof AdminAlreadyExistsError) {
        return claimSettled(c, sess, env)
      }
      // The account never confirmed its email. The service's message names it
      // and says so; there is nothing this page can add.
      if (error instanceof UserNotEligibleError) {
        return c.html(
          <BootstrapPage
            envLabel={env.label}
            username={sess.session.username}
            error={error.message}
          />,
          400
        )
      }
      console.error(`[admin] bootstrap failed for "${env.name}":`, error)
      return c.html(
        <BootstrapPage
          envLabel={env.label}
          username={sess.session.username}
          error={`Couldn't reach the ${env.label} database. Please try again.`}
        />,
        500
      )
    }
  })

  app.get('/unlock', async c => {
    const sess = await currentSession(c)
    if (!sess) return c.redirect('/login')

    const env = getEnvironment(config, sess.session.environment)
    // Nothing to unlock here: this session already did, this environment has
    // no key at all, or it has not claimed admin yet and the key would open
    // pages it cannot use.
    const step = landing(env, sess.session)
    // `!keyPath` is already implied by the step — landing() only answers
    // /unlock where there is a key path — but it is what narrows the type.
    const keyPath = env.privateKeyPath
    if (step !== '/unlock' || !keyPath) return c.redirect(step)

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
    // A session with no claim behind it has no business holding the key, and
    // an environment with no key file has nothing to hand it.
    if (sess.session.bootstrap) return c.redirect('/bootstrap')
    if (!keyPath) return c.redirect(CONSOLE)

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
   * Save one user's row of role dropdowns from the Users page.
   *
   * The form posts a yes/no per role rather than one change, so the handler
   * diffs the submitted states against the row as it stands and calls
   * grantRole/revokeRole only for what actually moved — the services are
   * idempotent but their results cannot say whether anything changed, which is
   * why the row is read first. That read is also what makes "no changes" a
   * reportable outcome rather than a silent write of nothing.
   */
  app.post('/users/update', async c => {
    const gate = await requireSession(c)
    if ('redirect' in gate) return gate.redirect

    const { env } = gate
    const username = gate.viewer.username
    const body = await c.req.parseBody()
    const userId = field(body, 'userId')

    if (!userId) {
      return renderUsers(
        c,
        env,
        username,
        { error: 'No user was selected.' },
        400
      )
    }

    // The states are form fields, so they are whatever the client sent. Every
    // role the enum names must arrive as yes or no before a service is called.
    const states = new Map<Role, boolean>()
    for (const { name } of ROLE_COLUMNS) {
      const state = field(body, `role-${name}`)
      if (state !== 'yes' && state !== 'no') {
        return renderUsers(
          c,
          env,
          username,
          { error: 'That is not a role.' },
          400
        )
      }
      states.set(name, state === 'yes')
    }

    try {
      const ac = await adminAccessControl(env, username)

      // The list decides nothing about existence — the services re-check — but
      // a row that is not on it has nothing to diff against, and the edit form
      // that posted it was rendered before the user went away.
      const target = (await loadUsers(env, username)).find(r => r.id === userId)
      if (!target) {
        return renderUsers(c, env, username, { error: GONE }, 404)
      }

      const { authService } = getRuntime(env)
      const changes: string[] = []
      for (const [role, wanted] of states) {
        if (wanted === target.roles.includes(role)) continue
        if (wanted) {
          await authService.grantRole(ac, userId, role)
          changes.push(`Granted the ${role} role to ${target.username}.`)
        } else {
          await authService.revokeRole(ac, userId, role)
          // Losing Role.User is a suspension rather than a permission tweak —
          // login() requires it — and the table has no other place to say so.
          const suspended =
            role === Role.User ? ' They can no longer sign in.' : ''
          changes.push(
            `Revoked the ${role} role from ${target.username}.${suspended}`
          )
        }
      }

      return renderUsers(c, env, username, {
        notice:
          changes.length > 0
            ? changes.join(' ')
            : `No changes to ${target.username}.`,
      })
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return renderUsers(c, env, username, { error: GONE }, 404)
      }
      // An admin cannot revoke their own roles. The page leaves their row
      // inert, so this is a stale render or a hand-made post; the service's
      // message already says which role and why.
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
  })

  // Delete one account outright, from the trash icon on its row. The service
  // cascades everything the account owns and refuses a self-delete.
  app.post('/users/delete', async c => {
    const gate = await requireSession(c)
    if ('redirect' in gate) return gate.redirect

    const { env } = gate
    const username = gate.viewer.username
    const body = await c.req.parseBody()
    const userId = field(body, 'userId')

    if (!userId) {
      return renderUsers(
        c,
        env,
        username,
        { error: 'No user was selected.' },
        400
      )
    }

    try {
      const ac = await adminAccessControl(env, username)
      const deleted = await getRuntime(env).authService.deleteUser(ac, userId)
      return renderUsers(c, env, username, {
        notice: `Deleted ${deleted.username} and everything they owned.`,
      })
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return renderUsers(c, env, username, { error: GONE }, 404)
      }
      // The page leaves the admin's own row inert, so this is a stale render
      // or a hand-made post; the service's message says why it was refused.
      if (error instanceof CannotDeleteOwnAccountError) {
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
  })

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
