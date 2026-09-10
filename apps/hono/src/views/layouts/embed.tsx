import type { FC, PropsWithChildren } from 'hono/jsx'
import { BaseLayout } from './base'
import { widthClasses } from './default'

interface EmbedLayoutProps {
  title: string
  privateMode?: boolean
}

/**
 * The page without its chrome, for the extension's popup window.
 *
 * `DefaultLayout` minus the Header and Footer: the window is a dialog, and a
 * nav link inside it would navigate the popup onto the full site with no way
 * back. It shares `widthClasses` with the default layout so the card is the
 * same width in both.
 */
export const EmbedLayout: FC<PropsWithChildren<EmbedLayoutProps>> = ({
  children,
  title,
  privateMode = false,
}) => (
  <BaseLayout title={title} privateMode={privateMode}>
    <main class="flex-1">
      <div class={`${widthClasses.form} mx-auto px-4 py-6`}>{children}</div>
    </main>
  </BaseLayout>
)
