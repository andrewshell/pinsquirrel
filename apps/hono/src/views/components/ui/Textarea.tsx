import type { FC } from 'hono/jsx'

interface TextareaProps {
  id: string
  name: string
  value?: string
  placeholder?: string
  rows?: number
  required?: boolean
  disabled?: boolean
  error?: string
  helpText?: string
  class?: string
  'aria-describedby'?: string
}

const baseClasses =
  'w-full px-3 py-2 border-2 border-foreground bg-background text-foreground neobrutalism-shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'

export const Textarea: FC<TextareaProps> = ({
  id,
  name,
  value = '',
  placeholder,
  rows = 4,
  required,
  disabled,
  error,
  helpText,
  class: className = '',
  'aria-describedby': ariaDescribedBy,
}) => {
  const hasError = Boolean(error)
  const helpId = helpText ? `${id}-help` : undefined
  const errorId = hasError ? `${id}-error` : undefined
  const describedBy =
    ariaDescribedBy || [helpId, errorId].filter(Boolean).join(' ') || undefined

  const classes = [baseClasses, hasError ? 'border-red-500' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div class="space-y-2">
      <textarea
        id={id}
        name={name}
        placeholder={placeholder}
        rows={rows}
        required={required}
        disabled={disabled}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={describedBy}
        class={classes}
      >
        {value}
      </textarea>
      {helpText && (
        <p id={helpId} class="text-xs text-muted-foreground">
          {helpText}
        </p>
      )}
      {hasError && (
        <p id={errorId} class="text-sm text-red-600 font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
