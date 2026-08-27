import type { FC, PropsWithChildren } from 'hono/jsx'

interface CardProps {
  class?: string
}

interface CardHeaderProps {
  class?: string
}

interface CardTitleProps {
  class?: string
}

interface CardDescriptionProps {
  class?: string
}

interface CardContentProps {
  class?: string
}

interface CardFooterProps {
  class?: string
}

// Mobile: bottom border only for less visual weight
// Desktop: full border with neobrutalism shadow
const cardBaseClasses =
  'bg-card text-card-foreground flex flex-col gap-6 border-b-4 border-foreground py-6 md:border-4 md:neobrutalism-shadow-lg'

export const Card: FC<PropsWithChildren<CardProps>> = ({
  children,
  class: className = '',
}) => {
  const classes = [cardBaseClasses, className].filter(Boolean).join(' ')

  return <div class={classes}>{children}</div>
}

export const CardHeader: FC<PropsWithChildren<CardHeaderProps>> = ({
  children,
  class: className = '',
}) => {
  const classes = [
    'grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <div class={classes}>{children}</div>
}

export const CardTitle: FC<PropsWithChildren<CardTitleProps>> = ({
  children,
  class: className = '',
}) => {
  const classes = ['leading-none font-bold text-xl', className]
    .filter(Boolean)
    .join(' ')

  return <h2 class={classes}>{children}</h2>
}

export const CardDescription: FC<PropsWithChildren<CardDescriptionProps>> = ({
  children,
  class: className = '',
}) => {
  const classes = ['text-muted-foreground text-sm', className]
    .filter(Boolean)
    .join(' ')

  return <p class={classes}>{children}</p>
}

export const CardContent: FC<PropsWithChildren<CardContentProps>> = ({
  children,
  class: className = '',
}) => {
  const classes = ['px-6', className].filter(Boolean).join(' ')

  return <div class={classes}>{children}</div>
}

export const CardFooter: FC<PropsWithChildren<CardFooterProps>> = ({
  children,
  class: className = '',
}) => {
  const classes = ['flex items-center px-6', className]
    .filter(Boolean)
    .join(' ')

  return <div class={classes}>{children}</div>
}
