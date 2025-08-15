import { useState } from 'react'
import { Alert, AlertDescription } from './alert'
import { CheckCircle, XCircle } from 'lucide-react'
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
      variant="default"
      className={cn(
        'cursor-pointer transition-all hover:opacity-80 active:transform active:scale-[0.98]',
        isSuccess ? 'bg-lime-300 text-black' : 'bg-red-400 text-black',
        className
      )}
      onClick={handleDismiss}
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleDismiss()
        }
      }}
      aria-label={`Dismiss ${type} message: ${message}`}
      title="Click to dismiss"
    >
      <Icon className="text-black" />
      <AlertDescription className="text-black">{message}</AlertDescription>
    </Alert>
  )
}
