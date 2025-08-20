import * as React from 'react'
import { cn } from '~/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<'textarea'>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full border-4 border-foreground bg-input px-4 py-3 text-base font-medium transition-all placeholder:text-muted-foreground placeholder:font-bold focus-visible:outline-none focus-visible:neobrutalism-shadow disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:bg-destructive/10',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
