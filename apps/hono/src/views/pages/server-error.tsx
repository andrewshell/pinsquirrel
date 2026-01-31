import type { FC } from 'hono/jsx'
import { BaseLayout } from '../layouts/base'

interface ServerErrorPageProps {
  message?: string
}

export const ServerErrorPage: FC<ServerErrorPageProps> = ({
  message = 'Something went wrong on our end.',
}) => {
  return (
    <BaseLayout title="500 - Server Error">
      <div class="min-h-screen flex items-center justify-center">
        <div class="text-center max-w-md px-4">
          <h1 class="text-8xl font-black text-foreground mb-4">500</h1>
          <h2 class="text-2xl font-bold text-foreground mb-4 uppercase">
            Server Error
          </h2>
          <p class="text-muted-foreground mb-8">{message}</p>
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
            <button
              type="button"
              onclick="window.location.reload()"
              class="inline-block px-6 py-3 bg-secondary text-secondary-foreground font-medium border-2 border-foreground neobrutalism-shadow
                     hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                     active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                     transition-all cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    </BaseLayout>
  )
}
