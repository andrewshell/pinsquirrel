import type { User } from '@pinsquirrel/domain'
import type { FC } from 'hono/jsx'
import {
  CloseIcon,
  LockIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from './icons'
import { Button } from './ui/Button'

interface HeaderProps {
  user: User | null
  currentPath?: string
  privateMode?: boolean
}

/**
 * The header renders the same navigation twice — once for the desktop bar and
 * once inside the mobile menu panel — so the link list, the account list and
 * the search form each live in one component that takes a `layout`.
 */
type Layout = 'desktop' | 'mobile'

type HtmxAttrs = Record<string, string>

const linkClass: Record<Layout, string> = {
  desktop:
    'text-base font-bold text-foreground hover:text-primary uppercase px-4 py-2 border-2 border-transparent hover:border-foreground transition-all',
  mobile:
    'block px-4 py-2 text-center font-bold uppercase hover:bg-accent/10 transition-colors',
}

const accountLinkClass: Record<Layout, string> = {
  desktop: 'block px-4 py-2 text-sm hover:bg-accent/10 transition-colors',
  mobile:
    'block px-4 py-2 text-center font-bold uppercase hover:bg-accent/10 transition-colors',
}

const NavLinks: FC<{
  layout: Layout
  pinsBase: string
  privateMode: boolean
}> = ({ layout, pinsBase, privateMode }) => (
  <>
    <a href={pinsBase} class={linkClass[layout]}>
      {privateMode ? 'Private' : 'Pins'}
    </a>
    <a href="/tags" class={linkClass[layout]}>
      Tags
    </a>
  </>
)

const AccountLinks: FC<{ layout: Layout; username: string }> = ({
  layout,
  username,
}) => (
  <>
    <a href="/profile" class={accountLinkClass[layout]}>
      {layout === 'mobile' ? username : 'Profile'}
    </a>
    <a href="/import" class={accountLinkClass[layout]}>
      Import
    </a>
    <a href="/private/unlock" class={accountLinkClass[layout]}>
      Private Pins
    </a>
  </>
)

const SearchForm: FC<{
  layout: Layout
  pinsBase: string
  htmxAttrs: HtmxAttrs
}> = ({ layout, pinsBase, htmxAttrs }) =>
  layout === 'desktop' ? (
    <form
      action={pinsBase}
      method="get"
      class="hidden items-center gap-2"
      data-search="form"
      {...htmxAttrs}
    >
      <input
        type="text"
        name="search"
        placeholder="Search pins..."
        class="w-64 px-3 py-2 text-sm border-4 border-foreground bg-background focus:outline-none focus:ring-2 focus:ring-accent"
        data-search="input"
      />
      <Button type="submit" size="icon" aria-label="Search">
        <SearchIcon />
      </Button>
    </form>
  ) : (
    <form
      action={pinsBase}
      method="get"
      class="flex items-center gap-2 mb-4"
      {...htmxAttrs}
    >
      <input
        type="text"
        name="search"
        placeholder="Search pins..."
        class="flex-1 px-3 py-2 text-sm border-4 border-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <Button type="submit" size="icon" aria-label="Search">
        <SearchIcon size={20} />
      </Button>
    </form>
  )

export const Header: FC<HeaderProps> = ({
  user,
  currentPath,
  privateMode = false,
}) => {
  const pinsBase = privateMode ? '/private/pins' : '/pins'
  const htmxAttrs: HtmxAttrs =
    currentPath === pinsBase
      ? {
          'hx-get': pinsBase,
          'hx-target': '#pins-content',
          'hx-swap': 'innerHTML',
          'hx-push-url': 'true',
        }
      : {}
  return (
    <header class="w-full bg-background border-b-4 border-foreground">
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              [data-search="form"] { display: flex !important; }
              [data-search="toggle"] { display: none !important; }
              [data-nav="links"] { display: none !important; }
            `,
          }}
        />
      </noscript>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-20">
          {/* Logo/Brand */}
          <div class="flex-shrink-0">
            <a href="/" class="flex items-center space-x-2">
              <img
                src="/static/pinsquirrel.svg"
                alt="PinSquirrel logo"
                class="w-10 h-10"
              />
              <span class="text-2xl font-black text-foreground uppercase tracking-tight">
                PinSquirrel
              </span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav class="hidden md:flex items-center space-x-4">
            {user ? (
              <div class="flex items-center space-x-4">
                {/* Nav links - hidden when search is open */}
                <div class="flex items-center space-x-4" data-nav="links">
                  <NavLinks
                    layout="desktop"
                    pinsBase={pinsBase}
                    privateMode={privateMode}
                  />
                </div>

                {/* Search input - visible when toggled */}
                <SearchForm
                  layout="desktop"
                  pinsBase={pinsBase}
                  htmxAttrs={htmxAttrs}
                />

                {/* Search toggle - shows magnifying glass when closed, X when open */}
                <button
                  type="button"
                  class="p-2 text-foreground hover:text-primary transition-colors cursor-pointer"
                  aria-label="Toggle search"
                  data-search="toggle"
                >
                  {/* Magnifying glass icon - visible when search is closed */}
                  <SearchIcon size={20} data-search="icon-open" />
                  {/* X icon - visible when search is open */}
                  <CloseIcon
                    size={20}
                    class="hidden"
                    data-search="icon-close"
                  />
                </button>

                {/* Create Pin Button */}
                <Button
                  href={`${pinsBase}/new`}
                  size="icon"
                  aria-label="Create Pin"
                >
                  <PlusIcon />
                </Button>

                {/* Lock button - only in private mode */}
                {privateMode && (
                  <form method="post" action="/private/lock">
                    <Button
                      type="submit"
                      variant="outline"
                      size="icon"
                      aria-label="Lock private pins"
                    >
                      <LockIcon />
                    </Button>
                  </form>
                )}

                {/* User Dropdown */}
                <div class="relative" data-dropdown="container">
                  <Button variant="outline" data-dropdown="toggle">
                    <UserIcon />
                    {user.username}
                  </Button>
                  <div
                    class="hidden absolute right-0 mt-2 w-48 bg-background border-4 border-foreground shadow-lg z-50"
                    data-dropdown="menu"
                  >
                    <AccountLinks layout="desktop" username={user.username} />
                    <hr class="border-foreground/20" />
                    <a
                      href="/signout"
                      class="block px-4 py-2 text-sm hover:bg-accent/10 transition-colors"
                    >
                      Sign Out
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div class="flex items-center space-x-2">
                <Button href="/signin" variant="outline" size="sm">
                  Sign In
                </Button>
                <Button href="/signup" size="sm">
                  Sign Up
                </Button>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div class="md:hidden flex items-center space-x-2">
            {user && (
              <Button
                href={`${pinsBase}/new`}
                size="icon"
                aria-label="Create Pin"
              >
                <PlusIcon />
              </Button>
            )}
            <div data-dropdown="container">
              <button
                type="button"
                class="p-2 text-foreground hover:bg-accent/10 transition-colors cursor-pointer"
                data-dropdown="toggle"
                aria-label="Toggle menu"
              >
                <MenuIcon size={24} />
              </button>

              {/* Mobile Menu Panel */}
              <div
                class="hidden absolute top-20 left-0 right-0 bg-background border-b-4 border-foreground z-50"
                data-dropdown="menu"
              >
                <div class="px-4 py-4 space-y-2">
                  {user ? (
                    <>
                      {/* Mobile Search */}
                      <SearchForm
                        layout="mobile"
                        pinsBase={pinsBase}
                        htmxAttrs={htmxAttrs}
                      />

                      <NavLinks
                        layout="mobile"
                        pinsBase={pinsBase}
                        privateMode={privateMode}
                      />
                      <AccountLinks layout="mobile" username={user.username} />
                      <hr class="border-foreground/20" />
                      <Button href="/signout" variant="outline" class="w-full">
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button href="/signin" variant="outline" class="w-full">
                        Sign In
                      </Button>
                      <Button href="/signup" class="w-full">
                        Sign Up
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
