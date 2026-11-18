import type {
  OAuthClient,
  CreateOAuthClientData,
  UpdateOAuthClientData,
} from '../entities/oauth-client.js'
import type { Repository } from './repository.js'

export interface OAuthClientRepository extends Repository<
  OAuthClient,
  CreateOAuthClientData,
  UpdateOAuthClientData
> {
  /**
   * Look a client up by the identifier it sends. Every request from a client
   * arrives with `client_id`, not with the row id, so this is the hot path.
   */
  findByClientId(clientId: string): Promise<OAuthClient | null>

  /**
   * Record that the client completed an authorization, which takes it out of
   * the incomplete-registration sweep below.
   */
  markCompleted(id: string, date: Date): Promise<void>

  /**
   * Delete `dcr` and `cimd` registrations created before `registeredBefore`
   * that never completed an authorization, and report how many that was.
   *
   * Named like `SessionRepository.deleteExpiredSessions` because it joins the
   * same sweep, but the cutoff is passed in: the TTL is a policy the service
   * owns, not a property of the row. Both kinds are rows an anonymous caller
   * can create: a `dcr` row at registration, a `cimd` row when the consent
   * page renders. A `static` client is entered by an operator and may sit
   * unused indefinitely, so it is never swept.
   */
  deleteExpiredIncompleteClients(registeredBefore: Date): Promise<number>
}
