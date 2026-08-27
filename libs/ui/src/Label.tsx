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
