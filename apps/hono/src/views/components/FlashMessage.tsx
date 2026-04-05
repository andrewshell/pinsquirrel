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
      return 'text-green-700 dark:text-green-200'
    case 'error':
      return 'text-red-700 dark:text-red-200'
    case 'warning':
      return 'text-yellow-700 dark:text-yellow-100'
    case 'info':
    default:
      return 'text-blue-700 dark:text-blue-200'
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
            text-green-700 dark:text-green-200
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
            text-red-700 dark:text-red-200
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
            text-yellow-700 dark:text-yellow-100
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
            text-blue-700 dark:text-blue-200
            ${className}`}
    role="status"
  >
    {message}
  </div>
)
