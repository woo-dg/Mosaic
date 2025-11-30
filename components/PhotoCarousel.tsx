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

interface PhotoCarouselProps {
  restaurantSlug: string
  onUploadClick: () => void
}

export default function PhotoCarousel({ restaurantSlug, onUploadClick }: PhotoCarouselProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initial load
    loadPhotos()
    
    // Setup realtime subscription
    const cleanup = setupRealtimeSubscription()
    
    // Aggressive polling for faster updates (every 2 seconds)
    const pollInterval = setInterval(() => {
      loadPhotos()
    }, 2000)
    
    // Also refresh when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadPhotos()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Refresh on window focus
    const handleFocus = () => {
      loadPhotos()
    }
    window.addEventListener('focus', handleFocus)
    
    return () => {
      if (cleanup) cleanup()
      clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug])

  const loadPhotos = async () => {
    try {
      // Don't set loading to true if we already have photos (to avoid flicker)
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
        // Only update if photos actually changed (prevent unnecessary re-renders)
        const newPhotoIds = data.photos.map((p: Photo) => p.id).join(',')
        const currentPhotoIds = photos.map(p => p.id).join(',')
        
        if (newPhotoIds !== currentPhotoIds) {
          setPhotos(data.photos)
          
          // Load signed URLs for new photos only
          const existingUrls = { ...imageUrls }
          const urlPromises = data.photos.map(async (photo: Photo) => {
            // Skip if we already have the URL
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
      if (photos.length === 0) {
        setLoading(false)
      }
    }
  }

  const setupRealtimeSubscription = () => {
    const supabase = createBrowserClient()

    // Subscribe to new photos - this is more reliable than submissions
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
          console.log('New photo detected via realtime:', payload)
          // Reload photos immediately when a new one is added
          setTimeout(() => {
            loadPhotos()
          }, 500)
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }

  // Show loading only on initial load when we have no photos
  const isInitialLoad = loading && photos.length === 0

  if (isInitialLoad) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4 px-4">
          <h2 className="text-lg font-semibold text-gray-900">Community Photos</h2>
        </div>
        <div className="flex items-center justify-center h-48 bg-gray-50 rounded-2xl mx-4">
          <div className="text-gray-400">Loading photos...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      {photos.length === 0 ? (
        <div className="px-4">
          <div className="bg-gray-50 rounded-2xl p-8 text-center border-2 border-dashed border-gray-300">
            <p className="text-gray-700 mb-4 font-medium">No photos yet. Be the first to share!</p>
            <button
              onClick={onUploadClick}
              className="bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 active:bg-gray-700 transition-all shadow-lg touch-manipulation"
            >
              Upload Your Photo +
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Instagram For You style - seamless grid, no gaps, no padding */}
          <div className="grid grid-cols-3">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="relative aspect-square bg-black overflow-hidden cursor-pointer"
              >
                {imageUrls[photo.id] ? (
                  <Image
                    src={imageUrls[photo.id]}
                    alt={`Photo ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="33vw"
                    priority={index < 6}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900">
                    <div className="text-gray-500 text-xs">Loading...</div>
                  </div>
                )}
              </div>
            ))}

            {/* Upload prompt - integrated seamlessly */}
            <div
              className="relative aspect-square bg-gray-900 flex flex-col items-center justify-center cursor-pointer active:bg-gray-800 transition-colors"
              onClick={onUploadClick}
            >
              <div className="text-center">
                <div className="text-white text-5xl font-light mb-1">+</div>
                <p className="text-white text-xs font-normal">Share</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

