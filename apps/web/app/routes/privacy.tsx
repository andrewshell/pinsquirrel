import type { Route } from './+types/privacy'

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Privacy Policy - PinSquirrel' },
    {
      name: 'description',
      content: 'Privacy policy for PinSquirrel bookmark management service.',
    },
  ]
}

export default function Privacy() {
  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Privacy Policy
          </h1>

          <div className="prose max-w-none">
            <p className="text-muted-foreground mb-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <div className="space-y-6">
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  We Don&apos;t Give a Shit About Your Data
                </h2>
                <p className="text-muted-foreground">
                  Seriously. We built PinSquirrel because we needed it, not to
                  harvest your digital soul. We collect the bare minimum to keep
                  the lights on and let you hoard your links in peace.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  What We Collect
                </h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    Your email address, but we immediately scramble it beyond
                    recognition and toss the original (even we can&apos;t figure
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
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  What We Don&apos;t Collect
                </h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Creepy tracking cookies or stalker-level analytics</li>
                  <li>
                    Ad network bullshit (we&apos;re not trying to sell you
                    stuff)
                  </li>
                  <li>Random personal details we don&apos;t need</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  Your Stuff is Safe
                </h2>
                <p className="text-muted-foreground">
                  We use all the standard security stuff to keep your digital
                  hoard protected. And since we scrambled your email beyond
                  recognition, even if someone breaks in, they won&apos;t be
                  able to link any personal info to your questionable
                  bookmarking habits. Links and notes aren&apos;t encrypted
                  though, so don&apos;t store anything sensitive.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  Got Questions?
                </h2>
                <p className="text-muted-foreground">
                  If you&apos;re still confused about what we do with your data
                  (spoiler: not much), drop us a line at{' '}
                  <a
                    href="mailto:andrew@pinsquirrel.com"
                    className="text-foreground hover:underline"
                  >
                    andrew@pinsquirrel.com
                  </a>
                  . We&apos;ll try to explain it without the corporate BS.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
