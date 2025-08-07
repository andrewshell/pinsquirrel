import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn utility', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar')
    expect(result).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    const condition = true
    const falseCondition = false
    const result = cn('base', condition && 'truthy', falseCondition && 'falsy')
    expect(result).toBe('base truthy')
  })

  it('handles arrays of classes', () => {
    const result = cn(['foo', 'bar'], 'baz')
    expect(result).toBe('foo bar baz')
  })

  it('handles objects with conditional classes', () => {
    const result = cn('base', {
      active: true,
      disabled: false,
      'text-lg': true,
    })
    expect(result).toBe('base active text-lg')
  })

  it('removes duplicate classes', () => {
    const result = cn('text-red-500', 'text-blue-500')
    expect(result).toBe('text-blue-500')
  })

  it('handles tailwind modifier conflicts', () => {
    const result = cn('hover:bg-red-500', 'hover:bg-blue-500')
    expect(result).toBe('hover:bg-blue-500')
  })

  it('handles empty inputs', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('handles null and undefined values', () => {
    const result = cn('base', null, undefined, 'end')
    expect(result).toBe('base end')
  })

  it('handles nested arrays', () => {
    const result = cn('base', [['nested', 'array'], 'flat'])
    expect(result).toBe('base nested array flat')
  })

  it('preserves important classes', () => {
    const result = cn('text-red-500', '!text-blue-500')
    expect(result).toContain('!text-blue-500')
  })

  it('handles complex tailwind utilities', () => {
    const result = cn('px-2 py-1 text-xs', 'p-4 text-sm', 'text-base')
    // p-4 should override px-2 and py-1
    // text-base should override text-sm and text-xs
    expect(result).toBe('p-4 text-base')
  })

  it('handles responsive breakpoint classes', () => {
    const result = cn('text-sm md:text-base', 'md:text-lg lg:text-xl')
    expect(result).toBe('text-sm md:text-lg lg:text-xl')
  })

  it('handles arbitrary value classes', () => {
    const result = cn('top-[10px]', 'top-[20px]')
    expect(result).toBe('top-[20px]')
  })

  it('works with real-world component example', () => {
    const result = cn(
      'inline-flex items-center justify-center rounded-md text-sm font-medium',
      'bg-primary text-primary-foreground shadow hover:bg-primary/90',
      'h-9 px-4 py-2',
      'custom-class'
    )
    expect(result).toContain('inline-flex')
    expect(result).toContain('custom-class')
    expect(result).toContain('bg-primary')
  })
})
