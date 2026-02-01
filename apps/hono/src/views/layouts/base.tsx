import type { FC, PropsWithChildren } from 'hono/jsx'
import { html } from 'hono/html'

interface BaseLayoutProps {
  title: string
}

// Script to detect system dark mode preference and apply .dark class
const darkModeScript = html`
  <script>
    ;(function () {
      // Check for saved preference or system preference
      const savedTheme = localStorage.getItem('theme')
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches

      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add('dark')
      }

      // Listen for system preference changes
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (e) => {
          if (!localStorage.getItem('theme')) {
            if (e.matches) {
              document.documentElement.classList.add('dark')
            } else {
              document.documentElement.classList.remove('dark')
            }
          }
        })
    })()
  </script>
`

export const BaseLayout: FC<PropsWithChildren<BaseLayoutProps>> = ({
  children,
  title,
}) => {
  return html`<!doctype html>
    <html lang="en">
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
        ${darkModeScript}
        <link rel="stylesheet" href="/static/styles.css" />
        <script src="/static/htmx.min.js"></script>
        <script src="/static/dropdown.js" defer></script>
        <script src="/static/tag-input-vanilla.js" defer></script>
        <script src="/static/tag-select.js" defer></script>
        <script src="/static/metadata-fetch.js" defer></script>
      </head>
      <body class="bg-background text-foreground min-h-screen flex flex-col">
        ${children}
      </body>
    </html>`
}
