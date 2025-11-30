'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Photo {
  id: string
  file_path: string
  created_at: string
  instagram_handle: string | null
}

interface PhotoGridProps {
  restaurantSlug: string
  onUploadClick: () => void
}

export default function PhotoGrid({ restaurantSlug, onUploadClick }: PhotoGridProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const loadPhotos = async () => {
    try {
      if (photos.length === 0) {
        setLoading(true)
      }

      const response = await fetch(`/api/photos/${restaurantSlug}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const text = await response.text()
        console.error('Failed to fetch photos:', response.status, text)
        if (photos.length === 0) {
          setPhotos([])
          setLoading(false)
        }
        return
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Invalid response type:', contentType, text.substring(0, 100))
        if (photos.length === 0) {
          setPhotos([])
          setLoading(false)
        }
        return
      }

      const data = await response.json()

      if (data.photos && Array.isArray(data.photos)) {
        const newPhotoIds = data.photos.map((p: Photo) => p.id).join(',')
        const currentPhotoIds = photos.map(p => p.id).join(',')

        if (newPhotoIds !== currentPhotoIds) {
          const newPhotos = data.photos as Photo[]
          setPhotos(newPhotos)

          // Load signed URLs for new photos
          const existingUrls = { ...imageUrls }
          const urlPromises = newPhotos.map(async (photo: Photo) => {
            if (existingUrls[photo.id]) {
              return { id: photo.id, url: existingUrls[photo.id] }
            }

            try {
              const urlResponse = await fetch(
                `/api/photos/public-sign-url?path=${encodeURIComponent(photo.file_path)}&slug=${restaurantSlug}`,
                { cache: 'no-store' }
              )
              const urlData = await urlResponse.json()
              if (urlData.url) {
                return { id: photo.id, url: urlData.url }
              }
            } catch (error) {
              console.error('Error loading image URL:', error)
            }
            return null
          })

          const urlResults = await Promise.all(urlPromises)
          const urls: Record<string, string> = { ...existingUrls }
          urlResults.forEach((result) => {
            if (result) {
              urls[result.id] = result.url
            }
          })
          setImageUrls(urls)
        }
      } else {
        if (photos.length === 0) {
          setPhotos([])
        }
      }
    } catch (error) {
      console.error('Error loading photos:', error)
      if (photos.length === 0) {
        setPhotos([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!mounted) return
    
    loadPhotos()

    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`photos:${restaurantSlug}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photos',
        },
        async (payload) => {
          setTimeout(() => {
            loadPhotos()
          }, 300)
        }
      )
      .subscribe()

    // Polling for updates
    let pollCount = 0
    const pollInterval = setInterval(() => {
      loadPhotos()
      pollCount++
    }, 1000)

    const slowPollTimeout = setTimeout(() => {
      clearInterval(pollInterval)
      const slowPollInterval = setInterval(() => {
        loadPhotos()
      }, 2000)
      return () => clearInterval(slowPollInterval)
    }, 30000)

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadPhotos()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const handleFocus = () => {
      loadPhotos()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
      clearTimeout(slowPollTimeout)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug, mounted])

  // Create masonry grid layout with varying sizes (Instagram For You style)
  const getGridClass = (index: number) => {
    // More varied patterns for Instagram-like feed
    const patterns = [
      // Pattern 1: Large square, small, small
      ['col-span-2 row-span-2', 'col-span-1 row-span-1', 'col-span-1 row-span-1'],
      // Pattern 2: Small, large square, small
      ['col-span-1 row-span-1', 'col-span-2 row-span-2', 'col-span-1 row-span-1'],
      // Pattern 3: Small, small, large square
      ['col-span-1 row-span-1', 'col-span-1 row-span-1', 'col-span-2 row-span-2'],
      // Pattern 4: Tall, wide, small
      ['col-span-1 row-span-2', 'col-span-2 row-span-1', 'col-span-1 row-span-1'],
      // Pattern 5: Wide, tall, small
      ['col-span-2 row-span-1', 'col-span-1 row-span-2', 'col-span-1 row-span-1'],
      // Pattern 6: All small (standard grid)
      ['col-span-1 row-span-1', 'col-span-1 row-span-1', 'col-span-1 row-span-1'],
    ]
    const patternIndex = Math.floor(index / 3) % patterns.length
    const positionInPattern = index % 3
    return patterns[patternIndex][positionInPattern] || 'col-span-1 row-span-1'
  }

  if (!mounted || (loading && photos.length === 0)) {
    return (
      <div className="mb-6 min-h-[400px]">
        <div className="flex items-center justify-center h-[400px] bg-white">
          <div className="text-gray-400">Loading photos...</div>
        </div>
        {/* Floating button still visible during loading */}
        <button
          onClick={onUploadClick}
          className="fixed bottom-6 left-6 z-40 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 active:scale-95 rounded-full flex items-center justify-center shadow-2xl transition-all touch-manipulation border-2 border-white/10"
          aria-label="Share your experience"
        >
          <svg
            className="w-7 h-7 sm:w-8 sm:h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="mb-6 min-h-[400px] relative">
        <div className="flex items-center justify-center h-[400px] bg-white">
          <div className="text-center">
            <p className="text-gray-700 mb-4 font-medium">No photos yet. Be the first to share!</p>
          </div>
        </div>
        {/* Floating button still visible when empty */}
        <button
          onClick={onUploadClick}
          className="fixed bottom-6 left-6 z-40 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 active:scale-95 rounded-full flex items-center justify-center shadow-2xl transition-all touch-manipulation border-2 border-white/10"
          aria-label="Share your experience"
        >
          <svg
            className="w-7 h-7 sm:w-8 sm:h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="relative mb-6">
      {/* Instagram-style grid - masonry layout */}
      <div className="grid grid-cols-3 gap-0" style={{ gridAutoRows: 'minmax(100px, auto)' }}>
        {photos.map((photo, index) => {
          const imageUrl = imageUrls[photo.id]
          const gridClass = getGridClass(index)

          return (
            <div
              key={photo.id}
              className={`${gridClass} relative overflow-hidden bg-gray-900 group`}
              style={{ 
                aspectRatio: gridClass.includes('row-span-2') ? '1/2' : gridClass.includes('col-span-2') && !gridClass.includes('row-span-2') ? '2/1' : '1/1',
                borderRadius: '1px',
                margin: '0.5px'
              }}
            >
              {imageUrl ? (
                <>
                  <div className="absolute inset-0 bg-gray-900">
                    <Image
                      src={imageUrl}
                      alt={`Photo ${index + 1}`}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                      sizes="(max-width: 640px) 33vw, 33vw"
                      unoptimized
                      priority={index < 6}
                    />
                  </div>
                  {/* Instagram handle overlay - show on hover */}
                  {photo.instagram_handle && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2 sm:p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                      <p className="text-white text-xs sm:text-sm font-semibold">@{photo.instagram_handle}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 bg-gray-900">
                  <div className="w-full h-full bg-gray-800 animate-pulse"></div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Floating circular upload button - bottom left (Instagram style) */}
      <button
        onClick={onUploadClick}
        className="fixed bottom-6 left-6 z-40 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 active:scale-95 rounded-full flex items-center justify-center shadow-2xl transition-all touch-manipulation border-2 border-white/10"
        aria-label="Share your experience"
      >
        <svg
          className="w-7 h-7 sm:w-8 sm:h-8 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>
  )
}

