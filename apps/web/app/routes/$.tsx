import type { Route } from './+types/$'

export function loader({ params }: Route.LoaderArgs) {
  const splat = params['*']

  // For well-known requests, return a minimal 404 response
  if (splat?.startsWith('.well-known/')) {
    return new Response(null, { status: 404 })
  }

  // For other 404s, return data for the component to render
  return { path: splat || '' }
}

export default function CatchAll({ loaderData }: Route.ComponentProps) {
  const { path } = loaderData

  // Show 404 page
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
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
