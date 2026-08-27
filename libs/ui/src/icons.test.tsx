/** @jsxRuntime automatic @jsxImportSource hono/jsx */
import { describe, it, expect } from 'vitest'
import { UserIcon } from './icons.js'
import { render } from './test-render.js'

describe('UserIcon', () => {
  it('renders a 24-viewBox stroke svg sized 16 by default', async () => {
    const html = await render(<UserIcon />)

    expect(html).toContain('<svg')
    expect(html).toContain('viewBox="0 0 24 24"')
    expect(html).toContain('width="16"')
    expect(html).toContain('height="16"')
    expect(html).toContain('stroke="currentColor"')
  })

  it('renders the user glyph paths', async () => {
    const html = await render(<UserIcon />)

    expect(html).toContain('<circle cx="12" cy="12" r="10"')
    expect(html).toContain('<circle cx="12" cy="10" r="3"')
  })

  it('takes a size and passes a class through to the svg', async () => {
    const html = await render(<UserIcon size={20} class="text-primary" />)

    expect(html).toContain('width="20"')
    expect(html).toContain('height="20"')
    expect(html).toContain('class="text-primary"')
  })
})
