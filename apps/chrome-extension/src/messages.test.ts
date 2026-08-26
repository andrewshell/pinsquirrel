import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isConnectRequest,
  isSyncRequest,
  requestConnect,
  requestSync,
  SYNC_REQUEST,
} from './messages.ts'
import { stubChrome } from './test/chrome-mock.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestSync', () => {
  it('asks the service worker to sync and hands back its answer', async () => {
    const chrome = stubChrome()
    chrome.sendMessage.mockResolvedValue({ ok: true })

    await expect(requestSync()).resolves.toEqual({ ok: true })
    expect(chrome.sendMessage).toHaveBeenCalledWith({ type: 'sync' })
  })

  it('passes a failure the worker reported through unchanged', async () => {
    const chrome = stubChrome()
    chrome.sendMessage.mockResolvedValue({ ok: false, error: 'Tag not found' })

    await expect(requestSync()).resolves.toEqual({
      ok: false,
      error: 'Tag not found',
    })
  })

  it('reports an answer that is not a sync response as a failure', async () => {
    const chrome = stubChrome()
    chrome.sendMessage.mockResolvedValue(undefined)

    const response = await requestSync()

    expect(response.ok).toBe(false)
    expect(response).toHaveProperty('error', expect.stringContaining('sync'))
  })

  it('reports a worker that could not be reached as a failure', async () => {
    const chrome = stubChrome()
    chrome.sendMessage.mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.')
    )

    await expect(requestSync()).resolves.toEqual({
      ok: false,
      error: 'Could not establish connection. Receiving end does not exist.',
    })
  })
})

describe('isSyncRequest', () => {
  it('recognises the request the popup sends', () => {
    expect(isSyncRequest(SYNC_REQUEST)).toBe(true)
  })

  it('rejects anything else that arrives on the message channel', () => {
    expect(isSyncRequest({ type: 'something-else' })).toBe(false)
    expect(isSyncRequest('sync')).toBe(false)
    expect(isSyncRequest(null)).toBe(false)
  })
})

describe('requestConnect', () => {
  it('asks the service worker to connect and hands back its answer', async () => {
    const chrome = stubChrome()
    chrome.sendMessage.mockResolvedValue({ ok: true })

    await expect(requestConnect('https://pinsquirrel.com')).resolves.toEqual({
      ok: true,
    })
    expect(chrome.sendMessage).toHaveBeenCalledWith({
      type: 'connect',
      baseUrl: 'https://pinsquirrel.com',
    })
  })

  it('passes a failure the worker reported through unchanged', async () => {
    const chrome = stubChrome()
    chrome.sendMessage.mockResolvedValue({
      ok: false,
      error: 'The user closed the window',
      reauthorizationRequired: true,
    })

    await expect(requestConnect('https://pinsquirrel.com')).resolves.toEqual({
      ok: false,
      error: 'The user closed the window',
      reauthorizationRequired: true,
    })
  })

  it('reports an answer that is not a connect response as a failure', async () => {
    const chrome = stubChrome()
    chrome.sendMessage.mockResolvedValue(undefined)

    const response = await requestConnect('https://pinsquirrel.com')

    expect(response.ok).toBe(false)
    expect(response).toHaveProperty('error', expect.stringContaining('connect'))
  })

  it('reports a worker that could not be reached as a failure', async () => {
    const chrome = stubChrome()
    chrome.sendMessage.mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.')
    )

    await expect(requestConnect('https://pinsquirrel.com')).resolves.toEqual({
      ok: false,
      error: 'Could not establish connection. Receiving end does not exist.',
    })
  })
})

describe('isConnectRequest', () => {
  it('recognises the request the popup sends, and keeps its server', () => {
    const request = { type: 'connect', baseUrl: 'https://pinsquirrel.com' }

    expect(isConnectRequest(request)).toBe(true)
  })

  it('rejects anything else that arrives on the message channel', () => {
    expect(isConnectRequest({ type: 'connect' })).toBe(false)
    expect(isConnectRequest({ type: 'sync' })).toBe(false)
    expect(isConnectRequest('connect')).toBe(false)
    expect(isConnectRequest(null)).toBe(false)
  })

  it('does not answer to the sync request, and sync does not answer to it', () => {
    const connect = { type: 'connect', baseUrl: 'https://pinsquirrel.com' }

    expect(isSyncRequest(connect)).toBe(false)
    expect(isConnectRequest(SYNC_REQUEST)).toBe(false)
  })
})
