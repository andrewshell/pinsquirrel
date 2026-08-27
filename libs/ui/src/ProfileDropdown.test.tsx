/** @jsxRuntime automatic @jsxImportSource hono/jsx */
import { describe, it, expect } from 'vitest'
import { ProfileDropdown, dropdownMenuItemClasses } from './ProfileDropdown.js'
import { render } from './test-render.js'

describe('ProfileDropdown', () => {
  it('wires the container/toggle/menu contract static/dropdown.js listens for', async () => {
    const html = await render(
      <ProfileDropdown username="ada">
        <a href="/profile">Profile</a>
      </ProfileDropdown>
    )

    expect(html).toContain('data-dropdown="container"')
    expect(html).toContain('data-dropdown="toggle"')
    expect(html).toContain('data-dropdown="menu"')
    // The toggle has to be inside the container for `closest()` to find it.
    expect(html).toMatch(
      /data-dropdown="container".*data-dropdown="toggle".*data-dropdown="menu"/s
    )
  })

  it('renders the menu closed — hidden is the only open/closed state', async () => {
    const html = await render(
      <ProfileDropdown username="ada">
        <a href="/profile">Profile</a>
      </ProfileDropdown>
    )

    expect(html).toMatch(
      /class="hidden absolute right-0 mt-2 w-48 bg-background border-4 border-foreground shadow-lg z-50"/
    )
  })

  it('renders the username and the user icon in an outline button toggle', async () => {
    const html = await render(
      <ProfileDropdown username="ada">
        <a href="/profile">Profile</a>
      </ProfileDropdown>
    )

    expect(html).toContain('ada')
    expect(html).toContain('<svg')
    expect(html).toContain('bg-background text-foreground')
    expect(html).toContain('<button')
    expect(html).not.toContain('onclick')
  })

  it('positions the toggle relative to the container', async () => {
    const html = await render(
      <ProfileDropdown username="ada">x</ProfileDropdown>
    )

    expect(html).toMatch(/class="relative"[^>]*data-dropdown="container"/)
  })

  it('renders the menu body the app supplies', async () => {
    const html = await render(
      <ProfileDropdown username="ada">
        <a href="/users" class={dropdownMenuItemClasses}>
          Users
        </a>
        <hr class="border-foreground/20" />
        <form method="post" action="/logout">
          <button type="submit" class={dropdownMenuItemClasses}>
            Sign Out
          </button>
        </form>
      </ProfileDropdown>
    )

    expect(html).toMatch(/data-dropdown="menu"[^>]*>.*href="\/users"/s)
    expect(html).toContain('<hr')
    expect(html).toContain('action="/logout"')
    expect(html).toContain('Sign Out')
  })

  it('appends a caller class to the container', async () => {
    const html = await render(
      <ProfileDropdown username="ada" class="ml-2">
        x
      </ProfileDropdown>
    )

    expect(html).toMatch(/class="relative ml-2"/)
  })
})

describe('dropdownMenuItemClasses', () => {
  it('is the shared menu row styling from the design system', () => {
    expect(dropdownMenuItemClasses).toContain('block')
    expect(dropdownMenuItemClasses).toContain('px-4')
    expect(dropdownMenuItemClasses).toContain('py-2')
    expect(dropdownMenuItemClasses).toContain('text-sm')
    expect(dropdownMenuItemClasses).toContain('hover:bg-accent/10')
  })
})
