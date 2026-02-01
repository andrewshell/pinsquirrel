import type { FC } from 'hono/jsx'
import { BaseLayout } from '../layouts/base'

export const TermsPage: FC = () => {
  const today = new Date().toLocaleDateString()

  return (
    <BaseLayout title="Terms of Use">
      <div class="bg-background">
        <div class="container mx-auto px-4 py-16">
          <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl md:text-4xl font-bold text-foreground mb-8">
              Terms of Use
            </h1>

            <div class="prose max-w-none">
              <p class="text-muted-foreground mb-6">Last updated: {today}</p>

              <div class="space-y-6">
                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    Acceptance of Terms
                  </h2>
                  <p class="text-muted-foreground">
                    By using PinSquirrel, you agree to these terms. If you don't
                    agree, please don't use our service.
                  </p>
                </section>

                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    Service Description
                  </h2>
                  <p class="text-muted-foreground">
                    PinSquirrel is a bookmark management service that helps you
                    organize and store web content including links, images,
                    articles, and markdown documents.
                  </p>
                </section>

                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    Acceptable Use
                  </h2>
                  <p class="text-muted-foreground mb-3">
                    You may use PinSquirrel for lawful purposes only. You agree
                    not to:
                  </p>
                  <ul class="list-disc pl-6 space-y-2 text-muted-foreground">
                    <li>Store illegal, harmful, or offensive content</li>
                    <li>Attempt to access other users' data</li>
                    <li>Use the service to distribute malware or spam</li>
                    <li>Overload our systems with excessive requests</li>
                  </ul>
                </section>

                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    Your Data
                  </h2>
                  <p class="text-muted-foreground">
                    You retain ownership of the content you save to PinSquirrel.
                    We provide the service to help you organize and access your
                    content, but you're responsible for backing up anything
                    important.
                  </p>
                </section>

                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    Service Availability
                  </h2>
                  <p class="text-muted-foreground">
                    We strive to keep PinSquirrel available, but we can't
                    guarantee 100% uptime. We may need to perform maintenance or
                    updates that temporarily affect service availability.
                  </p>
                </section>

                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    Limitation of Liability
                  </h2>
                  <p class="text-muted-foreground">
                    PinSquirrel is provided "as is" without warranties. We're
                    not liable for any damages arising from your use of the
                    service.
                  </p>
                </section>

                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    Changes to Terms
                  </h2>
                  <p class="text-muted-foreground">
                    We may update these terms occasionally. Continued use of the
                    service constitutes acceptance of any changes.
                  </p>
                </section>

                <section>
                  <h2 class="text-xl font-semibold text-foreground mb-3">
                    Contact
                  </h2>
                  <p class="text-muted-foreground">
                    Questions about these terms? Drop us a line at{' '}
                    <a
                      href="mailto:andrew@pinsquirrel.com"
                      class="text-foreground hover:underline"
                    >
                      andrew@pinsquirrel.com
                    </a>
                    .
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
