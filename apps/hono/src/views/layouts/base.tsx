import type { FC, PropsWithChildren } from 'hono/jsx'

interface BaseLayoutProps {
  title: string
}

export const BaseLayout: FC<PropsWithChildren<BaseLayoutProps>> = ({
  children,
  title,
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
      <body class="bg-background text-foreground min-h-screen">{children}</body>
    </html>
  )
}
