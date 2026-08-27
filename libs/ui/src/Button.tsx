/** @jsxRuntime automatic @jsxImportSource hono/jsx */
// The pragma stands in for a tsconfig: tsx-run apps compile this file with
// esbuild defaults (classic React JSX) since their tsconfig scope ends at src/.
import type { FC, PropsWithChildren } from 'hono/jsx'

type ButtonVariant = 'default' | 'outline' | 'secondary' | 'destructive'
type ButtonSize = 'sm' | 'default' | 'lg' | 'icon'

interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  href?: string
  type?: 'button' | 'submit' | 'reset'
  class?: string
  disabled?: boolean
  // A submit button can carry the decision it stands for, which is how a form
  // offers two choices without any script.
  name?: string
  value?: string
  'aria-label'?: string
  // Hover/focus copy for a button whose consequence is bigger than its label —
  // "Revoke" on a role that also gates signing in, say.
  title?: string
  // No `onclick`: the app ships a `script-src 'self'` CSP, so an inline
  // handler would not run. Use a data attribute and a listener in
  // src/static/*.js.
  'hx-get'?: string
  'hx-post'?: string
  'hx-delete'?: string
  'hx-target'?: string
  'hx-swap'?: string
  'hx-confirm'?: string
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold uppercase border-4 border-foreground neobrutalism-shadow transition-all cursor-pointer hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px] disabled:pointer-events-none disabled:opacity-50'

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground',
  outline: 'bg-background text-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  default: 'h-11 px-6 py-3 text-sm',
  lg: 'h-14 px-8 text-base',
  icon: 'h-11 w-11 p-0',
}

export const Button: FC<PropsWithChildren<ButtonProps>> = ({
  children,
  variant = 'default',
  size = 'default',
  href,
  type = 'button',
  class: className = '',
  disabled,
  ...rest
}) => {
  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (href) {
    return (
      <a href={href} class={classes} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <button type={type} class={classes} disabled={disabled} {...rest}>
      {children}
    </button>
  )
}
