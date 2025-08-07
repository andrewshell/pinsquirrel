import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, buttonVariants } from './button'

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Button>Click me</Button>)
      const button = screen.getByRole('button', { name: 'Click me' })
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('data-slot', 'button')
    })

    it('renders as child component when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      )
      const link = screen.getByRole('link', { name: 'Link Button' })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('data-slot', 'button')
      expect(link).toHaveAttribute('href', '/test')
    })

    it('applies custom className', () => {
      render(<Button className="custom-class">Custom</Button>)
      const button = screen.getByRole('button', { name: 'Custom' })
      expect(button).toHaveClass('custom-class')
    })

    it('forwards additional props', () => {
      render(
        <Button disabled aria-label="Disabled button">
          Disabled
        </Button>
      )
      const button = screen.getByRole('button', { name: 'Disabled button' })
      expect(button).toBeDisabled()
    })
  })

  describe('Variants', () => {
    it('applies default variant classes', () => {
      render(<Button>Default</Button>)
      const button = screen.getByRole('button', { name: 'Default' })
      expect(button).toHaveClass('bg-primary')
      expect(button).toHaveClass('text-primary-foreground')
    })

    it('applies destructive variant classes', () => {
      render(<Button variant="destructive">Delete</Button>)
      const button = screen.getByRole('button', { name: 'Delete' })
      expect(button).toHaveClass('bg-destructive')
      expect(button).toHaveClass('text-white')
    })

    it('applies outline variant classes', () => {
      render(<Button variant="outline">Outline</Button>)
      const button = screen.getByRole('button', { name: 'Outline' })
      expect(button).toHaveClass('border')
      expect(button).toHaveClass('bg-background')
    })

    it('applies secondary variant classes', () => {
      render(<Button variant="secondary">Secondary</Button>)
      const button = screen.getByRole('button', { name: 'Secondary' })
      expect(button).toHaveClass('bg-secondary')
      expect(button).toHaveClass('text-secondary-foreground')
    })

    it('applies ghost variant classes', () => {
      render(<Button variant="ghost">Ghost</Button>)
      const button = screen.getByRole('button', { name: 'Ghost' })
      expect(button).toHaveClass('hover:bg-accent')
      expect(button).toHaveClass('hover:text-accent-foreground')
    })

    it('applies link variant classes', () => {
      render(<Button variant="link">Link</Button>)
      const button = screen.getByRole('button', { name: 'Link' })
      expect(button).toHaveClass('text-primary')
      expect(button).toHaveClass('underline-offset-4')
    })
  })

  describe('Sizes', () => {
    it('applies default size classes', () => {
      render(<Button>Default Size</Button>)
      const button = screen.getByRole('button', { name: 'Default Size' })
      expect(button).toHaveClass('h-9')
      expect(button).toHaveClass('px-4')
      expect(button).toHaveClass('py-2')
    })

    it('applies small size classes', () => {
      render(<Button size="sm">Small</Button>)
      const button = screen.getByRole('button', { name: 'Small' })
      expect(button).toHaveClass('h-8')
      expect(button).toHaveClass('px-3')
    })

    it('applies large size classes', () => {
      render(<Button size="lg">Large</Button>)
      const button = screen.getByRole('button', { name: 'Large' })
      expect(button).toHaveClass('h-10')
      expect(button).toHaveClass('px-6')
    })

    it('applies icon size classes', () => {
      render(
        <Button size="icon" aria-label="Icon button">
          <svg data-testid="icon" />
        </Button>
      )
      const button = screen.getByRole('button', { name: 'Icon button' })
      expect(button).toHaveClass('size-9')
    })
  })

  describe('Interactions', () => {
    it('handles click events', async () => {
      const user = userEvent.setup()
      const handleClick = vi.fn()

      render(<Button onClick={handleClick}>Click me</Button>)
      const button = screen.getByRole('button', { name: 'Click me' })

      await user.click(button)
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not trigger click when disabled', async () => {
      const user = userEvent.setup()
      const handleClick = vi.fn()

      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      )
      const button = screen.getByRole('button', { name: 'Disabled' })

      await user.click(button)
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('buttonVariants', () => {
    it('generates correct classes for variant and size combination', () => {
      const classes = buttonVariants({ variant: 'outline', size: 'lg' })
      expect(classes).toContain('border')
      expect(classes).toContain('h-10')
    })

    it('generates default classes when no props provided', () => {
      const classes = buttonVariants()
      expect(classes).toContain('bg-primary')
      expect(classes).toContain('h-9')
    })

    it('allows className override', () => {
      const classes = buttonVariants({
        variant: 'default',
        className: 'custom-override',
      })
      expect(classes).toContain('custom-override')
    })
  })
})
