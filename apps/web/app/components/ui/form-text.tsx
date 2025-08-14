import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const formTextVariants = cva('leading-normal', {
  variants: {
    variant: {
      hint: 'text-muted-foreground',
      error: 'text-destructive',
      success: 'text-green-600 dark:text-green-400',
      loading: 'text-muted-foreground',
    },
    size: {
      sm: 'text-sm',
      xs: 'text-xs',
    },
  },
  defaultVariants: {
    variant: 'hint',
    size: 'sm',
  },
})

export interface FormTextProps
  extends React.ComponentProps<'p'>,
    VariantProps<typeof formTextVariants> {}

const FormText = React.forwardRef<HTMLParagraphElement, FormTextProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn(formTextVariants({ variant, size }), className)}
        {...props}
      />
    )
  }
)
FormText.displayName = 'FormText'

export { FormText, formTextVariants }
