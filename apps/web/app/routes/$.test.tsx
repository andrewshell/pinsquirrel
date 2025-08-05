import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { loader } from './$'
import CatchAll from './$'
import type { Route } from './+types/$'

describe('404 Route', () => {
  describe('loader', () => {
    it('returns 404 response for .well-known paths', async () => {
      const params = { '*': '.well-known/security.txt' }
      const args: Route.LoaderArgs = { 
        request: new Request('http://localhost/.well-known/security.txt'),
        params,
        context: {}
      }

      const result = loader(args)

      expect(result).toBeInstanceOf(Response)
      expect((result as Response).status).toBe(404)
      expect(await (result as Response).text()).toBe('')
    })

    it('returns 404 response for .well-known/ root path', () => {
      const params = { '*': '.well-known/' }
      const args: Route.LoaderArgs = { 
        request: new Request('http://localhost/.well-known/'),
        params,
        context: {}
      }

      const result = loader(args)

      expect(result).toBeInstanceOf(Response)
      expect((result as Response).status).toBe(404)
    })

    it('returns path data for regular 404 pages', () => {
      const params = { '*': 'some/missing/page' }
      const args: Route.LoaderArgs = { 
        request: new Request('http://localhost/some/missing/page'),
        params,
        context: {}
      }

      const result = loader(args)

      expect(result).toEqual({ path: 'some/missing/page' })
    })

    it('returns empty path when splat is undefined', () => {
      const params = {} as any
      const args: Route.LoaderArgs = { 
        request: new Request('http://localhost/'),
        params,
        context: {}
      }

      const result = loader(args)

      expect(result).toEqual({ path: '' })
    })

    it('returns empty path when splat is empty string', () => {
      const params = { '*': '' }
      const args: Route.LoaderArgs = { 
        request: new Request('http://localhost/'),
        params,
        context: {}
      }

      const result = loader(args)

      expect(result).toEqual({ path: '' })
    })

    it('handles complex paths correctly', () => {
      const params = { '*': 'users/123/settings/advanced' }
      const args: Route.LoaderArgs = { 
        request: new Request('http://localhost/users/123/settings/advanced'),
        params,
        context: {}
      }

      const result = loader(args)

      expect(result).toEqual({ path: 'users/123/settings/advanced' })
    })
  })

  describe('CatchAll Component', () => {
    it('renders 404 page with path', () => {
      const props = { 
        loaderData: { path: 'missing/page' }
      } as any
      
      render(<CatchAll {...props} />)
      
      expect(screen.getByText('404')).toBeInTheDocument()
      expect(screen.getByText('Page not found')).toBeInTheDocument()
      expect(screen.getByText('"missing/page" does not exist')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
    })

    it('renders 404 page without path when path is empty', () => {
      const props = { 
        loaderData: { path: '' }
      } as any
      
      render(<CatchAll {...props} />)
      
      expect(screen.getByText('404')).toBeInTheDocument()
      expect(screen.getByText('Page not found')).toBeInTheDocument()
      expect(screen.queryByText('does not exist')).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/')
    })

    it('applies correct CSS classes', () => {
      const props = { 
        loaderData: { path: 'test/path' }
      } as any
      
      render(<CatchAll {...props} />)
      
      const container = screen.getByText('404').closest('div')
      expect(container?.parentElement).toHaveClass('min-h-screen', 'bg-background', 'flex', 'items-center', 'justify-center')
      
      const heading = screen.getByText('404')
      expect(heading).toHaveClass('text-4xl', 'font-bold', 'text-foreground', 'mb-4')
      
      const link = screen.getByRole('link', { name: 'Go Home' })
      expect(link).toHaveClass('inline-flex', 'items-center', 'px-4', 'py-2', 'bg-primary', 'text-primary-foreground', 'rounded-md', 'hover:bg-primary/90')
    })

    it('displays path in monospace font', () => {
      const props = { 
        loaderData: { path: 'api/v1/users' }
      } as any
      
      render(<CatchAll {...props} />)
      
      const pathElement = screen.getByText('"api/v1/users" does not exist')
      expect(pathElement).toHaveClass('font-mono')
    })

    it('handles special characters in path', () => {
      const props = { 
        loaderData: { path: 'search?q=test&page=1' }
      } as any
      
      render(<CatchAll {...props} />)
      
      expect(screen.getByText('"search?q=test&page=1" does not exist')).toBeInTheDocument()
    })
  })
})