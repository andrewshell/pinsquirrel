import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { isEmbedRequest, withEmbed } from './embed'

describe('isEmbedRequest', () => {
  const app = new Hono().get('/x', c => c.text(String(isEmbedRequest(c))))

  it('is on for the literal embed=1', async () => {
    expect(await (await app.request('/x?embed=1')).text()).toBe('true')
  })

  it('is off for any other value, and for no value', async () => {
    expect(await (await app.request('/x?embed=yes')).text()).toBe('false')
    expect(await (await app.request('/x?embed=')).text()).toBe('false')
    expect(await (await app.request('/x')).text()).toBe('false')
  })
})

describe('withEmbed', () => {
  it('appends embed=1 to a bare path', () => {
    expect(withEmbed('/pins', true)).toBe('/pins?embed=1')
  })

  it('joins an existing query with &', () => {
    expect(withEmbed('/signin?redirectTo=%2Fpins', true)).toBe(
      '/signin?redirectTo=%2Fpins&embed=1'
    )
  })

  it('leaves the path alone when embed is off', () => {
    expect(withEmbed('/pins', false)).toBe('/pins')
    expect(withEmbed('/pins?a=1', false)).toBe('/pins?a=1')
  })

  it('does not add the flag twice', () => {
    expect(withEmbed('/pins?embed=1', true)).toBe('/pins?embed=1')
  })
})
