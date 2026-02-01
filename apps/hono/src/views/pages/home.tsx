import type { FC } from 'hono/jsx'

export const HomePage: FC = () => {
  return (
    <div class="container mx-auto px-4 py-16">
      {/* Hero Section */}
      <div class="text-center max-w-4xl mx-auto">
        {/* Hero Icon/Logo */}
        <div class="mb-8">
          <img
            src="/static/pinsquirrel.svg"
            alt="PinSquirrel logo"
            class="w-16 h-16 mx-auto"
          />
        </div>

        {/* Hero Text */}
        <h1
          class="text-4xl font-bold text-foreground mb-4
                   md:text-5xl"
        >
          PinSquirrel
        </h1>

        <p
          class="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto
                  md:text-xl"
        >
          Stop pretending you'll ever organize your bookmarks. Just hoard them
          like nature intended. We're the digital tree where you can stash
          everything and actually find it again.
        </p>

        {/* Call to Action */}
        <div
          class="flex flex-col gap-4 justify-center items-center mb-20
                    sm:flex-row"
        >
          <a
            href="/signup"
            class="inline-block px-6 py-3 bg-primary text-primary-foreground font-bold uppercase border-2 border-foreground neobrutalism-shadow
                   hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                   active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                   transition-all"
          >
            Get Started
          </a>
          <a
            href="/signin"
            class="inline-block px-6 py-3 bg-background text-foreground font-bold uppercase border-2 border-foreground neobrutalism-shadow
                   hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                   active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                   transition-all"
          >
            Sign In
          </a>
        </div>

        {/* Features */}
        <div
          class="grid gap-8 max-w-4xl mx-auto
                    md:grid-cols-3"
        >
          <div class="text-center space-y-4 p-6">
            <div class="bg-background p-3 rounded-full w-fit mx-auto border-4 border-foreground neobrutalism-shadow">
              <img
                src="/static/man_holding_boxes.svg"
                alt="Person holding boxes illustration"
                class="w-12 h-12"
              />
            </div>
            <div>
              <h3 class="font-bold text-foreground mb-3 text-lg uppercase tracking-tight">
                Hoard Everything
              </h3>
              <p class="text-sm text-foreground font-medium leading-relaxed">
                Links, images, articles, markdown - if it exists on the
                internet, you can stash it. Because that random blog post WILL
                disappear right when you need it.
              </p>
            </div>
          </div>

          <div class="text-center space-y-4 p-6">
            <div class="bg-background p-3 rounded-full w-fit mx-auto border-4 border-foreground neobrutalism-shadow">
              <img
                src="/static/dung_beetle.svg"
                alt="Dung beetle illustration"
                class="w-12 h-12"
              />
            </div>
            <div>
              <h3 class="font-bold text-foreground mb-3 text-lg uppercase tracking-tight">
                Find Your Shit
              </h3>
              <p class="text-sm text-foreground font-medium leading-relaxed">
                Our search doesn't judge your 3am research spirals. Tag it,
                forget it, then magically find it six months later when you
                suddenly remember it exists.
              </p>
            </div>
          </div>

          <div class="text-center space-y-4 p-6">
            <div class="bg-background p-3 rounded-full w-fit mx-auto border-4 border-foreground neobrutalism-shadow">
              <img
                src="/static/incognito.svg"
                alt="Incognito figure illustration"
                class="w-12 h-12"
              />
            </div>
            <div>
              <h3 class="font-bold text-foreground mb-3 text-lg uppercase tracking-tight">
                Your Secret Stash
              </h3>
              <p class="text-sm text-foreground font-medium leading-relaxed">
                We don't care what you're hoarding and neither does anyone else.
                No tracking, no judging, just pure unadulterated link chaos
                that's yours alone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
