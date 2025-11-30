'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Minimum swipe distance (in pixels)
  const minSwipeDistance = 50

  // Ensure component is mounted (client-side only)
  useEffect(() => {
    setMounted(true)
  }, [])

  const loadPhotos = useCallback(async () => {
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
        // Only update if photos actually changed (compare IDs)
        const newPhotoIds = data.photos.map((p: Photo) => p.id).join(',')
        const currentPhotoIds = photos.map(p => p.id).join(',')
        
        if (newPhotoIds !== currentPhotoIds) {
          const newPhotos = data.photos as Photo[]
          setPhotos(newPhotos)
          
          // Load signed URLs for new photos only (preserve existing URLs)
          const existingUrls = { ...imageUrls }
          const urlPromises = newPhotos.map(async (photo: Photo) => {
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
  }, [restaurantSlug, photos.length, imageUrls])

  useEffect(() => {
    // Initial load
    loadPhotos()
    
    // Setup realtime subscription
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
          }, 500)
        }
      )
      .subscribe()
    
    // Polling fallback (every 3 seconds)
    const pollInterval = setInterval(() => {
      loadPhotos()
    }, 3000)
    
    // Refresh when page becomes visible
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
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      if (autoAdvanceTimerRef.current) {
        clearInterval(autoAdvanceTimerRef.current)
      }
    }
  }, [restaurantSlug, loadPhotos])

  // Auto-advance slideshow
  useEffect(() => {
    if (photos.length <= 1 || isTransitioning) return
    
    // Clear existing timer
    if (autoAdvanceTimerRef.current) {
      clearInterval(autoAdvanceTimerRef.current)
    }
    
    // Set up auto-advance (4 seconds)
    autoAdvanceTimerRef.current = setInterval(() => {
      if (!isTransitioning) {
        goToNext()
      }
    }, 4000)
    
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearInterval(autoAdvanceTimerRef.current)
      }
    }
  }, [photos.length, isTransitioning, currentIndex])

  const goToNext = useCallback(() => {
    if (photos.length === 0 || isTransitioning) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => (prev + 1) % photos.length)
    setTimeout(() => setIsTransitioning(false), 300)
  }, [photos.length, isTransitioning])

  const goToPrevious = useCallback(() => {
    if (photos.length === 0 || isTransitioning) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)
    setTimeout(() => setIsTransitioning(false), 300)
  }, [photos.length, isTransitioning])

  // Touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      goToNext()
    }
    if (isRightSwipe) {
      goToPrevious()
    }
  }

  // Reset current index when photos change significantly
  useEffect(() => {
    if (photos.length > 0 && currentIndex >= photos.length) {
      setCurrentIndex(0)
    }
  }, [photos.length, currentIndex])

  // Preload next and previous images aggressively
  useEffect(() => {
    if (photos.length === 0 || typeof window === 'undefined' || !mounted) return
    
    const preloadImage = async (photo: Photo) => {
      if (!photo || imageUrls[photo.id]) return
      
      try {
        const urlResponse = await fetch(
          `/api/photos/public-sign-url?path=${encodeURIComponent(photo.file_path)}&slug=${restaurantSlug}`,
          { cache: 'no-store' }
        )
        const urlData = await urlResponse.json()
        if (urlData.url) {
          // Preload the actual image
          const img = document.createElement('img')
          img.src = urlData.url
          img.onload = () => {
            setImageUrls(prev => ({ ...prev, [photo.id]: urlData.url }))
          }
        }
      } catch (error) {
        console.error('Error preloading image:', error)
      }
    }
    
    const nextIndex = (currentIndex + 1) % photos.length
    const prevIndex = (currentIndex - 1 + photos.length) % photos.length
    
    // Preload next and previous
    if (photos[nextIndex]) preloadImage(photos[nextIndex])
    if (photos[prevIndex]) preloadImage(photos[prevIndex])
    
    // Also preload 2 ahead and 2 behind for smoother transitions
    const nextNextIndex = (currentIndex + 2) % photos.length
    const prevPrevIndex = (currentIndex - 2 + photos.length) % photos.length
    if (photos[nextNextIndex]) preloadImage(photos[nextNextIndex])
    if (photos[prevPrevIndex]) preloadImage(photos[prevPrevIndex])
  }, [currentIndex, photos, restaurantSlug, imageUrls, mounted])

  // Show loading state (same on server and client to prevent hydration mismatch)
  if (!mounted || (loading && photos.length === 0)) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-center h-[500px] sm:h-[600px] bg-gray-50 rounded-2xl mx-4">
          <div className="text-gray-400">Loading photos...</div>
        </div>
      </div>
    )
  }

  // Show empty state
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

  // Safety check - ensure we have valid photo data
  if (!photos || photos.length === 0 || currentIndex >= photos.length) {
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

  const currentPhoto = photos[currentIndex]
  const currentImageUrl = currentPhoto ? imageUrls[currentPhoto.id] : null

  return (
    <div className="mb-6">
      <div 
        ref={containerRef}
        className="relative w-full h-[500px] sm:h-[600px] overflow-hidden bg-gray-900 rounded-2xl mx-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Main image with smooth transition */}
        {currentImageUrl ? (
          <div 
            key={currentPhoto.id}
            className={`absolute inset-0 transition-opacity duration-300 ${
              isTransitioning ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <Image
              src={currentImageUrl}
              alt={`Photo ${currentIndex + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-gray-400">Loading photo...</div>
          </div>
        )}

        {/* Instagram handle overlay */}
        {currentPhoto?.instagram_handle && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pb-8">
            <p className="text-white text-base font-semibold">
              @{currentPhoto.instagram_handle}
            </p>
          </div>
        )}

        {/* Navigation arrows (desktop) */}
        {photos.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-3 transition-all touch-manipulation"
              aria-label="Previous photo"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNext}
              className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-3 transition-all touch-manipulation"
              aria-label="Next photo"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Dots indicator */}
        {photos.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
            {photos.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setIsTransitioning(true)
                  setCurrentIndex(index)
                  setTimeout(() => setIsTransitioning(false), 300)
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? 'bg-white w-8' 
                    : 'bg-white/50 w-2 hover:bg-white/70'
                }`}
                aria-label={`Go to photo ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Upload button */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={onUploadClick}
            className="bg-white text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 active:bg-gray-200 transition-all shadow-lg touch-manipulation text-sm"
          >
            Share Your Experience +
          </button>
        </div>
      </div>
    </div>
  )
}
