import { Form, Link } from 'react-router'
import { Button } from '~/components/ui/button'
import type { User } from '@pinsquirrel/core'

interface HeaderProps {
  user: User | null
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-background border-b-8 border-foreground neobrutalism-shadow">
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

          {/* Navigation */}
          <nav className="flex items-center space-x-4">
            {user ? (
              // Logged in state
              <div className="flex items-center space-x-4">
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
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/signin">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
