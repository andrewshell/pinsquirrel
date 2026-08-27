/** @jsxRuntime automatic @jsxImportSource hono/jsx */
// The pragma stands in for a tsconfig: tsx-run apps compile this file with
// esbuild defaults (classic React JSX) since their tsconfig scope ends at src/.
import type { FC, PropsWithChildren } from 'hono/jsx'
import { Button } from './Button.js'
import { UserIcon } from './icons.js'

interface ProfileDropdownProps {
  username: string
  class?: string
}

/** The row styling for links and submit buttons inside the menu. */
export const dropdownMenuItemClasses =
  'block w-full text-left px-4 py-2 text-sm hover:bg-accent/10 transition-colors cursor-pointer'

/**
 * The account menu in the header. The markup is the contract the apps'
 * `static/dropdown.js` listens for: a `data-dropdown="container"` wrapping a
 * `"toggle"` and a `"menu"`, where the menu is open exactly when it has lost
 * the `hidden` class it renders with. There is no inline handler — the CSP is
 * `script-src 'self'`.
 *
 * The menu body is the app's: each one has its own links and its own sign-out
 * route, and `dropdownMenuItemClasses` keeps the rows looking alike.
 */
export const ProfileDropdown: FC<PropsWithChildren<ProfileDropdownProps>> = ({
  children,
  username,
  class: className = '',
}) => {
  const classes = ['relative', className].filter(Boolean).join(' ')

  return (
    <div class={classes} data-dropdown="container">
      <Button variant="outline" data-dropdown="toggle">
        <UserIcon />
        {username}
      </Button>
      <div
        class="hidden absolute right-0 mt-2 w-48 bg-background border-4 border-foreground shadow-lg z-50"
        data-dropdown="menu"
      >
        {children}
      </div>
    </div>
  )
}
