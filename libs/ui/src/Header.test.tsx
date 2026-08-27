/** @jsxRuntime automatic @jsxImportSource hono/jsx */
import { describe, it, expect } from 'vitest'
import { Header, NavLink } from './Header.js'
import { render } from './test-render.js'

describe('NavLink', () => {
  it('renders an anchor with the shared nav link styling', async () => {
    const html = await render(<NavLink href="/users">Users</NavLink>)

    expect(html).toContain('href="/users"')
    expect(html).toContain('Users')
    for (const token of [
      'text-base',
      'font-bold',
      'uppercase',
      'px-4',
      'py-2',
      'border-2',
      'transition-all',
    ]) {
      expect(html).toContain(token)
    }
  })

  it('is inactive by default: transparent border, hover only', async () => {
    const html = await render(<NavLink href="/users">Users</NavLink>)

    expect(html).toContain('border-transparent')
    expect(html).toContain('hover:border-foreground')
    expect(html).not.toContain('text-primary border-foreground')
  })

  it('marks itself active when currentPath matches the href', async () => {
    const html = await render(
      <NavLink href="/users" currentPath="/users">
        Users
      </NavLink>
    )

    expect(html).toContain('text-primary')
    expect(html).not.toContain('border-transparent')
  })

  it('marks itself active for a path nested under the href', async () => {
    const html = await render(
      <NavLink href="/users" currentPath="/users/42">
        Users
      </NavLink>
    )

    expect(html).not.toContain('border-transparent')
  })

  it('does not match a sibling path that merely shares a prefix', async () => {
    const html = await render(
      <NavLink href="/users" currentPath="/users-archive">
        Users
      </NavLink>
    )

    expect(html).toContain('border-transparent')
  })

  it('takes an explicit active flag over the path comparison', async () => {
    const html = await render(
      <NavLink href="/users" currentPath="/somewhere" active>
        Users
      </NavLink>
    )

    expect(html).not.toContain('border-transparent')
  })

  it('appends a caller class', async () => {
    const html = await render(
      <NavLink href="/users" class="ml-2">
        Users
      </NavLink>
    )

    expect(html).toContain('ml-2')
  })
})

describe('Header', () => {
  it('renders the bar, the logo and the wordmark', async () => {
    const html = await render(
      <Header logoSrc="/static/pinsquirrel.svg" brand="Admin" />
    )

    expect(html).toContain('<header')
    expect(html).toContain('border-b-4')
    expect(html).toContain('border-foreground')
    expect(html).toContain('h-20')
    expect(html).toContain('src="/static/pinsquirrel.svg"')
    expect(html).toContain('alt="PinSquirrel logo"')
    expect(html).toContain('Admin')
    expect(html).toContain('font-black')
  })

  it('links the brand at / by default and at brandHref when given', async () => {
    const fallback = await render(<Header logoSrc="/logo.svg" brand="Admin" />)
    expect(fallback).toContain('href="/"')

    const custom = await render(
      <Header logoSrc="/logo.svg" brand="Admin" brandHref="/users" />
    )
    expect(custom).toContain('href="/users"')
  })

  it('takes a logo alt text', async () => {
    const html = await render(
      <Header logoSrc="/logo.svg" brand="Admin" logoAlt="Console logo" />
    )

    expect(html).toContain('alt="Console logo"')
  })

  it('renders nav links inside a <nav>', async () => {
    const html = await render(
      <Header
        logoSrc="/logo.svg"
        brand="Admin"
        nav={<NavLink href="/users">Users</NavLink>}
      />
    )

    expect(html).toMatch(/<nav[^>]*>.*href="\/users".*<\/nav>/s)
  })

  it('omits the <nav> when there are no links', async () => {
    const html = await render(<Header logoSrc="/logo.svg" brand="Admin" />)

    expect(html).not.toContain('<nav')
  })

  it('renders the actions slot on the right', async () => {
    const html = await render(
      <Header
        logoSrc="/logo.svg"
        brand="Admin"
        actions={<span data-test="actions">hi</span>}
      />
    )

    expect(html).toContain('data-test="actions"')
  })

  it('appends a caller class to the header element', async () => {
    const html = await render(
      <Header logoSrc="/logo.svg" brand="Admin" class="sticky top-0" />
    )

    expect(html).toMatch(/<header class="[^"]*sticky top-0/)
  })
})
