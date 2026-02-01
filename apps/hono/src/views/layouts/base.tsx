import type { FC, PropsWithChildren } from 'hono/jsx'
import { Footer } from '../components/Footer'

interface BaseLayoutProps {
  title: string
  showFooter?: boolean
}

export const BaseLayout: FC<PropsWithChildren<BaseLayoutProps>> = ({
  children,
  title,
  showFooter = true,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} - PinSquirrel</title>
        <link rel="stylesheet" href="/static/styles.css" />
        <script src="/static/htmx.min.js" />
        <script src="/static/dropdown.js" defer />
        <script src="/static/tag-input-vanilla.js" defer />
      </head>
      <body class="bg-background text-foreground min-h-screen flex flex-col">
        <div class="flex-1">{children}</div>
        {showFooter && <Footer />}
      </body>
    </html>
  )
}
