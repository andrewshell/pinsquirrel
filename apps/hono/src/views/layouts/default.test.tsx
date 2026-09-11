import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { DefaultLayout } from './default'
import { EmbedLayout } from './embed'

async function render(page: unknown): Promise<string> {
  const app = new Hono().get('/', c => c.html(page as never))
  const res = await app.request('/')
  return res.text()
}

describe('DefaultLayout', () => {
  it('renders the header and footer by default', async () => {
    const html = await render(
      <DefaultLayout title="Page" user={null}>
        <p>body</p>
      </DefaultLayout>
    )
    expect(html).toContain('<header')
    expect(html).toContain('<footer')
    expect(html).toContain('<p>body</p>')
  })

  it('drops the header, nav and footer in embed mode', async () => {
    const html = await render(
      <DefaultLayout title="Page" user={null} embed>
        <p>body</p>
      </DefaultLayout>
    )
    expect(html).not.toContain('<header')
    expect(html).not.toContain('<nav')
    expect(html).not.toContain('<footer')
    expect(html).toContain('<p>body</p>')
  })

  it('uses the form width in embed mode whatever width was asked for', async () => {
    const html = await render(
      <DefaultLayout title="Page" user={null} width="wide" embed>
        <p>body</p>
      </DefaultLayout>
    )
    expect(html).toContain('max-w-2xl')
    expect(html).not.toContain('max-w-7xl')
  })

  it('keeps the private-mode class in embed mode', async () => {
    const html = await render(
      <DefaultLayout title="Page" user={null} embed privateMode>
        <p>body</p>
      </DefaultLayout>
    )
    expect(html).toContain('class="private-mode"')
  })
})

describe('EmbedLayout', () => {
  it('is DefaultLayout in embed mode', async () => {
    const viaEmbed = await render(
      <EmbedLayout title="Page">
        <p>body</p>
      </EmbedLayout>
    )
    const viaDefault = await render(
      <DefaultLayout title="Page" user={null} embed>
        <p>body</p>
      </DefaultLayout>
    )
    expect(viaEmbed).toBe(viaDefault)
  })
})
