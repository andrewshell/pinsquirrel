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
      return 'text-green-700 bg-green-50 border-green-200 dark:text-green-200 dark:bg-green-950 dark:border-green-800'
    case 'error':
      return 'text-red-700 bg-red-50 border-red-200 dark:text-red-200 dark:bg-red-950 dark:border-red-800'
    case 'warning':
      return 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-100 dark:bg-yellow-900 dark:border-yellow-700'
    case 'info':
    default:
      return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
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
      class={`p-3 text-sm border-2 neobrutalism-shadow ${styles} ${className}`}
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
    class={`p-3 text-sm border-2 neobrutalism-shadow
            text-green-700 bg-green-50 border-green-200
            dark:text-green-200 dark:bg-green-950 dark:border-green-800
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
    class={`p-3 text-sm border-2 neobrutalism-shadow
            text-red-700 bg-red-50 border-red-200
            dark:text-red-200 dark:bg-red-950 dark:border-red-800
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
    class={`p-3 text-sm border-2 neobrutalism-shadow
            text-yellow-700 bg-yellow-50 border-yellow-200
            dark:text-yellow-100 dark:bg-yellow-900 dark:border-yellow-700
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
    class={`p-3 text-sm border-2 neobrutalism-shadow
            text-blue-700 bg-blue-50 border-blue-200
            dark:text-blue-200 dark:bg-blue-900/20 dark:border-blue-800
            ${className}`}
    role="status"
  >
    {message}
  </div>
)
