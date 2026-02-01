import type { FC, PropsWithChildren } from 'hono/jsx'

interface LabelProps {
  for: string
  required?: boolean
  class?: string
}

export const Label: FC<PropsWithChildren<LabelProps>> = ({
  children,
  for: htmlFor,
  required,
  class: className = '',
}) => {
  const classes = ['block text-sm font-medium', className]
    .filter(Boolean)
    .join(' ')

  return (
    <label for={htmlFor} class={classes}>
      {children}
      {required && <span class="text-red-500 ml-1">*</span>}
    </label>
  )
}
