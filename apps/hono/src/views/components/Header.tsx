import type { User } from '@pinsquirrel/domain'
import type { FC } from 'hono/jsx'
import { Button } from './ui/Button'

interface HeaderProps {
  user: User | null
  currentPath?: string
}

export const Header: FC<HeaderProps> = ({ user, currentPath = '' }) => {
  return (
    <header class="w-full bg-background border-b-4 border-foreground">
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
                  <a
                    href="/pins"
                    class="text-base font-bold text-foreground hover:text-accent uppercase px-4 py-2 border-2 border-transparent hover:border-foreground transition-all"
                  >
                    Pins
                  </a>
                  <a
                    href="/tags"
                    class="text-base font-bold text-foreground hover:text-accent uppercase px-4 py-2 border-2 border-transparent hover:border-foreground transition-all"
                  >
                    Tags
                  </a>
                </div>

                {/* Search input - visible when toggled */}
                <form
                  action="/pins"
                  method="get"
                  class="hidden items-center gap-2"
                  data-search="form"
                >
                  <input
                    type="text"
                    name="search"
                    placeholder="Search pins..."
                    class="w-64 px-3 py-2 text-sm border-4 border-foreground bg-background focus:outline-none focus:ring-2 focus:ring-accent"
                    data-search="input"
                  />
                  <button
                    type="submit"
                    class="px-3 py-2 bg-primary text-primary-foreground font-medium border-4 border-foreground neobrutalism-shadow
                           hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                           active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                           transition-all"
                    aria-label="Search"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </button>
                </form>

                {/* Search toggle - shows magnifying glass when closed, X when open */}
                <button
                  type="button"
                  class="p-2 text-foreground hover:text-accent transition-colors"
                  aria-label="Toggle search"
                  data-search="toggle"
                >
                  {/* Magnifying glass icon - visible when search is closed */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    data-search="icon-open"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  {/* X icon - visible when search is open */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="hidden"
                    data-search="icon-close"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>

                {/* Create Pin Button */}
                <a
                  href="/pins/new"
                  class="px-3 py-2 bg-primary text-primary-foreground font-medium border-4 border-foreground neobrutalism-shadow
                         hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                         active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                         transition-all"
                  aria-label="Create Pin"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                  </svg>
                </a>

                {/* User Dropdown */}
                <div class="relative" data-dropdown="container">
                  <Button variant="outline" size="sm" data-dropdown="toggle">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="10" r="3" />
                      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
                    </svg>
                    {user.username}
                  </Button>
                  <div
                    class="hidden absolute right-0 mt-2 w-48 bg-background border-4 border-foreground shadow-lg z-50"
                    data-dropdown="menu"
                  >
                    <a
                      href="/profile"
                      class="block px-4 py-2 text-sm hover:bg-accent/10 transition-colors"
                    >
                      Profile
                    </a>
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
              <a
                href="/pins/new"
                class="px-3 py-2 bg-primary text-primary-foreground font-medium border-4 border-foreground neobrutalism-shadow
                       hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                       active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                       transition-all"
                aria-label="Create Pin"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </a>
            )}
            <div data-dropdown="container">
              <button
                type="button"
                class="p-2 text-foreground hover:bg-accent/10 transition-colors"
                data-dropdown="toggle"
                aria-label="Toggle menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
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
                      <form
                        action="/pins"
                        method="get"
                        class="flex items-center gap-2 mb-4"
                      >
                        <input
                          type="text"
                          name="search"
                          placeholder="Search pins..."
                          class="flex-1 px-3 py-2 text-sm border-4 border-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          type="submit"
                          class="px-3 py-2 bg-primary text-primary-foreground border-4 border-foreground"
                          aria-label="Search"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                          </svg>
                        </button>
                      </form>

                      <a
                        href="/pins"
                        class="block px-4 py-2 text-center font-bold uppercase hover:bg-accent/10 transition-colors"
                      >
                        Pins
                      </a>
                      <a
                        href="/tags"
                        class="block px-4 py-2 text-center font-bold uppercase hover:bg-accent/10 transition-colors"
                      >
                        Tags
                      </a>
                      <a
                        href="/profile"
                        class="block px-4 py-2 text-center font-bold uppercase hover:bg-accent/10 transition-colors"
                      >
                        {user.username}
                      </a>
                      <a
                        href="/import"
                        class="block px-4 py-2 text-center font-bold uppercase hover:bg-accent/10 transition-colors"
                      >
                        Import
                      </a>
                      <hr class="border-foreground/20" />
                      <Button href="/signout" variant="outline" class="w-full">
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <>
                      <a
                        href="/signin"
                        class="block px-4 py-2 text-center font-medium border-4 border-foreground hover:bg-accent/10 transition-colors"
                      >
                        Sign In
                      </a>
                      <a
                        href="/signup"
                        class="block px-4 py-2 text-center font-medium bg-primary text-primary-foreground border-4 border-foreground"
                      >
                        Sign Up
                      </a>
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
