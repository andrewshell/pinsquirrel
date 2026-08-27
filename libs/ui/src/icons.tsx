/** @jsxRuntime automatic @jsxImportSource hono/jsx */
// The pragma stands in for a tsconfig: tsx-run apps compile this file with
// esbuild defaults (classic React JSX) since their tsconfig scope ends at src/.
import type { Child, FC } from 'hono/jsx'

/**
 * Icons the shared components draw themselves. Every icon is a 24×24
 * Lucide-style stroke path; `size` sets the rendered width/height (default 16)
 * and any `class` lands on the `<svg>`. Apps keep their own wider icon sets —
 * only what a shared component renders lives here.
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

export const UserIcon: FC<IconProps> = props => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="10" r="3" />
    <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
  </Icon>
)
