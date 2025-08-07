import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from './card'

describe('Card Components', () => {
  describe('Card', () => {
    it('renders with default classes', () => {
      render(<Card data-testid="card">Card content</Card>)

      const card = screen.getByTestId('card')
      expect(card).toHaveAttribute('data-slot', 'card')
      expect(card).toHaveClass(
        'bg-card',
        'text-card-foreground',
        'flex',
        'flex-col',
        'gap-6',
        'rounded-xl',
        'border',
        'py-6',
        'shadow-sm'
      )
    })

    it('merges custom className', () => {
      render(
        <Card data-testid="card" className="custom-class">
          Card content
        </Card>
      )

      const card = screen.getByTestId('card')
      expect(card).toHaveClass('custom-class')
    })

    it('passes through other props', () => {
      render(
        <Card data-testid="card" id="test-card">
          Card content
        </Card>
      )

      const card = screen.getByTestId('card')
      expect(card).toHaveAttribute('id', 'test-card')
    })
  })

  describe('CardHeader', () => {
    it('renders with default classes', () => {
      render(<CardHeader data-testid="header">Header content</CardHeader>)

      const header = screen.getByTestId('header')
      expect(header).toHaveAttribute('data-slot', 'card-header')
      expect(header).toHaveClass(
        '@container/card-header',
        'grid',
        'auto-rows-min'
      )
    })

    it('merges custom className', () => {
      render(
        <CardHeader data-testid="header" className="custom-header">
          Header
        </CardHeader>
      )

      const header = screen.getByTestId('header')
      expect(header).toHaveClass('custom-header')
    })
  })

  describe('CardTitle', () => {
    it('renders with default classes', () => {
      render(<CardTitle data-testid="title">Title text</CardTitle>)

      const title = screen.getByTestId('title')
      expect(title).toHaveAttribute('data-slot', 'card-title')
      expect(title).toHaveClass('leading-none', 'font-semibold')
    })

    it('merges custom className', () => {
      render(
        <CardTitle data-testid="title" className="custom-title">
          Title
        </CardTitle>
      )

      const title = screen.getByTestId('title')
      expect(title).toHaveClass('custom-title')
    })
  })

  describe('CardDescription', () => {
    it('renders with default classes', () => {
      render(
        <CardDescription data-testid="description">
          Description text
        </CardDescription>
      )

      const description = screen.getByTestId('description')
      expect(description).toHaveAttribute('data-slot', 'card-description')
      expect(description).toHaveClass('text-muted-foreground', 'text-sm')
    })

    it('merges custom className', () => {
      render(
        <CardDescription data-testid="description" className="custom-desc">
          Description
        </CardDescription>
      )

      const description = screen.getByTestId('description')
      expect(description).toHaveClass('custom-desc')
    })
  })

  describe('CardAction', () => {
    it('renders with default classes', () => {
      render(<CardAction data-testid="action">Action content</CardAction>)

      const action = screen.getByTestId('action')
      expect(action).toHaveAttribute('data-slot', 'card-action')
      expect(action).toHaveClass(
        'col-start-2',
        'row-span-2',
        'row-start-1',
        'self-start',
        'justify-self-end'
      )
    })

    it('merges custom className', () => {
      render(
        <CardAction data-testid="action" className="custom-action">
          Action
        </CardAction>
      )

      const action = screen.getByTestId('action')
      expect(action).toHaveClass('custom-action')
    })
  })

  describe('CardContent', () => {
    it('renders with default classes', () => {
      render(<CardContent data-testid="content">Content text</CardContent>)

      const content = screen.getByTestId('content')
      expect(content).toHaveAttribute('data-slot', 'card-content')
      expect(content).toHaveClass('px-6')
    })

    it('merges custom className', () => {
      render(
        <CardContent data-testid="content" className="custom-content">
          Content
        </CardContent>
      )

      const content = screen.getByTestId('content')
      expect(content).toHaveClass('custom-content')
    })
  })

  describe('CardFooter', () => {
    it('renders with default classes', () => {
      render(<CardFooter data-testid="footer">Footer content</CardFooter>)

      const footer = screen.getByTestId('footer')
      expect(footer).toHaveAttribute('data-slot', 'card-footer')
      expect(footer).toHaveClass(
        'flex',
        'items-center',
        'px-6',
        '[.border-t]:pt-6'
      )
    })

    it('merges custom className', () => {
      render(
        <CardFooter data-testid="footer" className="custom-footer">
          Footer
        </CardFooter>
      )

      const footer = screen.getByTestId('footer')
      expect(footer).toHaveClass('custom-footer')
    })
  })

  describe('Card composition', () => {
    it('renders a complete card with all components', () => {
      render(
        <Card data-testid="full-card">
          <CardHeader>
            <CardTitle>Test Title</CardTitle>
            <CardDescription>Test description</CardDescription>
            <CardAction>Action</CardAction>
          </CardHeader>
          <CardContent>Main content</CardContent>
          <CardFooter>Footer content</CardFooter>
        </Card>
      )

      expect(screen.getByText('Test Title')).toBeInTheDocument()
      expect(screen.getByText('Test description')).toBeInTheDocument()
      expect(screen.getByText('Action')).toBeInTheDocument()
      expect(screen.getByText('Main content')).toBeInTheDocument()
      expect(screen.getByText('Footer content')).toBeInTheDocument()
    })
  })
})
