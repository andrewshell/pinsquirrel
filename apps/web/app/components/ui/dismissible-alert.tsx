import { useState } from 'react'
import { Alert, AlertDescription } from './alert'
import { CheckCircle, XCircle, X } from 'lucide-react'
import { cn } from '~/lib/utils'

interface DismissibleAlertProps {
  message: string
  type: 'success' | 'error'
  show?: boolean
  onDismiss?: () => void
  className?: string
}

export function DismissibleAlert({
  message,
  type,
  show: externalShow,
  onDismiss,
  className,
}: DismissibleAlertProps) {
  const [internalShow, setInternalShow] = useState(true)

  // Use external show state if provided, otherwise use internal state
  const show = externalShow !== undefined ? externalShow : internalShow

  if (!show) {
    return null
  }

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss()
    } else {
      setInternalShow(false)
    }
  }

  const isSuccess = type === 'success'
  const Icon = isSuccess ? CheckCircle : XCircle

  return (
    <Alert
      variant={isSuccess ? 'default' : 'destructive'}
      className={cn(
        isSuccess
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200',
        className
      )}
    >
      <Icon className={isSuccess ? 'text-green-600' : 'text-red-600'} />
      <AlertDescription
        className={isSuccess ? 'text-green-800' : 'text-red-800'}
      >
        {message}
      </AlertDescription>
      <button
        type="button"
        onClick={handleDismiss}
        className={cn(
          'absolute right-3 top-3 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-sm',
          isSuccess
            ? 'text-green-600 hover:text-green-800 focus:ring-green-500'
            : 'text-red-600 hover:text-red-800 focus:ring-red-500'
        )}
        aria-label={`Dismiss ${type} message`}
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  )
}
