import { createHash, randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  AccessControl,
  OAuthAccessDeniedError,
  UserStatus,
  type HttpFetcher,
  type User,
} from '@pinsquirrel/domain'
import { OAuthService } from '@pinsquirrel/services'
import { oauthConfig } from './lib/config'
import {
  db,
  oauthAuthorizationCodeRepository,
  oauthClientRepository,
  oauthTokenRepository,
  sessionRepository,
  userRepository,
} from './lib/db'
import { accountService } from './lib/services'

/**
 * An authorization request that is still running when the user's sessions and
 * tokens are revoked, which is what a password reset or change does.
 *
 * The real `OAuthService` over the real repositories, with one substitution: a
 * client metadata fetcher the test holds open. That fetch is the slow step
 * between the session check at the start of the request and the code written
 * at its end, and its duration is up to whoever names the client.
 */

const REDIRECT_URI = 'https://cimd.example/callback'

let user: User
const createdUsers: string[] = []
const clientIds: string[] = []

/**
 * A client id never seen before, so the request has to fetch its document:
 * a cached one would skip the slow step this is about.
 */
function freshClientId(): string {
  const id = `https://cimd.example/${randomBytes(4).toString('hex')}.json`
  clientIds.push(id)
  return id
}

async function signUp(): Promise<User> {
  const username = `reset${randomBytes(6).toString('hex')}`
  accountService.register({ username, email: `${username}@example.test` })
  const created = await vi.waitFor(async () => {
    const found = await userRepository.findByUsername(username)
    if (!found) throw new Error('Signup did not create the test user')
    return found
  })
  createdUsers.push(created.id)
  await userRepository.update(created.id, { status: UserStatus.Active })
  return (await userRepository.findById(created.id)) as User
}

async function signIn(userId: string): Promise<string> {
  const id = createHash('sha256')
    .update(randomBytes(32).toString('base64url'))
    .digest('hex')
  await sessionRepository.create({
    id,
    userId,
    data: { userId },
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  })
  return id
}

/** A service whose metadata fetch waits until the test lets it finish. */
function serviceWithHeldFetch(clientId: string) {
  let release!: () => void
  const held = new Promise<void>(resolve => (release = resolve))
  let started!: () => void
  const fetchStarted = new Promise<void>(resolve => (started = resolve))

  const fetcher: HttpFetcher = {
    async fetch() {
      started()
      await held
      return JSON.stringify({
        client_id: clientId,
        client_name: 'Slow metadata document',
        redirect_uris: [REDIRECT_URI],
        grant_types: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_method: 'none',
      })
    },
  }

  const service = new OAuthService(
    oauthClientRepository,
    oauthAuthorizationCodeRepository,
    oauthTokenRepository,
    userRepository,
    fetcher,
    {
      issuer: oauthConfig.issuer,
      resources: [
        oauthConfig.resources.mcp.resource,
        oauthConfig.resources.apiV1.resource,
      ],
    }
  )

  return { service, release, fetchStarted }
}

function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function authorizeInput(
  clientId: string,
  sessionId: string,
  challenge: string
) {
  return {
    userId: user.id,
    sessionId,
    approved: true,
    params: {
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'pins:read offline_access',
      state: 'state',
      resource: oauthConfig.resources.mcp.resource,
    },
  }
}

beforeAll(async () => {
  user = await signUp()
})

afterAll(async () => {
  for (const id of createdUsers) await userRepository.delete(id)
  for (const clientId of clientIds) {
    const client = await oauthClientRepository.findByClientId(clientId)
    if (client) await oauthClientRepository.delete(client.id)
  }
  await (db as unknown as { $client: { end(): Promise<void> } }).$client.end()
})

describe('an authorization in flight across a revocation', () => {
  it('issues an exchangeable code when nothing is revoked meanwhile', async () => {
    const sessionId = await signIn(user.id)
    const clientId = freshClientId()
    const { service, release, fetchStarted } = serviceWithHeldFetch(clientId)
    const { verifier, challenge } = pkcePair()

    const inFlight = service.authorize(
      new AccessControl(user),
      authorizeInput(clientId, sessionId, challenge)
    )
    await fetchStarted
    release()
    const outcome = await inFlight
    expect(outcome.status).toBe('approved')
    if (outcome.status !== 'approved') return

    const tokens = await service.exchangeAuthorizationCode({
      grant_type: 'authorization_code',
      code: outcome.code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
    })
    expect(tokens.accessToken).toBeTruthy()
  })

  it('issues no code when the sessions were revoked while it ran', async () => {
    const sessionId = await signIn(user.id)
    const clientId = freshClientId()
    const { service, release, fetchStarted } = serviceWithHeldFetch(clientId)
    const { challenge } = pkcePair()

    const inFlight = service.authorize(
      new AccessControl(user),
      authorizeInput(clientId, sessionId, challenge)
    )
    await fetchStarted
    await userRepository.revokeSessionsAndTokens(user.id)
    release()

    await expect(inFlight).rejects.toBeInstanceOf(OAuthAccessDeniedError)
  })
})
