import type { User } from '@pinsquirrel/domain'
import type { FC, PropsWithChildren } from 'hono/jsx'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { BaseLayout } from './base'

type ContentWidth = 'wide' | 'narrow' | 'form'

const widthClasses: Record<ContentWidth, string> = {
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
}

export const DefaultLayout: FC<PropsWithChildren<DefaultLayoutProps>> = ({
  children,
  title,
  user,
  currentPath,
  width = 'wide',
  privateMode = false,
}) => {
  const containerClass = `${widthClasses[width]} mx-auto px-4 py-6`

  return (
    <BaseLayout title={title} privateMode={privateMode}>
      <Header user={user} currentPath={currentPath} privateMode={privateMode} />
      <main class="flex-1">
        <div class={containerClass}>{children}</div>
      </main>
      <Footer />
    </BaseLayout>
  )
}
