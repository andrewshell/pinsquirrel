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
