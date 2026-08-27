import { it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

// dev/start run this app under tsx, which compiles files outside the package
// with esbuild defaults — classic React JSX — unless the shared components
// pin their runtime with a per-file pragma. vitest resolves libs/ui's own
// tsconfig per file, so only an actual tsx subprocess can catch the pragma
// going missing.
const script = `import('@pinsquirrel/ui')
  .then(m => {
    m.Card({ children: 'x' })
    m.Button({ children: 'x' })
    m.UserIcon({})
    m.NavLink({ href: '/', children: 'x' })
    m.Header({ logoSrc: '/logo.svg', brand: 'Admin' })
    m.ProfileDropdown({ username: 'x', children: 'x' })
  })
  .catch(e => {
    console.error(e.message)
    process.exit(1)
  })`

it('renders @pinsquirrel/ui components under the tsx runtime', () => {
  expect(() =>
    execFileSync('node_modules/.bin/tsx', ['-e', script], {
      stdio: 'pipe',
      timeout: 30_000,
    })
  ).not.toThrow()
})
