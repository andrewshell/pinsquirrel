import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from 'vitest'
import {
  FetchTimeoutError,
  HttpError,
  InvalidUrlError,
  ResponseTooLargeError,
} from '@pinsquirrel/domain'
import { fetch as undiciFetch } from 'undici'
import { NodeHttpFetcher } from './node-http-fetcher.js'

describe('NodeHttpFetcher', () => {
  const mockFetch = vi.fn()
  let fetcher: NodeHttpFetcher

  beforeEach(() => {
    fetcher = new NodeHttpFetcher(mockFetch, 5000)
    mockFetch.mockClear()
  })

  it('should fetch HTML successfully', async () => {
    const mockHtml = '<html><head><title>Test</title></head></html>'
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockHtml),
    })

    const result = await fetcher.fetch('https://example.com')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
      headers: {
        'User-Agent': 'PinSquirrel/1.0 (Bookmark Metadata Fetcher)',
      },
      signal: expect.any(AbortSignal) as AbortSignal,
      // The dispatcher is not incidental: it carries the address check that
      // runs when the connection is actually made.
      dispatcher: expect.anything() as unknown,
    })
    expect(result).toBe(mockHtml)
  })

  it('should throw HttpError carrying the status for a non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    const error: unknown = await fetcher
      .fetch('https://example.com')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(HttpError)
    expect((error as HttpError).status).toBe(404)
    expect((error as HttpError).message).toContain('https://example.com')
  })

  it('should throw FetchTimeoutError when the request times out', async () => {
    mockFetch.mockRejectedValue(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError'
      )
    )

    await expect(fetcher.fetch('https://example.com')).rejects.toBeInstanceOf(
      FetchTimeoutError
    )
  })

  it('should throw FetchTimeoutError when the request is aborted', async () => {
    mockFetch.mockRejectedValue(
      new DOMException('The operation was aborted', 'AbortError')
    )

    await expect(fetcher.fetch('https://example.com')).rejects.toBeInstanceOf(
      FetchTimeoutError
    )
  })

  it('should propagate network errors unchanged', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(fetcher.fetch('https://example.com')).rejects.toThrow(
      'Network error'
    )
  })

  // A hostname the attacker controls can resolve to anything, so checking the
  // string in the URL proves nothing. `evil.example` pointing at the cloud
  // metadata endpoint passes every check in validateUrlForFetching.
  describe('when the hostname resolves to a private address', () => {
    it('refuses the cloud metadata endpoint', async () => {
      const fetcher = new NodeHttpFetcher(undefined, 5000, () =>
        Promise.resolve([{ address: '169.254.169.254', family: 4 }])
      )

      await expect(
        fetcher.fetch('http://metadata.example/latest/meta-data/')
      ).rejects.toBeInstanceOf(InvalidUrlError)
    })

    it('refuses when only one of several answers is private', async () => {
      const fetcher = new NodeHttpFetcher(undefined, 5000, () =>
        Promise.resolve([
          { address: '93.184.216.34', family: 4 },
          { address: '127.0.0.1', family: 4 },
        ])
      )

      await expect(
        fetcher.fetch('http://split-horizon.example/')
      ).rejects.toBeInstanceOf(InvalidUrlError)
    })

    it('refuses an IPv6 answer inside a private range', async () => {
      const fetcher = new NodeHttpFetcher(undefined, 5000, () =>
        Promise.resolve([{ address: 'fd00::1', family: 6 }])
      )

      await expect(fetcher.fetch('http://ula.example/')).rejects.toBeInstanceOf(
        InvalidUrlError
      )
    })
  })

  // CIMD documents are fetched from a caller-supplied URL, and a metadata URL
  // that redirects is a misconfigured client rather than something to chase.
  it('refuses to follow redirects when asked to', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{}'),
    })

    await fetcher.fetch('https://example.com', { redirect: 'error' })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ redirect: 'error' })
    )
  })

  // Every existing caller follows redirects, each hop re-checked by the
  // dispatcher, so the option has to be absent unless it was asked for.
  it('says nothing about redirects when no option is given', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html></html>'),
    })

    await fetcher.fetch('https://example.com')

    expect(mockFetch.mock.calls[0][1]).not.toHaveProperty('redirect')
  })

  it('should use custom timeout', async () => {
    const customFetcher = new NodeHttpFetcher(mockFetch, 3000)
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html></html>'),
    })

    await customFetcher.fetch('https://example.com')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
      headers: {
        'User-Agent': 'PinSquirrel/1.0 (Bookmark Metadata Fetcher)',
      },
      signal: expect.any(AbortSignal) as AbortSignal,
      // The dispatcher is not incidental: it carries the address check that
      // runs when the connection is actually made.
      dispatcher: expect.anything() as unknown,
    })
  })

  describe('with maxBytes', () => {
    const CAP = 16 * 1024

    function streamOf(total: number) {
      const chunk = new Uint8Array(1024).fill(0x61)
      let pulled = 0
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (pulled >= total) {
            controller.close()
            return
          }
          pulled += chunk.byteLength
          controller.enqueue(chunk)
        },
      })
      return { body, pulled: () => pulled }
    }

    it('returns a body within the limit', async () => {
      const { body } = streamOf(4 * 1024)
      mockFetch.mockResolvedValue({ ok: true, headers: new Headers(), body })

      const result = await fetcher.fetch('https://example.com', {
        maxBytes: CAP,
      })

      expect(result).toBe('a'.repeat(4 * 1024))
    })

    it('stops reading a body once it passes the limit', async () => {
      const stream = streamOf(1024 * 1024)
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: stream.body,
      })

      await expect(
        fetcher.fetch('https://example.com', { maxBytes: CAP })
      ).rejects.toBeInstanceOf(ResponseTooLargeError)
      // One chunk of slack for what was in flight, nowhere near the full MiB.
      expect(stream.pulled()).toBeLessThanOrEqual(CAP + 64 * 1024)
    })

    it('refuses a declared Content-Length over the limit without reading', async () => {
      const stream = streamOf(1024 * 1024)
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'Content-Length': String(1024 * 1024) }),
        body: stream.body,
      })

      await expect(
        fetcher.fetch('https://example.com', { maxBytes: CAP })
      ).rejects.toBeInstanceOf(ResponseTooLargeError)
      expect(stream.pulled()).toBeLessThanOrEqual(1024)
    })

    // The limit is on what the body decodes to, not on what crossed the wire:
    // 8 MiB of gzip is a few KiB.
    describe('against a real server sending gzip', () => {
      const decoded = 8 * 1024 * 1024
      const gzipped = gzipSync(Buffer.alloc(decoded, 0x61))
      let server: Server
      let url: string

      // The loopback server is a private address by design; this test is about
      // decoding, so it goes around the address check.
      const unguarded = new NodeHttpFetcher(
        (target, init) =>
          undiciFetch(target, { ...init, dispatcher: undefined }),
        5000
      )

      beforeAll(async () => {
        server = createServer((_req, res) => {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip',
            'Content-Length': String(gzipped.byteLength),
          })
          res.end(gzipped)
        })
        await new Promise<void>(resolve =>
          server.listen(0, '127.0.0.1', resolve)
        )
        const { port } = server.address() as AddressInfo
        url = `http://127.0.0.1:${String(port)}/doc`
      })

      afterAll(async () => {
        await new Promise<void>(resolve => {
          server.close(() => {
            resolve()
          })
        })
      })

      it('decodes the whole body when no limit is given', async () => {
        expect((await unguarded.fetch(url)).length).toBe(decoded)
      })

      it('refuses a body that decodes past the limit', async () => {
        await expect(
          unguarded.fetch(url, { maxBytes: CAP })
        ).rejects.toBeInstanceOf(ResponseTooLargeError)
      })
    })
  })
})
