import type { FC } from 'hono/jsx'
import { BaseLayout } from '../layouts/base'

export const NotFoundPage: FC = () => {
  return (
    <BaseLayout title="404 - Not Found">
      <div class="min-h-screen flex items-center justify-center">
        <div class="text-center max-w-md px-4">
          <h1 class="text-8xl font-black text-foreground mb-4">404</h1>
          <h2 class="text-2xl font-bold text-foreground mb-4 uppercase">
            Page Not Found
          </h2>
          <p class="text-muted-foreground mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div class="space-x-4">
            <a
              href="/"
              class="inline-block px-6 py-3 bg-primary text-primary-foreground font-medium border-2 border-foreground neobrutalism-shadow
                     hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                     active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                     transition-all"
            >
              Go Home
            </a>
            <a
              href="/pins"
              class="inline-block px-6 py-3 bg-secondary text-secondary-foreground font-medium border-2 border-foreground neobrutalism-shadow
                     hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                     active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                     transition-all"
            >
              View Pins
            </a>
          </div>
        </div>
      </div>
    </BaseLayout>
  )
}
