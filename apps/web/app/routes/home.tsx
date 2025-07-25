import { Link, redirect } from 'react-router'
import type { Route } from './+types/home'
import { getUser } from '~/lib/session.server'
import { Button } from '~/components/ui/button'

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request)
  
  // Redirect logged-in users to pins page
  if (user) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect('/pins')
  }
  
  return { user }
}

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'PinSquirrel Boilerplate' },
    { name: 'description', content: 'A sensible start to a new project' },
  ]
}

export default function Home() {
  // No need to access user data since logged-in users are redirected

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto">
          {/* Hero Icon/Logo */}
          <div className="mb-8">
            <div className="w-16 h-16 mx-auto bg-muted rounded-lg flex items-center justify-center">
              <span className="text-2xl">🐿️</span>
            </div>
          </div>

          {/* Hero Text */}
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            PinSquirrel Boilerplate
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            A sensible start to a new project
          </p>

          {/* Call to Action */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            {/* Since logged-in users are redirected, we only show logged out state */}
            <Button asChild>
              <Link to="/register">Get Started</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-muted rounded-md flex items-center justify-center">
                <span className="text-xl">🚀</span>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-2">
                  Ready to Go
                </h3>
                <p className="text-sm text-muted-foreground">
                  Complete authentication system with secure sessions and user
                  management
                </p>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-muted rounded-md flex items-center justify-center">
                <span className="text-xl">🔒</span>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-2">Secure</h3>
                <p className="text-sm text-muted-foreground">
                  HTTP-only cookies, server-side sessions, and proper security
                  practices
                </p>
              </div>
            </div>

            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto bg-muted rounded-md flex items-center justify-center">
                <span className="text-xl">⚡</span>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-2">
                  Modern Stack
                </h3>
                <p className="text-sm text-muted-foreground">
                  React Router 7, TypeScript, Tailwind CSS, and PostgreSQL
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
