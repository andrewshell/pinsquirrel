import type { User } from '@pinsquirrel/core'
import { CircleUserRound, Menu, X } from 'lucide-react'
import { useState } from 'react'
import {
  Form,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { SearchIcon } from '~/components/search/SearchIcon'
import { SearchInput } from '~/components/search/SearchInput'

interface HeaderProps {
  user: User | null
}

export function Header({ user }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const currentSearch = searchParams.get('search') || ''

  const handleSearchToggle = () => {
    setIsSearchVisible(!isSearchVisible)
  }

  const handleSearch = (query: string) => {
    if (!user) return

    // Preserve existing search params (like tag and unread filters)
    const params = new URLSearchParams(location.search)

    if (query.trim()) {
      params.set('search', query.trim())
    } else {
      // If search is empty, remove the search param
      params.delete('search')
    }

    // Navigate to user's pins page with updated search parameter
    const searchString = params.toString()
    const url = `/${user.username}/pins${searchString ? `?${searchString}` : ''}`
    void navigate(url)
    setIsSearchVisible(false)
  }

  const handleSearchClose = () => {
    setIsSearchVisible(false)
  }

  return (
    <header className="w-full bg-background border-b-4 border-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo/Brand */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center space-x-2">
              <img
                src="/pinsquirrel.svg"
                alt="PinSquirrel logo"
                className="w-10 h-10"
              />
              <span className="text-2xl font-black text-foreground uppercase tracking-tight">
                PinSquirrel
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            {user ? (
              // Logged in state
              <div className="flex items-center space-x-4">
                {!isSearchVisible && (
                  <>
                    <Link
                      to={`/${user.username}/pins`}
                      className="text-base font-bold text-foreground hover:text-accent uppercase px-4 py-2 border-2 border-transparent hover:border-foreground transition-all"
                    >
                      Pins
                    </Link>
                    <Link
                      to={`/${user.username}/tags`}
                      className="text-base font-bold text-foreground hover:text-accent uppercase px-4 py-2 border-2 border-transparent hover:border-foreground transition-all"
                    >
                      Tags
                    </Link>
                  </>
                )}
                <div className="flex items-center space-x-2">
                  <SearchInput
                    isVisible={isSearchVisible}
                    onSearch={handleSearch}
                    onClose={handleSearchClose}
                    initialValue={currentSearch}
                  />
                  <SearchIcon
                    onClick={handleSearchToggle}
                    isSearchVisible={isSearchVisible}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <CircleUserRound className="h-4 w-4" />
                      {user.username}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to="/profile">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Form method="post" action="/logout">
                        <button type="submit" className="w-full text-left">
                          Sign Out
                        </button>
                      </Form>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              // Logged out state
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/signin">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground hover:bg-accent rounded-md transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t-4 border-foreground bg-background">
          <div className="px-4 py-4 space-y-3">
            {user ? (
              // Logged in mobile menu
              <div className="space-y-2">
                <SearchInput
                  isVisible={true}
                  onSearch={query => {
                    handleSearch(query)
                    setIsMobileMenuOpen(false)
                  }}
                  onClose={() => setIsMobileMenuOpen(false)}
                  initialValue={currentSearch}
                  fullWidth={true}
                />
                <Button variant="ghost" className="w-full" asChild>
                  <Link
                    to={`/${user.username}/pins`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Pins
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full" asChild>
                  <Link
                    to={`/${user.username}/tags`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Tags
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full" asChild>
                  <Link
                    to="/profile"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {user.username}
                  </Link>
                </Button>
                <Form method="post" action="/logout">
                  <Button
                    variant="outline"
                    className="w-full"
                    type="submit"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign Out
                  </Button>
                </Form>
              </div>
            ) : (
              // Logged out mobile menu
              <div className="space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/signin" onClick={() => setIsMobileMenuOpen(false)}>
                    Sign In
                  </Link>
                </Button>
                <Button className="w-full" asChild>
                  <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                    Sign Up
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
