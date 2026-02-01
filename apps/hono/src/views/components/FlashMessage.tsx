import type { FC } from 'hono/jsx'
import type { FlashType } from '../../middleware/session'

interface FlashMessageProps {
  type: FlashType
  message: string
  className?: string
}

// Get style classes based on flash type with dark mode support
function getFlashStyles(type: FlashType): string {
  switch (type) {
    case 'success':
      return 'text-green-700 bg-green-50 dark:text-green-200 dark:bg-green-950'
    case 'error':
      return 'text-red-700 bg-red-50 dark:text-red-200 dark:bg-red-950'
    case 'warning':
      return 'text-yellow-700 bg-yellow-50 dark:text-yellow-100 dark:bg-yellow-900'
    case 'info':
    default:
      return 'text-blue-700 bg-blue-50 dark:text-blue-200 dark:bg-blue-900/20'
  }
}

export const FlashMessage: FC<FlashMessageProps> = ({
  type,
  message,
  className = '',
}) => {
  const styles = getFlashStyles(type)

  return (
    <div
      class={`p-3 text-sm border-2 border-foreground neobrutalism-shadow ${styles} ${className}`}
      role={type === 'error' ? 'alert' : 'status'}
    >
      {message}
    </div>
  )
}

// Simple success message for specific use cases
export const SuccessMessage: FC<{ message: string; className?: string }> = ({
  message,
  className = '',
}) => (
  <div
    class={`p-3 text-sm border-2 border-foreground neobrutalism-shadow
            text-green-700 bg-green-50
            dark:text-green-200 dark:bg-green-950
            ${className}`}
    role="status"
  >
    {message}
  </div>
)

// Error message for form-level errors
export const ErrorMessage: FC<{ message: string; className?: string }> = ({
  message,
  className = '',
}) => (
  <div
    class={`p-3 text-sm border-2 border-foreground neobrutalism-shadow
            text-red-700 bg-red-50
            dark:text-red-200 dark:bg-red-950
            ${className}`}
    role="alert"
  >
    {message}
  </div>
)

// Warning message for cautionary information
export const WarningMessage: FC<{ message: string; className?: string }> = ({
  message,
  className = '',
}) => (
  <div
    class={`p-3 text-sm border-2 border-foreground neobrutalism-shadow
            text-yellow-700 bg-yellow-50
            dark:text-yellow-100 dark:bg-yellow-900
            ${className}`}
    role="status"
  >
    {message}
  </div>
)

// Info message for general information
export const InfoMessage: FC<{ message: string; className?: string }> = ({
  message,
  className = '',
}) => (
  <div
    class={`p-3 text-sm border-2 border-foreground neobrutalism-shadow
            text-blue-700 bg-blue-50
            dark:text-blue-200 dark:bg-blue-900/20
            ${className}`}
    role="status"
  >
    {message}
  </div>
)
