import type { FC, PropsWithChildren } from 'hono/jsx'
import { DefaultLayout } from './default'

interface EmbedLayoutProps {
  title: string
  privateMode?: boolean
}

/**
 * The page without its chrome, for the extension's popup window.
 *
 * `DefaultLayout` with `embed` on, kept as a name for the pages that only
 * ever render inside the popup (`/pins/embed/saved`). Everything else takes
 * `embed` as a prop and lets `DefaultLayout` decide.
 */
export const EmbedLayout: FC<PropsWithChildren<EmbedLayoutProps>> = ({
  children,
  title,
  privateMode = false,
}) => (
  <DefaultLayout title={title} user={null} privateMode={privateMode} embed>
    {children}
  </DefaultLayout>
)
