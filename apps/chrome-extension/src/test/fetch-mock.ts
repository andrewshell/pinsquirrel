import { vi } from 'vitest'

/**
 * A `fetch` stub that answers by URL.
 *
 * Routing on the whole URL rather than queueing responses in order is what
 * lets a test assert that discovery asked for the right document: a handler
 * registered under the wrong path is never called, and the request falls
 * through to a 404 the test can see.
 */

/** What one route answers with: a response, or a function of the request. */
export type RouteHandler =
  | Response
  | ((
      url: string,
      init: RequestInit | undefined
    ) => Response | Promise<Response>)

export interface StubbedFetch {
  /** The `fetch` mock itself, for call-count and argument assertions. */
  mock: ReturnType<typeof vi.fn>
  /** Every URL requested, in order. */
  urls: string[]
  /** Add or replace a route after the stub is installed. */
  route(url: string, handler: RouteHandler): void
}

/** A JSON response, the shape every OAuth endpoint here answers with. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** The URL out of whichever of `fetch`'s three input forms was used. */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

/** Install the stub on `globalThis.fetch` and hand back its innards. */
export function stubFetch(
  handlers: Record<string, RouteHandler> = {}
): StubbedFetch {
  const routes = new Map<string, RouteHandler>(Object.entries(handlers))
  const urls: string[] = []

  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input)
    urls.push(url)
    const handler = routes.get(url)
    if (!handler) {
      return Promise.resolve(
        new Response(`No route stubbed for ${url}`, { status: 404 })
      )
    }
    // A Response body can only be read once, so a route registered as a
    // literal Response is cloned rather than handed out twice.
    if (handler instanceof Response) return Promise.resolve(handler.clone())
    return Promise.resolve(handler(url, init))
  })

  vi.stubGlobal('fetch', mock)

  return {
    mock,
    urls,
    route: (url, handler) => routes.set(url, handler),
  }
}
