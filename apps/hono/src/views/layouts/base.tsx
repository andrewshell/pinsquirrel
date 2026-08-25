import type { FC, PropsWithChildren } from 'hono/jsx'
import { html } from 'hono/html'

interface BaseLayoutProps {
  title: string
  privateMode?: boolean
}

export const BaseLayout: FC<PropsWithChildren<BaseLayoutProps>> = ({
  children,
  title,
  privateMode = false,
}) => {
  const htmlClass = privateMode ? 'private-mode' : ''
  return html`<!doctype html>
    <html lang="en" class="${htmlClass}">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title} - PinSquirrel</title>
        <link rel="icon" type="image/x-icon" href="/static/favicon.ico" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/static/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/static/favicon-16x16.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/static/apple-touch-icon.png"
        />
        <!-- Not deferred: the theme class must be on <html> before first
             paint, or the light theme flashes first. -->
        <script src="/static/theme.js"></script>
        <link rel="stylesheet" href="/static/styles.css" />
        <script src="/static/htmx.min.js"></script>
        <!-- on-ready.js defines the onReady() the components below init with,
             and deferred scripts run in order, so it must stay first. -->
        <script src="/static/on-ready.js" defer></script>
        <script src="/static/dropdown.js" defer></script>
        <script src="/static/tag-input-vanilla.js" defer></script>
        <script src="/static/tag-select.js" defer></script>
        <script src="/static/metadata-fetch.js" defer></script>
        ${
          privateMode
            ? html`<script src="/static/private-mode.js" defer></script>`
            : ''
        }
      </head>
      <body class="bg-background text-foreground min-h-screen flex flex-col">
        ${children}
      </body>
    </html>`
}
