import type { FC, PropsWithChildren } from 'hono/jsx'

type AlertVariant = 'default' | 'info' | 'success' | 'warning' | 'destructive'

interface AlertProps {
  variant?: AlertVariant
  class?: string
}

interface AlertTitleProps {
  class?: string
}

interface AlertDescriptionProps {
  class?: string
}

const baseClasses =
  'relative w-full border-2 border-foreground px-4 py-3 text-sm neobrutalism-shadow'

const variantClasses: Record<AlertVariant, string> = {
  default: 'bg-card text-card-foreground',
  info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800',
  success:
    'bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-800',
  warning:
    'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-700',
  destructive:
    'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800',
}

export const Alert: FC<PropsWithChildren<AlertProps>> = ({
  children,
  variant = 'default',
  class: className = '',
}) => {
  const classes = [baseClasses, variantClasses[variant], className]
    .filter(Boolean)
    .join(' ')

  const role = variant === 'destructive' ? 'alert' : 'status'

  return (
    <div class={classes} role={role}>
      {children}
    </div>
  )
}

export const AlertTitle: FC<PropsWithChildren<AlertTitleProps>> = ({
  children,
  class: className = '',
}) => {
  const classes = ['font-bold mb-1', className].filter(Boolean).join(' ')

  return <div class={classes}>{children}</div>
}

export const AlertDescription: FC<PropsWithChildren<AlertDescriptionProps>> = ({
  children,
  class: className = '',
}) => {
  const classes = ['text-sm [&_p]:leading-relaxed', className]
    .filter(Boolean)
    .join(' ')

  return <div class={classes}>{children}</div>
}
