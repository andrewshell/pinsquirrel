import type { FC } from 'hono/jsx'

export const Footer: FC = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer class="w-full bg-card border-t-4 border-foreground mt-auto">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div
          class="flex flex-col space-y-2
                    md:flex-row md:justify-between md:items-center md:space-y-0
                    text-sm text-foreground font-bold uppercase text-center
                    md:text-left"
        >
          {/* Copyright */}
          <div
            class="flex flex-col space-y-2
                      md:flex-row md:items-center md:space-y-0 md:space-x-4"
          >
            <div class="px-2 py-1">© {currentYear} Andrew Shell LLC.</div>
            <div class="px-2 py-1">All rights reserved.</div>
          </div>

          {/* Legal Links */}
          <div
            class="flex flex-col space-y-2
                      md:flex-row md:space-y-0 md:space-x-4"
          >
            <a
              href="/privacy"
              class="hover:text-primary transition-colors border-2 border-transparent hover:border-foreground px-2 py-1"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              class="hover:text-primary transition-colors border-2 border-transparent hover:border-foreground px-2 py-1"
            >
              Terms of Use
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
