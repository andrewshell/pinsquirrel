import type { User } from '@pinsquirrel/core'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Form, Link } from 'react-router'
import { Button } from '~/components/ui/button'

interface HeaderProps {
  user: User | null
}

export function Header({ user }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
          <nav className="hidden sm:flex items-center space-x-4">
            {user ? (
              // Logged in state
              <div className="flex items-center space-x-4">
                <Link
                  to={`/${user.username}/pins`}
                  className="text-base font-bold text-foreground hover:text-accent uppercase px-4 py-2 border-2 border-transparent hover:border-foreground transition-all"
                >
                  My Pins
                </Link>
                <Link
                  to="/profile"
                  className="text-base font-bold text-foreground hover:text-accent uppercase px-4 py-2 border-2 border-transparent hover:border-foreground transition-all"
                >
                  {user.username}
                </Link>
                <Form method="post" action="/logout">
                  <Button variant="outline" size="sm" type="submit">
                    Sign Out
                  </Button>
                </Form>
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
            className="sm:hidden p-2 text-foreground hover:bg-accent rounded-md transition-colors"
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
        <div className="sm:hidden border-t-4 border-foreground bg-background">
          <div className="px-4 py-4 space-y-3">
            {user ? (
              // Logged in mobile menu
              <div className="space-y-2">
                <Button variant="ghost" className="w-full" asChild>
                  <Link
                    to={`/${user.username}/pins`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    My Pins
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
