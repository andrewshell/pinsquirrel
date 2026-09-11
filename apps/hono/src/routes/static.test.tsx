/**
 * The public pages and the style guide, which have no state of their own: the
 * one thing to pin down is that they honour embed like every other page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

vi.mock('../middleware/session', () => ({
  getSessionManager: () => ({
    getUser: () => Promise.resolve(null),
  }),
}))

const { staticRoutes } = await import('./static')
const { styleRoutes } = await import('./style')

describe('public pages', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', staticRoutes)
    app.route('/', styleRoutes)
  })

  it.each([
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Use'],
    ['/style', 'Style Guide'],
  ])('renders %s with the chrome by default', async (path, title) => {
    const html = await (await app.request(path)).text()

    expect(html).toContain(title)
    expect(html).toContain('<header')
    expect(html).toContain('<footer')
  })

  it.each([
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Use'],
    ['/style', 'Style Guide'],
  ])('renders %s without the chrome for ?embed=1', async (path, title) => {
    const html = await (await app.request(`${path}?embed=1`)).text()

    expect(html).toContain(title)
    expect(html).not.toContain('<header')
    expect(html).not.toContain('<footer')
  })
})
