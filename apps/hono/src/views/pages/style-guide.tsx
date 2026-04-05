import type { FC, PropsWithChildren } from 'hono/jsx'
import { html } from 'hono/html'
import type { User, Pin } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Checkbox } from '../components/ui/Checkbox'
import { Label } from '../components/ui/Label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../components/ui/Card'
import {
  FlashMessage,
  SuccessMessage,
  ErrorMessage,
  WarningMessage,
  InfoMessage,
} from '../components/FlashMessage'
import { PinCard, PinDeleteConfirm } from '../components/PinCard'
import { FilterHeader } from '../components/FilterHeader'

interface StyleGuidePageProps {
  user: User | null
}

// Section wrapper: labels each sample with its source for scanner traceability
const Section: FC<
  PropsWithChildren<{ id: string; title: string; source: string }>
> = ({ id, title, source, children }) => (
  <section id={id} class="mb-12 scroll-mt-6">
    <h2 class="text-2xl font-bold mb-1">{title}</h2>
    <p class="text-sm text-muted-foreground mb-4">
      Source: <code class="font-mono">{source}</code>
    </p>
    <div class="space-y-4">{children}</div>
  </section>
)

// Inline script that syncs the toggle label with current theme on page load.
// The base layout's darkModeScript (base.tsx:9-36) already reads localStorage.theme on load.
const darkModeInitScript = html`
  <script>
    ;(function () {
      const label = document.getElementById('style-dark-label')
      if (!label) return
      label.textContent = document.documentElement.classList.contains('dark')
        ? 'Switch to light mode'
        : 'Switch to dark mode'
    })()
  </script>
`

const toggleDarkOnclick =
  "var d=document.documentElement.classList.toggle('dark');" +
  "localStorage.setItem('theme',d?'dark':'light');" +
  "var l=document.getElementById('style-dark-label');" +
  "if(l)l.textContent=d?'Switch to light mode':'Switch to dark mode';"

// Fake pins for PinCard rendering (not persisted; render-only)
const samplePins: Pin[] = [
  {
    id: 'sample-1',
    url: 'https://example.com/an-article-about-squirrels',
    title: 'A long article about squirrels and their nut-hoarding behavior',
    description:
      'An in-depth exploration of how squirrels cache food for winter, including the cognitive mapping they use to relocate hidden stashes.',
    readLater: false,
    tagNames: ['squirrels', 'biology', 'winter'],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
    userId: 'style-guide-user',
  },
  {
    id: 'sample-2',
    url: 'https://example.com/read-this-later',
    title: 'A read-later pin with no tags',
    description: null,
    readLater: true,
    tagNames: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    userId: 'style-guide-user',
  },
]

const buttonVariants = [
  'default',
  'outline',
  'secondary',
  'destructive',
] as const
const buttonSizes = ['sm', 'default', 'lg', 'icon'] as const

export const StyleGuidePage: FC<StyleGuidePageProps> = ({ user }) => {
  return (
    <DefaultLayout title="Style Guide" user={user} width="wide">
      {/* Dark-mode toggle for running accessibility scans against both themes */}
      <div class="mb-6 flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          aria-label="Toggle dark mode"
          onclick={toggleDarkOnclick}
        >
          <span id="style-dark-label">Toggle dark mode</span>
        </Button>
        <p class="text-sm text-muted-foreground">
          This page renders real app components for WCAG 2.2 contrast scanning.
        </p>
      </div>
      {darkModeInitScript}

      <h1 class="text-3xl font-bold mb-8">Style Guide</h1>

      {/* 1. Typography & links */}
      <Section
        id="typography"
        title="Typography & Links"
        source="views/components/PinCard.tsx, views/components/Header.tsx, views/pages/signin.tsx"
      >
        <h1 class="text-3xl font-bold">Heading 1 (text-3xl font-bold)</h1>
        <h2 class="text-2xl font-bold">Heading 2 (text-2xl font-bold)</h2>
        <h3 class="text-xl font-bold">Heading 3 (text-xl font-bold)</h3>
        <p class="text-base">
          Body text on <code>bg-background</code>. The quick brown fox jumps
          over the lazy dog.
        </p>
        <p class="text-sm text-muted-foreground">
          Muted/meta text (text-muted-foreground) used for help text,
          timestamps, and pagination counts.
        </p>
        <p class="text-xs text-muted-foreground">
          Extra-small muted text (text-xs text-muted-foreground) used for form
          help text under inputs.
        </p>
        {/* Primary link — shown inline in body text as used in signin.tsx:
            "Or join the gang" */}
        <p class="text-sm">
          <span class="text-muted-foreground">Primary link (inline):</span>{' '}
          Don&rsquo;t have an account?{' '}
          <a
            href="#typography"
            class="text-primary hover:underline font-medium"
          >
            join the gang
          </a>
        </p>

        {/* Primary link (tag list) — shown as a comma-separated list of tags
            (the way PinCard.tsx renders them). Adjacent links don't trigger
            link-in-text-block. */}
        <p class="text-sm text-muted-foreground">
          <span class="text-foreground">
            Primary link (tag list, as in PinCard):
          </span>{' '}
          <a
            href="#typography"
            class="text-primary hover:text-primary/80 hover:underline"
          >
            squirrels
          </a>
          <span>, </span>
          <a
            href="#typography"
            class="text-primary hover:text-primary/80 hover:underline"
          >
            biology
          </a>
          <span>, </span>
          <a
            href="#typography"
            class="text-primary hover:text-primary/80 hover:underline"
          >
            winter
          </a>
        </p>

        {/* Action row — edit (primary) + delete (destructive), as in
            PinCard.tsx bottom row. Standalone links in an action cluster. */}
        <p class="text-sm text-muted-foreground">
          <span class="text-foreground">Action row (as in PinCard):</span>{' '}
          <span class="font-bold">2 hours ago</span>{' '}
          <a
            href="#typography"
            class="text-primary hover:text-primary/80 font-bold hover:underline"
          >
            edit
          </a>{' '}
          <a
            href="#typography"
            class="text-destructive hover:text-destructive/80 font-bold hover:underline"
          >
            delete
          </a>
        </p>

        {/* Muted link — standalone URL under a pin title, as in
            PinCard.tsx expanded view. */}
        <p class="text-sm">
          <a
            href="#typography"
            class="text-muted-foreground hover:text-foreground break-all"
          >
            https://example.com/some/long/url/path
          </a>
        </p>
      </Section>

      {/* 2. Buttons */}
      <Section
        id="buttons"
        title="Buttons"
        source="views/components/ui/Button.tsx"
      >
        {buttonVariants.map((variant) => (
          <div class="space-y-2">
            <p class="text-sm font-medium">
              Variant: <code>{variant}</code>
            </p>
            <div class="flex flex-wrap items-center gap-3">
              {buttonSizes.map((size) => (
                <Button variant={variant} size={size}>
                  {size === 'icon' ? '+' : `${variant}/${size}`}
                </Button>
              ))}
              <Button variant={variant} disabled>
                disabled
              </Button>
            </div>
          </div>
        ))}
        <div class="space-y-2">
          <p class="text-sm font-medium">Link-style button (href prop)</p>
          <Button variant="default" href="#buttons">
            Link button
          </Button>
        </div>
      </Section>

      {/* 3. Form inputs */}
      <Section
        id="forms"
        title="Form Inputs"
        source="views/components/ui/Input.tsx, Textarea.tsx, Checkbox.tsx, Label.tsx"
      >
        <div class="max-w-md space-y-4">
          <div class="space-y-2">
            <Label for="sg-text">Text input (empty)</Label>
            <Input id="sg-text" name="sg-text" placeholder="Placeholder text" />
          </div>
          <div class="space-y-2">
            <Label for="sg-filled">Text input (filled, with help text)</Label>
            <Input
              id="sg-filled"
              name="sg-filled"
              value="A filled value"
              helpText="This is help text explaining the field."
            />
          </div>
          <div class="space-y-2">
            <Label for="sg-error">Text input (error state)</Label>
            <Input
              id="sg-error"
              name="sg-error"
              value="bad value"
              error="This field is required and must be valid."
            />
          </div>
          <div class="space-y-2">
            <Label for="sg-disabled">Text input (disabled)</Label>
            <Input
              id="sg-disabled"
              name="sg-disabled"
              value="Cannot edit"
              disabled
            />
          </div>
          <div class="space-y-2">
            <Label for="sg-email">Email</Label>
            <Input
              id="sg-email"
              name="sg-email"
              type="email"
              placeholder="you@example.com"
            />
          </div>
          <div class="space-y-2">
            <Label for="sg-password">Password</Label>
            <Input
              id="sg-password"
              name="sg-password"
              type="password"
              value="secret"
            />
          </div>
          <div class="space-y-2">
            <Label for="sg-url">URL</Label>
            <Input
              id="sg-url"
              name="sg-url"
              type="url"
              value="https://example.com"
            />
          </div>
          <div class="space-y-2">
            <Label for="sg-search">Search</Label>
            <Input
              id="sg-search"
              name="sg-search"
              type="search"
              placeholder="Search..."
            />
          </div>
          <div class="space-y-2">
            <Label for="sg-textarea">Textarea</Label>
            <Textarea
              id="sg-textarea"
              name="sg-textarea"
              value="Multi-line text content goes here."
              helpText="You can use multiple lines."
            />
          </div>
          <div class="space-y-2">
            <Label for="sg-textarea-error">Textarea (error)</Label>
            <Textarea
              id="sg-textarea-error"
              name="sg-textarea-error"
              value="Too short"
              error="Description must be at least 10 characters."
            />
          </div>
          <Checkbox
            id="sg-checkbox"
            name="sg-checkbox"
            label="Keep me signed in"
            checked
          />
          <Checkbox
            id="sg-checkbox-unchecked"
            name="sg-checkbox-unchecked"
            label="Read later"
            helpText="Mark this pin to read later."
          />
          <Checkbox
            id="sg-checkbox-disabled"
            name="sg-checkbox-disabled"
            label="Disabled checkbox"
            disabled
          />
        </div>
      </Section>

      {/* 4. Flash / alert messages */}
      <Section
        id="flash"
        title="Flash Messages"
        source="views/components/FlashMessage.tsx"
      >
        <SuccessMessage message="Your pin was saved successfully." />
        <ErrorMessage message="Something went wrong. Please try again." />
        <WarningMessage message="Heads up — this action cannot be undone." />
        <InfoMessage message="Import started. You'll be notified when it finishes." />
        <FlashMessage
          type="info"
          message="Generic FlashMessage with type='info'."
        />
      </Section>

      {/* 5. Cards */}
      <Section
        id="cards"
        title="Cards"
        source="views/components/ui/Card.tsx, views/pages/profile.tsx"
      >
        <div class="max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your account password. Muted description text lives on{' '}
                <code>bg-card</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p class="text-sm">
                Card content area. Body text sits on{' '}
                <code>bg-card text-card-foreground</code>.
              </p>
            </CardContent>
            <CardFooter>
              <Button size="sm">Save</Button>
            </CardFooter>
          </Card>
        </div>
      </Section>

      {/* 6. Pin cards */}
      <Section
        id="pin-cards"
        title="Pin Cards"
        source="views/components/PinCard.tsx"
      >
        <div class="space-y-2">
          <p class="text-sm font-medium">Expanded view</p>
          {samplePins.map((pin) => (
            <PinCard pin={pin} viewSize="expanded" searchParams="" />
          ))}
        </div>
        <div class="space-y-2">
          <p class="text-sm font-medium">Compact view</p>
          {samplePins.map((pin) => (
            <PinCard pin={pin} viewSize="compact" searchParams="" />
          ))}
        </div>
        <div class="space-y-2">
          <p class="text-sm font-medium">
            Delete confirmation (destructive background tint)
          </p>
          <PinDeleteConfirm
            pin={samplePins[0]!}
            viewSize="expanded"
            searchParams=""
          />
        </div>
      </Section>

      {/* 7. Filter header & tag pills */}
      <Section
        id="filter-header"
        title="Filter Header &amp; Pills"
        source="views/components/FilterHeader.tsx"
      >
        <FilterHeader
          activeTag="squirrels"
          searchQuery="nut hoarding"
          readFilter="unread"
          searchParams="tag=squirrels&search=nut+hoarding&unread=true"
        />
        <FilterHeader readFilter="all" searchParams="" noTags />
      </Section>

      {/* 8. Muted text contexts */}
      <Section
        id="muted-text"
        title="Muted Text on Different Backgrounds"
        source="app-wide: text-muted-foreground"
      >
        <div class="p-4 bg-background border-2 border-foreground">
          <p class="text-sm text-muted-foreground">
            text-muted-foreground on bg-background — help text, timestamps,
            pagination counts.
          </p>
        </div>
        <div class="p-4 bg-card border-2 border-foreground">
          <p class="text-sm text-muted-foreground">
            text-muted-foreground on bg-card — card descriptions.
          </p>
        </div>
        <div class="p-4 bg-muted border-2 border-foreground">
          <p class="text-sm text-muted-foreground">
            text-muted-foreground on bg-muted — less common but used in some
            panels.
          </p>
        </div>
        <div class="p-4 bg-input border-4 border-foreground">
          <p class="text-sm">
            Plain foreground text on bg-input — used by FilterHeader container.
          </p>
        </div>
      </Section>
    </DefaultLayout>
  )
}
