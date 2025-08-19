import { describe, it, expect } from 'vitest'

// Extract the bookmarklet generation logic for direct testing
function generateBookmarkletCode(username: string) {
  const bookmarkletJS = `
    (function() {
      const url = location.href;
      const title = document.title;
      const metaDesc = document.querySelector('meta[name="description"]');
      const pageDescription = metaDesc ? metaDesc.getAttribute('content') : '';
      
      // Get selected text and convert to markdown
      const selection = window.getSelection().toString();
      let description = '';
      
      if (selection.trim()) {
        // Basic HTML to markdown conversion for selected text
        description = selection
          .replace(/<br\\s*\\/?>/gi, '\\n')
          .replace(/<\\/p>/gi, '\\n\\n')
          .replace(/<p[^>]*>/gi, '')
          .replace(/<strong[^>]*>(.*?)<\\/strong>/gi, '**$1**')
          .replace(/<b[^>]*>(.*?)<\\/b>/gi, '**$1**')
          .replace(/<em[^>]*>(.*?)<\\/em>/gi, '*$1*')
          .replace(/<i[^>]*>(.*?)<\\/i>/gi, '*$1*')
          .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\\/a>/gi, '[$2]($1)')
          .replace(/<[^>]*>/g, '')
          .trim();
      } else {
        description = pageDescription;
      }
      
      // Construct the URL with parameters
      const params = new URLSearchParams({
        url: url,
        title: title,
        description: description
      });
      
      const targetUrl = \`\${window.location.origin}/${username}/pins/new?\${params.toString()}\`;
      window.open(targetUrl, '_blank');
    })();
  `
    .replace(/\s+/g, ' ')
    .trim()

  return `javascript:${encodeURIComponent(bookmarkletJS)}`
}

describe('Bookmarklet Code Generation', () => {
  it('generates bookmarklet with correct JavaScript structure', () => {
    const code = generateBookmarkletCode('testuser')
    expect(code).toMatch(/^javascript:/)
  })

  it('includes page metadata extraction', () => {
    const code = decodeURIComponent(generateBookmarkletCode('testuser'))

    expect(code).toContain('document.title')
    expect(code).toContain('location.href')
    expect(code).toContain('meta[name="description"]')
  })

  it('includes selected text handling', () => {
    const code = decodeURIComponent(generateBookmarkletCode('testuser'))

    expect(code).toContain('getSelection()')
    expect(code).toContain('selection.trim()')
  })

  it('includes HTML to markdown conversion', () => {
    const code = decodeURIComponent(generateBookmarkletCode('testuser'))

    expect(code).toContain('replace')
    expect(code).toContain('**$1**') // Bold conversion
    expect(code).toContain('*$1*') // Italic conversion
    expect(code).toContain('[$2]($1)') // Link conversion
  })

  it('generates URL with correct username', () => {
    const code = decodeURIComponent(generateBookmarkletCode('testuser'))

    // Check that the username is interpolated into the URL
    expect(code).toContain('/testuser/pins/new')
  })

  it('uses URLSearchParams for parameter encoding', () => {
    const code = decodeURIComponent(generateBookmarkletCode('testuser'))

    expect(code).toContain('URLSearchParams')
    expect(code).toContain('params.toString()')
  })

  it('opens new tab for pin creation', () => {
    const code = decodeURIComponent(generateBookmarkletCode('testuser'))

    expect(code).toContain('window.open')
    expect(code).toContain('_blank')
  })

  it('handles empty selection by using page description', () => {
    const code = decodeURIComponent(generateBookmarkletCode('testuser'))

    expect(code).toContain('pageDescription')
    expect(code).toContain('else')
  })
})
