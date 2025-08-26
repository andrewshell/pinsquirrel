import { useState, useCallback, useRef } from 'react'
import type { MetadataResult } from '@pinsquirrel/domain'

interface UseMetadataFetchResult {
  loading: boolean
  error: string | null
  metadata: MetadataResult | null
  fetchMetadata: (url: string) => void
}

export const useMetadataFetch = (): UseMetadataFetchResult => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<MetadataResult | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchMetadata = useCallback((url: string) => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Only proceed if URL is not empty
    if (!url) {
      return
    }

    // Clear previous state and set loading
    setMetadata(null)
    setError(null)
    setLoading(true)

    // Debounce the actual fetch
    debounceTimerRef.current = setTimeout(() => {
      const fetchData = async () => {
        try {
          const encodedUrl = encodeURIComponent(url)
          const response = await fetch(`/api/metadata?url=${encodedUrl}`)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          const result = (await response.json()) as MetadataResult
          setMetadata(result)
          setError(null)
        } catch (err) {
          console.error('Failed to fetch metadata:', err)
          setError('Failed to fetch metadata')
          setMetadata(null)
        } finally {
          setLoading(false)
        }
      }

      void fetchData()
    }, 300) // 300ms debounce delay
  }, [])

  return {
    loading,
    error,
    metadata,
    fetchMetadata,
  }
}
