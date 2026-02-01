import type { FC } from 'hono/jsx'

interface CheckboxProps {
  id: string
  name: string
  checked?: boolean
  label: string
  helpText?: string
  disabled?: boolean
  class?: string
}

const checkboxClasses =
  'h-4 w-4 border-2 border-foreground bg-background focus:ring-2 focus:ring-primary focus:ring-offset-2'

export const Checkbox: FC<CheckboxProps> = ({
  id,
  name,
  checked = false,
  label,
  helpText,
  disabled,
  class: className = '',
}) => {
  const classes = [checkboxClasses, className].filter(Boolean).join(' ')

  return (
    <div class="space-y-2">
      <div class="flex items-center space-x-2">
        {/* Hidden field to ensure false is sent when unchecked */}
        <input type="hidden" name={name} value="false" />
        <input
          id={id}
          name={name}
          type="checkbox"
          value="true"
          checked={checked}
          disabled={disabled}
          class={classes}
        />
        <label for={id} class="text-sm font-medium">
          {label}
        </label>
      </div>
      {helpText && <p class="text-xs text-muted-foreground ml-6">{helpText}</p>}
    </div>
  )
}
