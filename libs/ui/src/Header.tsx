/** @jsxRuntime automatic @jsxImportSource hono/jsx */
// The pragma stands in for a tsconfig: tsx-run apps compile this file with
// esbuild defaults (classic React JSX) since their tsconfig scope ends at src/.
import type { Child, FC, PropsWithChildren } from 'hono/jsx'

interface NavLinkProps {
  href: string
  /** The request path, so a link can decide for itself whether it is current. */
  currentPath?: string
  /** Overrides the `currentPath` comparison when an app knows better. */
  active?: boolean
  class?: string
}

interface HeaderProps {
  logoSrc: string
  /** The wordmark next to the logo — "PinSquirrel", "Admin", … */
  brand: string
  logoAlt?: string
  brandHref?: string
  /** Nav links, rendered in a `<nav>`; typically `<NavLink>` elements. */
  nav?: Child
  /** The right-hand side — a profile dropdown, buttons, whatever the app has. */
  actions?: Child
  class?: string
}

// The active and inactive states set the same properties, so they are split
// rather than layered: two Tailwind border-colour classes on one element leave
// the winner up to stylesheet order.
//
// Active is the filled "selected" treatment rather than the hover look — a
// current link that borrows hover's colours reads as a link under the cursor,
// and carries no hover of its own so it does not shift once you reach it.
const navLinkBaseClasses =
  'text-base font-bold uppercase px-4 py-2 border-2 transition-all'
const navLinkInactiveClasses =
  'text-foreground hover:text-primary border-transparent hover:border-foreground'
const navLinkActiveClasses =
  'bg-primary text-primary-foreground border-foreground'

/**
 * A link is current when the path is the link's own or sits under it, so
 * `/users` stays lit on `/users/42` without lighting up on `/users-archive`.
 */
function isCurrent(href: string, currentPath: string | undefined): boolean {
  if (currentPath === undefined) return false
  return currentPath === href || currentPath.startsWith(`${href}/`)
}

export const NavLink: FC<PropsWithChildren<NavLinkProps>> = ({
  children,
  href,
  currentPath,
  active,
  class: className = '',
}) => {
  const isActive = active ?? isCurrent(href, currentPath)
  const classes = [
    navLinkBaseClasses,
    isActive ? navLinkActiveClasses : navLinkInactiveClasses,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <a href={href} class={classes} aria-current={isActive ? 'page' : undefined}>
      {children}
    </a>
  )
}

export const Header: FC<HeaderProps> = ({
  logoSrc,
  brand,
  logoAlt = 'PinSquirrel logo',
  brandHref = '/',
  nav,
  actions,
  class: className = '',
}) => {
  const classes = [
    'w-full bg-background border-b-4 border-foreground',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <header class={classes}>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-20">
          <div class="flex-shrink-0">
            <a href={brandHref} class="flex items-center space-x-2">
              <img src={logoSrc} alt={logoAlt} class="w-10 h-10" />
              <span class="text-2xl font-black text-foreground uppercase tracking-tight">
                {brand}
              </span>
            </a>
          </div>

          <div class="flex items-center space-x-2 sm:space-x-4">
            {nav ? (
              <nav class="flex items-center space-x-2 sm:space-x-4">{nav}</nav>
            ) : (
              ''
            )}
            {actions}
          </div>
        </div>
      </div>
    </header>
  )
}
