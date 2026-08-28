import type { Child, FC } from 'hono/jsx'

/**
 * The console's own icons, on the Hono app's pattern: 24×24 Lucide-style
 * stroke paths, `size` sets the rendered width/height (default 16). Only what
 * the console draws itself lives here — the shared components bring their own
 * from @pinsquirrel/ui.
 */
export type IconProps = {
  size?: number
  class?: string
}

const Icon: FC<IconProps & { children: Child }> = ({
  size = 16,
  children,
  ...rest
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...rest}
  >
    {children}
  </svg>
)

export const CheckIcon: FC<IconProps> = props => (
  <Icon {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
)

export const CloseIcon: FC<IconProps> = props => (
  <Icon {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
)

export const TrashIcon: FC<IconProps> = props => (
  <Icon {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </Icon>
)
