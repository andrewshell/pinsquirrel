/** @jsxRuntime automatic @jsxImportSource hono/jsx */
// The pragma stands in for a tsconfig: tsx-run apps compile this file with
// esbuild defaults (classic React JSX) since their tsconfig scope ends at src/.
import type { FC } from 'hono/jsx'

interface InputProps {
  id: string
  name: string
  type?: 'text' | 'email' | 'password' | 'url' | 'search' | 'tel' | 'number'
  value?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  error?: string
  helpText?: string
  class?: string
  autocomplete?: string
  'aria-describedby'?: string
  // Data attributes for JS integration
  'data-url-input'?: boolean
  'data-title-input'?: boolean
  'data-description-input'?: boolean
  // HTMX attributes
  'hx-get'?: string
  'hx-trigger'?: string
  'hx-target'?: string
  'hx-swap'?: string
  'hx-params'?: string
  'hx-vals'?: string
}

// Exported for form controls that have no primitive of their own (a native
// <select>, say) so they can match Input exactly instead of copying the list.
export const inputBaseClasses =
  'w-full px-3 py-2 border-2 border-foreground bg-background text-foreground neobrutalism-shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'

export const Input: FC<InputProps> = ({
  id,
  name,
  type = 'text',
  value = '',
  placeholder,
  required,
  disabled,
  error,
  helpText,
  class: className = '',
  autocomplete,
  'aria-describedby': ariaDescribedBy,
  'data-url-input': dataUrlInput,
  'data-title-input': dataTitleInput,
  'data-description-input': dataDescriptionInput,
  'hx-get': hxGet,
  'hx-trigger': hxTrigger,
  'hx-target': hxTarget,
  'hx-swap': hxSwap,
  'hx-params': hxParams,
  'hx-vals': hxVals,
}) => {
  const hasError = Boolean(error)
  const helpId = helpText ? `${id}-help` : undefined
  const errorId = hasError ? `${id}-error` : undefined
  const describedBy =
    ariaDescribedBy || [helpId, errorId].filter(Boolean).join(' ') || undefined

  const classes = [
    inputBaseClasses,
    hasError ? 'border-red-500' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div class="space-y-2">
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autocomplete={autocomplete}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={describedBy}
        class={classes}
        data-url-input={dataUrlInput ? '' : undefined}
        data-title-input={dataTitleInput ? '' : undefined}
        data-description-input={dataDescriptionInput ? '' : undefined}
        hx-get={hxGet}
        hx-trigger={hxTrigger}
        hx-target={hxTarget}
        hx-swap={hxSwap}
        hx-params={hxParams}
        hx-vals={hxVals}
      />
      {helpText && (
        <p id={helpId} class="text-xs text-muted-foreground">
          {helpText}
        </p>
      )}
      {hasError && (
        <p id={errorId} class="text-sm text-destructive font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
