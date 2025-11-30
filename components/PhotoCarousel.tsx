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
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)

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
      if (autoAdvanceTimerRef.current) {
        clearInterval(autoAdvanceTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug])

  // Auto-advance carousel
  useEffect(() => {
    if (photos.length <= 1) return // Don't auto-advance if 1 or fewer items
    
    // Clear existing timer
    if (autoAdvanceTimerRef.current) {
      clearInterval(autoAdvanceTimerRef.current)
    }
    
    // Set up auto-advance (4 seconds)
    autoAdvanceTimerRef.current = setInterval(() => {
      if (!isTransitioning) {
        setIsTransitioning(true)
        setCurrentIndex((prev) => (prev + 1) % photos.length)
        setTimeout(() => setIsTransitioning(false), 500) // Transition duration
      }
    }, 4000)
    
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearInterval(autoAdvanceTimerRef.current)
      }
    }
  }, [photos.length, isTransitioning])

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

  // Get items for carousel display (current, left, right)
  const getCarouselItems = () => {
    if (photos.length === 0) return []
    
    const items = [...photos]
    const current = items[currentIndex]
    const left = items[(currentIndex - 1 + items.length) % items.length]
    const right = items[(currentIndex + 1) % items.length]
    
    return [left, current, right]
  }

  const carouselItems = getCarouselItems()

  // Show loading only on initial load when we have no photos
  const isInitialLoad = loading && photos.length === 0

  if (isInitialLoad) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-2xl mx-4">
          <div className="text-gray-400">Loading photos...</div>
        </div>
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className="mb-6 px-4">
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
    )
  }

  return (
    <div className="mb-6">
      <div className="relative w-full h-[500px] sm:h-[600px] overflow-hidden">
        {/* Carousel container */}
        <div className="flex items-center justify-center h-full relative">
          {/* Left item (small) */}
          <div 
            key={`left-${currentIndex}`}
            className={`absolute left-4 sm:left-8 w-[120px] sm:w-[150px] h-[160px] sm:h-[200px] z-10 opacity-60 transition-all duration-500 ease-in-out ${
              isTransitioning ? 'opacity-0 scale-90' : 'opacity-60 scale-100'
            }`}
          >
            {carouselItems[0] && imageUrls[carouselItems[0].id] ? (
              <div className="relative w-full h-full rounded-lg overflow-hidden shadow-lg">
                <Image
                  src={imageUrls[carouselItems[0].id]}
                  alt="Previous photo"
                  fill
                  className="object-cover"
                  sizes="150px"
                />
              </div>
            ) : (
              <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                <div className="text-gray-400 text-xs">Loading...</div>
              </div>
            )}
          </div>

          {/* Center item (large) */}
          <div 
            key={`center-${currentIndex}`}
            className={`relative w-[280px] sm:w-[350px] h-[400px] sm:h-[500px] z-20 mx-4 transition-all duration-500 ease-in-out ${
              isTransitioning ? 'scale-95 opacity-90' : 'scale-100 opacity-100'
            }`}
          >
            {carouselItems[1] && imageUrls[carouselItems[1].id] ? (
              <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl">
                <Image
                  src={imageUrls[carouselItems[1].id]}
                  alt="Current photo"
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 280px, 350px"
                  priority
                />
                {/* Optional: Instagram handle overlay */}
                {carouselItems[1].instagram_handle && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                    <p className="text-white text-sm font-semibold">
                      @{carouselItems[1].instagram_handle}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-gray-200 rounded-xl flex items-center justify-center">
                <div className="text-gray-400">Loading...</div>
              </div>
            )}
          </div>

          {/* Right item (small) */}
          <div 
            key={`right-${currentIndex}`}
            className={`absolute right-4 sm:right-8 w-[120px] sm:w-[150px] h-[160px] sm:h-[200px] z-10 opacity-60 transition-all duration-500 ease-in-out ${
              isTransitioning ? 'opacity-0 scale-90' : 'opacity-60 scale-100'
            }`}
          >
            {carouselItems[2] && imageUrls[carouselItems[2].id] ? (
              <div className="relative w-full h-full rounded-lg overflow-hidden shadow-lg">
                <Image
                  src={imageUrls[carouselItems[2].id]}
                  alt="Next photo"
                  fill
                  className="object-cover"
                  sizes="150px"
                />
              </div>
            ) : (
              <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                <div className="text-gray-400 text-xs">Loading...</div>
              </div>
            )}
          </div>
        </div>

        {/* Upload prompt button - floating */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
          <button
            onClick={onUploadClick}
            className="bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 active:bg-gray-700 transition-all shadow-lg touch-manipulation text-sm"
          >
            Share Your Experience +
          </button>
        </div>

        {/* Dots indicator */}
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-30 flex gap-2">
          {photos.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setIsTransitioning(true)
                setCurrentIndex(index)
                setTimeout(() => setIsTransitioning(false), 500)
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-white w-6' : 'bg-white/50'
              }`}
              aria-label={`Go to photo ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

