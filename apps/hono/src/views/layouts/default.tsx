import type { FC, PropsWithChildren } from 'hono/jsx'
import type { User } from '@pinsquirrel/domain'
import { BaseLayout } from './base'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'

interface DefaultLayoutProps {
  title: string
  user: User | null
  currentPath?: string
}

export const DefaultLayout: FC<PropsWithChildren<DefaultLayoutProps>> = ({
  children,
  title,
  user,
  currentPath,
}) => {
  return (
    <BaseLayout title={title}>
      <Header user={user} currentPath={currentPath} />
      <main class="flex-1">{children}</main>
      <Footer />
    </BaseLayout>
  )
}
