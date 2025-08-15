import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '~/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none border-4 border-foreground neobrutalism-shadow hover:neobrutalism-shadow-hover active:neobrutalism-shadow-pressed hover:-translate-x-1 hover:-translate-y-1 active:translate-x-1 active:translate-y-1 uppercase",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'border-transparent neobrutalism-shadow-none hover:bg-accent hover:text-accent-foreground hover:border-foreground hover:neobrutalism-shadow',
        link: 'border-transparent neobrutalism-shadow-none text-primary underline-offset-4 hover:underline hover:border-transparent hover:shadow-none',
      },
      size: {
        default: 'h-12 px-6 py-3 has-[>svg]:px-5',
        sm: 'h-10 gap-1.5 px-4 has-[>svg]:px-3',
        lg: 'h-14 px-8 has-[>svg]:px-6',
        icon: 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
