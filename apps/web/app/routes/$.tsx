import type { Route } from './+types/$'

export function meta(_: Route.MetaArgs) {
  return [
    {
      title: '404 - Page Not Found - PinSquirrel',
    },
    {
      name: 'description',
      content: 'The page you are looking for could not be found.',
    },
  ]
}

export function loader({ params }: Route.LoaderArgs) {
  const path = params['*'] || ''
  return Response.json({ path }, { status: 404 })
}

export default function CatchAll({ loaderData }: Route.ComponentProps) {
  const { path } = loaderData

  // Show 404 page
  return (
    <div className="bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
        <p className="text-muted-foreground mb-4">Page not found</p>
        {path && (
          <p className="text-sm text-muted-foreground mb-8 font-mono">
            &quot;{path}&quot; does not exist
          </p>
        )}
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Go Home
        </a>
      </div>
    </div>
  )
}
