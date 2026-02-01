import type { FC } from 'hono/jsx'
import type { User } from '@pinsquirrel/domain'
import { BaseLayout } from '../layouts/base'
import { Header } from '../components/Header'

interface PrivacyPageProps {
  user: User | null
}

export const PrivacyPage: FC<PrivacyPageProps> = ({ user }) => {
  const today = new Date().toLocaleDateString()

  return (
    <BaseLayout title="Privacy Policy">
      <Header user={user} />
      <div class="bg-background">
        <div class="container mx-auto px-4 py-16">
          <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl md:text-4xl font-bold text-foreground mb-8">
              Privacy Policy
            </h1>

            <div class="prose max-w-none">
              <p class="text-muted-foreground mb-6">Last updated: {today}</p>

              <div class="space-y-6">
                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    We Don't Want Your Personal Information
                  </h2>
                  <p class="text-muted-foreground">
                    Seriously. We built PinSquirrel because we needed it, not to
                    harvest your digital soul. We collect the bare minimum to
                    keep the lights on and let you hoard your links in peace.
                  </p>
                </section>

                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    What We Collect
                  </h2>
                  <ul class="list-disc pl-6 space-y-2 text-muted-foreground">
                    <li>
                      Your email address, but we immediately scramble it beyond
                      recognition and toss the original (even we can't figure
                      out what it was)
                    </li>
                    <li>
                      A username so we know which digital hoard belongs to you
                    </li>
                    <li>
                      Your precious bookmarks, tags, and whatever weird shit you
                      decide to save
                    </li>
                    <li>
                      Just enough data to keep the site from falling over and
                      maybe make it less terrible
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    What We Don't Collect
                  </h2>
                  <ul class="list-disc pl-6 space-y-2 text-muted-foreground">
                    <li>Creepy tracking cookies or stalker-level analytics</li>
                    <li>
                      Ad network bullshit (we're not trying to sell you stuff)
                    </li>
                    <li>Random personal details we don't need</li>
                  </ul>
                </section>

                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    Your Stuff is Safe
                  </h2>
                  <p class="text-muted-foreground">
                    We use all the standard security stuff to keep your digital
                    hoard protected. And since we scrambled your email beyond
                    recognition, even if someone breaks in, they won't be able
                    to link any personal info to your questionable bookmarking
                    habits. Links and notes aren't encrypted though, so don't
                    store anything sensitive.
                  </p>
                </section>

                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    Got Questions?
                  </h2>
                  <p class="text-muted-foreground">
                    If you're still confused about what we do with your data
                    (spoiler: not much), drop us a line at{' '}
                    <a
                      href="mailto:andrew@pinsquirrel.com"
                      class="text-foreground hover:underline"
                    >
                      andrew@pinsquirrel.com
                    </a>
                    . We'll try to explain it without the corporate BS.
                  </p>
                </section>
              </div>
            </div>

            <div class="mt-8">
              <a
                href="/"
                class="text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to Home
              </a>
            </div>
          </div>
        </div>
      </div>
    </BaseLayout>
  )
}
