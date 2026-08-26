import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, PinSquirrelApiClient } from './api-client.ts'
import { ReauthorizationRequiredError } from './auth.ts'
import { jsonResponse, stubFetch } from './test/fetch-mock.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

const BASE_URL = 'https://pinsquirrel.com'

const TAG = {
  id: 'tag-1',
  userId: 'user-1',
  name: 'reading',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

/** A client over the stubbed global `fetch`, standing in for `authorizedFetch`. */
function clientOver(routes: Parameters<typeof stubFetch>[0]) {
  const server = stubFetch(routes)
  const client = new PinSquirrelApiClient({
    baseUrl: BASE_URL,
    fetch: globalThis.fetch,
  })
  return { client, server }
}

describe('getTags', () => {
  it('reads the tags off GET /api/v1/tags', async () => {
    const { client, server } = clientOver({
      [`${BASE_URL}/api/v1/tags`]: jsonResponse([TAG]),
    })

    await expect(client.getTags()).resolves.toEqual([TAG])
    expect(server.urls).toEqual([`${BASE_URL}/api/v1/tags`])
  })

  it('asks for the pin counts when they are wanted', async () => {
    const withCount = { ...TAG, pinCount: 12 }
    const { client, server } = clientOver({
      [`${BASE_URL}/api/v1/tags?withCounts=true`]: jsonResponse([withCount]),
    })

    await expect(client.getTags(true)).resolves.toEqual([withCount])
    expect(server.urls).toEqual([`${BASE_URL}/api/v1/tags?withCounts=true`])
  })
})

const PIN = {
  id: 'pin-1',
  userId: 'user-1',
  url: 'https://example.com/article',
  title: 'An article',
  description: null,
  readLater: false,
  isPrivate: false,
  tagNames: ['reading'],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

/** The pagination block the server computes, for a single full page. */
function pageOf(pins: unknown[], page = 1, totalCount = pins.length) {
  const pageSize = 100
  return {
    pins,
    pagination: {
      totalCount,
      page,
      pageSize,
      offset: (page - 1) * pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      hasNext: page * pageSize < totalCount,
      hasPrevious: page > 1,
    },
  }
}

describe('getPinsForTag', () => {
  it('reads a page of pins off GET /api/v1/tags/:id/pins', async () => {
    const body = pageOf([PIN])
    const { client, server } = clientOver({
      [`${BASE_URL}/api/v1/tags/tag-1/pins`]: jsonResponse(body),
    })

    await expect(client.getPinsForTag('tag-1')).resolves.toEqual(body)
    expect(server.urls).toEqual([`${BASE_URL}/api/v1/tags/tag-1/pins`])
  })

  it('asks for the page and size it was given', async () => {
    const url = `${BASE_URL}/api/v1/tags/tag-1/pins?page=2&pageSize=50`
    const { client, server } = clientOver({
      [url]: jsonResponse(pageOf([PIN], 2, 150)),
    })

    await client.getPinsForTag('tag-1', 2, 50)

    expect(server.urls).toEqual([url])
  })

  it('encodes a tag id that is not URL-safe into the path', async () => {
    const url = `${BASE_URL}/api/v1/tags/a%2Fb%20c/pins`
    const { client, server } = clientOver({ [url]: jsonResponse(pageOf([])) })

    await client.getPinsForTag('a/b c')

    expect(server.urls).toEqual([url])
  })
})

describe('failures', () => {
  it('throws the status and the message the API gave for a non-2xx', async () => {
    const { client } = clientOver({
      [`${BASE_URL}/api/v1/tags`]: jsonResponse(
        { error: 'Tag not found' },
        404
      ),
    })

    const error = await client.getTags().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 404,
      message: 'Tag not found',
      code: undefined,
    })
  })

  it('keeps the RFC 6749 code apart from the description on a 401', async () => {
    const { client } = clientOver({
      [`${BASE_URL}/api/v1/tags`]: jsonResponse(
        {
          error: 'invalid_token',
          error_description: 'The access token is invalid, expired, or revoked',
        },
        401
      ),
    })

    const error = await client.getTags().catch((e: unknown) => e)

    expect(error).toMatchObject({
      status: 401,
      code: 'invalid_token',
      message: 'The access token is invalid, expired, or revoked',
    })
  })

  it('falls back to the status when the body is not JSON', async () => {
    const { client } = clientOver({
      [`${BASE_URL}/api/v1/tags`]: new Response('Too many requests.', {
        status: 429,
      }),
    })

    const error = await client.getTags().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 429 })
    expect((error as ApiError).message).toContain('429')
  })

  it('refuses a 200 that is not the shape it asked for', async () => {
    const { client } = clientOver({
      [`${BASE_URL}/api/v1/tags`]: jsonResponse({ tags: [TAG] }),
    })

    await expect(client.getTags()).rejects.toThrow(/GET \/api\/v1\/tags/)
  })

  it('refuses a tag that is missing a field the extension reads', async () => {
    const nameless = { ...TAG, name: undefined }
    const { client } = clientOver({
      [`${BASE_URL}/api/v1/tags`]: jsonResponse([nameless]),
    })

    await expect(client.getTags()).rejects.toThrow(/GET \/api\/v1\/tags/)
  })

  it('lets a ReauthorizationRequiredError through untouched', async () => {
    const reauth = new ReauthorizationRequiredError('consent again')
    const client = new PinSquirrelApiClient({
      baseUrl: BASE_URL,
      fetch: () => Promise.reject(reauth),
    })

    await expect(client.getTags()).rejects.toBe(reauth)
  })
})
