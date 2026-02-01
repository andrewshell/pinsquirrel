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
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} - PinSquirrel</title>
        {darkModeScript}
        <link rel="stylesheet" href="/static/styles.css" />
        <script src="/static/htmx.min.js" />
        <script src="/static/dropdown.js" defer />
        <script src="/static/tag-input-vanilla.js" defer />
        <script src="/static/metadata-fetch.js" defer />
      </head>
      <body class="bg-background text-foreground min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  )
}
