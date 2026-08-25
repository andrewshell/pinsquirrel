import { lookup as dnsLookup } from 'node:dns'
import type { HttpFetcher } from '@pinsquirrel/domain'
import {
  FetchTimeoutError,
  HttpError,
  InvalidUrlError,
  isBlockedIpAddress,
} from '@pinsquirrel/domain'
import { Agent, fetch as undiciFetch } from 'undici'

/** One answer from a DNS lookup. */
export interface ResolvedAddress {
  address: string
  family: number
}

/** Resolve every address a hostname points at. Injectable for tests. */
export type ResolveHostname = (hostname: string) => Promise<ResolvedAddress[]>

/** The subset of `fetch` this adapter uses. */
type FetchLike = (
  url: string,
  init: {
    headers: Record<string, string>
    signal: AbortSignal
    dispatcher?: Agent
  }
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

/**
 * Thrown from the connect-time lookup, and recognised again in `fetch` — the
 * dispatcher has no other way to say "this was a policy decision, not a
 * network fault", since undici reports every connect failure the same way.
 */
class BlockedAddressError extends Error {
  constructor(hostname: string, address: string) {
    super(`Refusing to connect to ${hostname}: ${address} is a private address`)
    this.name = 'BlockedAddressError'
  }
}

function defaultResolve(hostname: string): Promise<ResolvedAddress[]> {
  return new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true }, (error, addresses) => {
      if (error) reject(error)
      else resolve(addresses)
    })
  })
}

/**
 * Was this failure our own refusal to connect?
 *
 * undici wraps whatever the connector threw as the `cause` of a generic
 * `TypeError: fetch failed`, so the tag has to be dug back out.
 */
function wasBlocked(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; current != null && depth < 5; depth++) {
    if (current instanceof BlockedAddressError) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

export class NodeHttpFetcher implements HttpFetcher {
  private readonly dispatcher: Agent

  /**
   * @param fetchFn undici's `fetch`, not the global one: only undici's own
   *   dispatcher is accepted by undici's own fetch, and the dispatcher is
   *   where the address check lives.
   * @param resolve how a hostname becomes addresses. Injectable so the SSRF
   *   guard can be tested without a DNS server that answers to order.
   */
  constructor(
    private fetchFn: FetchLike = undiciFetch,
    private timeout: number = 10000,
    resolve: ResolveHostname = defaultResolve
  ) {
    this.dispatcher = new Agent({
      // The check has to happen here rather than before the fetch, because
      // between a pre-flight resolve and the connection the answer can change
      // (DNS rebinding) — and because a redirect to a private address gets the
      // same treatment for free, each hop connecting through this dispatcher.
      connect: {
        lookup: (hostname, options, callback) => {
          resolve(hostname).then(
            addresses => {
              const blocked = addresses.find(({ address, family }) =>
                isBlockedIpAddress(address, family)
              )
              if (blocked) {
                // One private answer condemns the whole name: a resolver that
                // returns both a public and a private address would otherwise
                // be a coin toss.
                callback(
                  new BlockedAddressError(hostname, blocked.address),
                  '',
                  0
                )
                return
              }
              if (options.all === true) {
                callback(null, addresses, 0)
                return
              }
              callback(null, addresses[0].address, addresses[0].family)
            },
            (error: unknown) => {
              callback(
                error instanceof Error ? error : new Error(String(error)),
                '',
                0
              )
            }
          )
        },
      },
    })
  }

  async fetch(url: string): Promise<string> {
    let response: Awaited<ReturnType<FetchLike>>
    try {
      response = await this.fetchFn(url, {
        headers: {
          'User-Agent': 'PinSquirrel/1.0 (Bookmark Metadata Fetcher)',
        },
        signal: AbortSignal.timeout(this.timeout),
        dispatcher: this.dispatcher,
      })
    } catch (error) {
      // A hostname that resolves into a private range is the same refusal as
      // a URL that names one outright, so it surfaces as the same error.
      if (wasBlocked(error)) {
        throw new InvalidUrlError(url)
      }
      // AbortSignal.timeout rejects with a TimeoutError DOMException; an
      // explicit abort surfaces as AbortError. Both mean "took too long".
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new FetchTimeoutError(url)
      }
      throw error
    }

    if (!response.ok) {
      throw new HttpError(response.status, url)
    }

    return response.text()
  }
}
