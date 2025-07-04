import { Link, Form } from 'react-router';
import { Button } from '~/components/ui/button';
import type { AuthenticatedUser } from '~/lib/auth-utils';

interface HeaderProps {
  user?: AuthenticatedUser | null;
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="text-xl font-bold text-gray-900 hover:text-gray-700"
        >
          PinSquirrel
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Button variant="outline" asChild>
                <Link to="/links">Add Link</Link>
              </Button>
              <Form method="post" action="/links">
                <input type="hidden" name="intent" value="logout" />
                <Button type="submit" variant="ghost">
                  Logout
                </Button>
              </Form>
            </>
          ) : (
            <>
              <Button variant="outline" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
