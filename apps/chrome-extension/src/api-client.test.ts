import { afterEach, describe, expect, it, vi } from 'vitest'
import { PinSquirrelApiClient } from './api-client.ts'
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
