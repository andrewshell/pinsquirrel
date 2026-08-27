/** @jsxRuntime automatic @jsxImportSource hono/jsx */
// The pragma stands in for a tsconfig: tsx-run apps compile this file with
// esbuild defaults (classic React JSX) since their tsconfig scope ends at src/.
import type { FC, PropsWithChildren } from 'hono/jsx'

interface LabelProps {
  for: string
  class?: string
}

export const Label: FC<PropsWithChildren<LabelProps>> = ({
  children,
  for: htmlFor,
  class: className = '',
}) => {
  const classes = ['block text-sm font-medium', className]
    .filter(Boolean)
    .join(' ')

  return (
    <label for={htmlFor} class={classes}>
      {children}
    </label>
  )
}
