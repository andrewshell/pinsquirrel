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
  'aria-label'?: string
  onclick?: string
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
