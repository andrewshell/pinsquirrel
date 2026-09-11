import type { User } from '@pinsquirrel/domain'
import type { FC, PropsWithChildren } from 'hono/jsx'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { BaseLayout } from './base'

type ContentWidth = 'wide' | 'narrow' | 'form'

/** Shared with `EmbedLayout`, so a page is the same width in either. */
export const widthClasses: Record<ContentWidth, string> = {
  wide: 'max-w-7xl', // Default for main content pages
  narrow: 'max-w-4xl', // Profile, settings pages
  form: 'max-w-2xl', // Form-focused pages
}

interface DefaultLayoutProps {
  title: string
  user: User | null
  currentPath?: string
  width?: ContentWidth
  privateMode?: boolean
  /**
   * Render without the chrome, for the extension's popup window.
   *
   * No Header and no Footer: the window is a dialog, and a nav link inside it
   * would navigate the popup onto the full site with no way back. The width is
   * always the form width, because that is what the popup is sized for. See
   * `lib/embed.ts` for how the flag travels.
   */
  embed?: boolean
}

export const DefaultLayout: FC<PropsWithChildren<DefaultLayoutProps>> = ({
  children,
  title,
  user,
  currentPath,
  width = 'wide',
  privateMode = false,
  embed = false,
}) => {
  const containerClass = `${widthClasses[embed ? 'form' : width]} mx-auto px-4 py-6`

  return (
    <BaseLayout title={title} privateMode={privateMode}>
      {!embed && (
        <Header
          user={user}
          currentPath={currentPath}
          privateMode={privateMode}
        />
      )}
      <main class="flex-1">
        <div class={containerClass}>{children}</div>
      </main>
      {!embed && <Footer />}
    </BaseLayout>
  )
}
