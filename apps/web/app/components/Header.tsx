import { Form, Link } from 'react-router'
import { Button } from '~/components/ui/button'
import type { User } from '@pinsquirrel/core'

interface HeaderProps {
  user: User | null
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center space-x-2">
              <img
                src="/pinsquirrel.svg"
                alt="PinSquirrel logo"
                className="w-8 h-8"
              />
              <span className="text-xl font-bold text-gray-900">
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
                  className="text-sm text-gray-700 hover:text-gray-900"
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
