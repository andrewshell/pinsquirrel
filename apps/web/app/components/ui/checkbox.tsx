import * as React from 'react'
import { cn } from '~/lib/utils'

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const checkboxId =
      id || `checkbox-${Math.random().toString(36).substring(2, 11)}`

    return (
      <div className="flex items-center space-x-3">
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className={cn(
              'peer size-5 cursor-pointer appearance-none border-4 border-foreground bg-background transition-all',
              'checked:bg-primary checked:border-foreground',
              'focus-visible:outline-none focus-visible:neobrutalism-shadow focus-visible:-translate-x-0.5 focus-visible:-translate-y-0.5',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className
            )}
            {...props}
          />
          {/* Custom checkmark */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-primary-foreground opacity-0 peer-checked:opacity-100">
            <svg
              className="size-2 font-bold stroke-current"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ transform: 'translateY(-3px)' }}
            >
              <path
                d="M13.5 4.5L6 12L2.5 8.5"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        {label && (
          <label
            htmlFor={checkboxId}
            className="text-sm font-bold text-foreground cursor-pointer uppercase"
          >
            {label}
          </label>
        )}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export { Checkbox }
