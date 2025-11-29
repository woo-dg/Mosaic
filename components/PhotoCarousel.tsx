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
    
    // Polling fallback in case realtime isn't enabled (poll every 5 seconds)
    const pollInterval = setInterval(() => {
      loadPhotos()
    }, 5000)
    
    return () => {
      if (cleanup) cleanup()
      clearInterval(pollInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug])

  const loadPhotos = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/photos/${restaurantSlug}`, {
        cache: 'no-store',
      })
      
      if (!response.ok) {
        console.error('Failed to fetch photos:', response.statusText)
        setLoading(false)
        return
      }
      
      const data = await response.json()

      if (data.photos && Array.isArray(data.photos)) {
        setPhotos(data.photos)
        
        // Load signed URLs for all photos in parallel
        const urlPromises = data.photos.map(async (photo: Photo) => {
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
        const urls: Record<string, string> = {}
        urlResults.forEach((result) => {
          if (result) {
            urls[result.id] = result.url
          }
        })
        setImageUrls(urls)
      } else {
        setPhotos([])
      }
    } catch (error) {
      console.error('Error loading photos:', error)
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscription = () => {
    const supabase = createBrowserClient()

    // Subscribe to new submissions for this restaurant
    // We'll reload photos when a new submission with allow_marketing is added
    const channel = supabase
      .channel(`submissions:${restaurantSlug}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions',
          filter: `allow_marketing=eq.true`,
        },
        async (payload) => {
          // Small delay to ensure photos are also inserted
          setTimeout(() => {
            loadPhotos()
          }, 1000)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photos',
        },
        async (payload) => {
          // Reload photos when a new one is added
          setTimeout(() => {
            loadPhotos()
          }, 500)
        }
      )
      .subscribe()

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
      <div className="flex items-center justify-between mb-4 px-4">
        <h2 className="text-lg font-semibold text-gray-900">Community Photos</h2>
        <div className="flex gap-2">
          <button
            onClick={() => loadPhotos()}
            disabled={loading}
            className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-all touch-manipulation disabled:opacity-50"
            title="Refresh photos"
          >
            ↻
          </button>
          <button
            onClick={onUploadClick}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md touch-manipulation"
          >
            Upload Your Photo +
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="px-4">
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-8 text-center border-2 border-dashed border-yellow-200">
            <p className="text-gray-600 mb-4">No photos yet. Be the first to share!</p>
            <button
              onClick={onUploadClick}
              className="bg-yellow-400 text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-yellow-500 active:bg-yellow-600 transition-all shadow-lg touch-manipulation border-2 border-gray-900"
            >
              Upload Your Photo +
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-hide"
          style={{
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="flex-shrink-0 w-[280px] sm:w-[320px] rounded-2xl overflow-hidden shadow-lg bg-white border border-gray-100"
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* Image Container - styled like the reference image */}
              <div className="relative w-full h-[200px] sm:h-[240px] bg-gradient-to-br from-gray-50 to-gray-100">
                {imageUrls[photo.id] ? (
                  <Image
                    src={imageUrls[photo.id]}
                    alt={`Photo ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 280px, 320px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <div className="text-gray-400 text-sm">Loading...</div>
                  </div>
                )}
              </div>

              {/* Card Content - styled like reference */}
              <div className="p-4 bg-white">
                {photo.instagram_handle && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-gray-500 text-xs">@</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {photo.instagram_handle}
                    </span>
                  </div>
                )}
                <p className="text-xs text-gray-500 font-medium">
                  {new Date(photo.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          ))}

          {/* Upload Card - Always visible at the end - styled like reference */}
          <div
            className="flex-shrink-0 w-[280px] sm:w-[320px] rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div className="h-[200px] sm:h-[240px] flex items-center justify-center bg-gradient-to-br from-yellow-100 to-orange-100">
              <div className="text-center px-4">
                <div className="text-5xl mb-3">📸</div>
                <p className="text-sm font-semibold text-gray-800">Share your moment</p>
                <p className="text-xs text-gray-600 mt-1">Be part of the community</p>
              </div>
            </div>
            <div className="p-4 bg-white">
              <button
                onClick={onUploadClick}
                className="w-full bg-yellow-400 text-gray-900 py-3 px-4 rounded-xl font-bold hover:bg-yellow-500 active:bg-yellow-600 transition-all shadow-lg touch-manipulation border-2 border-gray-900 text-sm"
              >
                Upload Your Photo +
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}

