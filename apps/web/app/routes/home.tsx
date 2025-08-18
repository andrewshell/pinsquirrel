import { Link, redirect } from 'react-router'
import { Button } from '~/components/ui/button'
import { getUser } from '~/lib/session.server'
import { getUserPath } from '~/lib/auth.server'
import type { Route } from './+types/home'

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request)

  // Redirect logged-in users to their pins page
  if (user) {
    const redirectTo = getUserPath(user.username)
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect(redirectTo)
  }

  return { user }
}

export function meta(_: Route.MetaArgs) {
  return [
    {
      title: 'PinSquirrel - Hoard your links like winter is coming',
    },
    {
      name: 'description',
      content:
        "The bookmark manager for digital hoarders. Stash links, images, and articles in your tree. Because you never know when you'll need that random blog post from 2019.",
    },
  ]
}

export default function Home() {
  // No need to access user data since logged-in users are redirected

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto">
          {/* Hero Icon/Logo */}
          <div className="mb-8">
            <img
              src="/pinsquirrel.svg"
              alt="PinSquirrel logo"
              className="w-16 h-16 mx-auto"
            />
          </div>

          {/* Hero Text */}
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            PinSquirrel
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Stop pretending you&apos;ll ever organize your bookmarks. Just hoard
            them like nature intended. We&apos;re the digital tree where you can
            stash everything and actually find it again.
          </p>

          {/* Call to Action */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            {/* Since logged-in users are redirected, we only show logged out state */}
            <Button asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/signin">Sign In</Link>
            </Button>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center space-y-4 p-6">
              <div className="bg-background p-3 rounded-full w-fit mx-auto border-4 border-foreground neobrutalism-shadow">
                <img
                  src="/man_holding_boxes.svg"
                  alt="Person holding boxes illustration"
                  className="w-12 h-12"
                />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-3 text-lg uppercase tracking-tight">
                  Hoard Everything
                </h3>
                <p className="text-sm text-foreground font-medium leading-relaxed">
                  Links, images, articles, markdown - if it exists on the
                  internet, you can stash it. Because that random blog post WILL
                  disappear right when you need it.
                </p>
              </div>
            </div>

            <div className="text-center space-y-4 p-6">
              <div className="bg-background p-3 rounded-full w-fit mx-auto border-4 border-foreground neobrutalism-shadow">
                <img
                  src="/dung_beetle.svg"
                  alt="Dung beetle illustration"
                  className="w-12 h-12"
                />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-3 text-lg uppercase tracking-tight">
                  Find Your Shit
                </h3>
                <p className="text-sm text-foreground font-medium leading-relaxed">
                  Our search doesn&apos;t judge your 3am research spirals. Tag
                  it, forget it, then magically find it six months later when
                  you suddenly remember it exists.
                </p>
              </div>
            </div>

            <div className="text-center space-y-4 p-6">
              <div className="bg-background p-3 rounded-full w-fit mx-auto border-4 border-foreground neobrutalism-shadow">
                <img
                  src="/incognito.svg"
                  alt="Incognito figure illustration"
                  className="w-12 h-12"
                />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-3 text-lg uppercase tracking-tight">
                  Your Secret Stash
                </h3>
                <p className="text-sm text-foreground font-medium leading-relaxed">
                  We don&apos;t care what you&apos;re hoarding and neither does
                  anyone else. No tracking, no judging, just pure unadulterated
                  link chaos that&apos;s yours alone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
