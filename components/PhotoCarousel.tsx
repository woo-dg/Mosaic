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
          const previousCount = photos.length
          setPhotos(newPhotos)
          
          // If a new photo was added (count increased), set it as the current index
          if (newPhotos.length > previousCount) {
            // Find the newest photo (should be first in the array since we order by created_at DESC)
            setCurrentIndex(0)
            // Force a refresh by clearing image URLs for the new photo
            if (newPhotos[0]) {
              // Remove the URL for the new photo so it gets reloaded
              setImageUrls(prev => {
                const updated = { ...prev }
                delete updated[newPhotos[0].id]
                return updated
              })
            }
          }
          
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
          // Immediately reload photos when a new one is inserted
          setTimeout(() => {
            loadPhotos()
          }, 300)
        }
      )
      .subscribe()
    
    // More aggressive polling for faster updates (every 1 second for first 30 seconds, then every 2 seconds)
    let pollCount = 0
    const pollInterval = setInterval(() => {
      loadPhotos()
      pollCount++
    }, 1000)
    
    // After 30 seconds, switch to slower polling
    const slowPollTimeout = setTimeout(() => {
      clearInterval(pollInterval)
      const slowPollInterval = setInterval(() => {
        loadPhotos()
      }, 2000)
      // Store for cleanup
      return () => clearInterval(slowPollInterval)
    }, 30000)
    
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
      clearTimeout(slowPollTimeout)
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
    setTimeout(() => setIsTransitioning(false), 500)
  }, [photos.length, isTransitioning])

  const goToPrevious = useCallback(() => {
    if (photos.length === 0 || isTransitioning) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)
    setTimeout(() => setIsTransitioning(false), 500)
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

  // Get previous and next photos for side display
  const prevIndex = (currentIndex - 1 + photos.length) % photos.length
  const nextIndex = (currentIndex + 1) % photos.length
  const prevPhoto = photos[prevIndex]
  const nextPhoto = photos[nextIndex]
  const prevImageUrl = prevPhoto ? imageUrls[prevPhoto.id] : null
  const nextImageUrl = nextPhoto ? imageUrls[nextPhoto.id] : null

  return (
    <div className="mb-6">
      <div 
        ref={containerRef}
        className="relative w-full h-[500px] sm:h-[600px] overflow-visible bg-transparent flex items-center justify-center"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Left side image (tilted) */}
        {prevImageUrl && photos.length > 1 && (
          <div 
            className="absolute left-0 sm:left-8 w-[120px] sm:w-[180px] h-[160px] sm:h-[240px] z-10 opacity-70 transition-all duration-500"
            style={{
              transform: 'perspective(1000px) rotateY(25deg) translateX(-20px)',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl">
              <Image
                src={prevImageUrl}
                alt="Previous photo"
                fill
                className="object-cover"
                sizes="180px"
              />
            </div>
          </div>
        )}

        {/* Main center image */}
        <div className="relative w-[280px] sm:w-[400px] h-[400px] sm:h-[550px] z-20 transition-all duration-500">
          {currentImageUrl ? (
            <div 
              key={currentPhoto.id}
              className={`relative w-full h-full rounded-2xl overflow-hidden shadow-2xl transition-opacity duration-500 ${
                isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
              }`}
            >
              <Image
                src={currentImageUrl}
                alt={`Photo ${currentIndex + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 280px, 400px"
                priority
              />
              {/* Instagram handle overlay */}
              {currentPhoto?.instagram_handle && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pb-6">
                  <p className="text-white text-sm sm:text-base font-semibold">
                    @{currentPhoto.instagram_handle}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full rounded-2xl flex items-center justify-center bg-gray-800">
              <div className="text-gray-400">Loading photo...</div>
            </div>
          )}
        </div>

        {/* Right side image (tilted) */}
        {nextImageUrl && photos.length > 1 && (
          <div 
            className="absolute right-0 sm:right-8 w-[120px] sm:w-[180px] h-[160px] sm:h-[240px] z-10 opacity-70 transition-all duration-500"
            style={{
              transform: 'perspective(1000px) rotateY(-25deg) translateX(20px)',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl">
              <Image
                src={nextImageUrl}
                alt="Next photo"
                fill
                className="object-cover"
                sizes="180px"
              />
            </div>
          </div>
        )}

        {/* Navigation arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 bg-white/90 hover:bg-white backdrop-blur-sm rounded-full p-2 sm:p-3 transition-all touch-manipulation shadow-lg"
              aria-label="Previous photo"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 bg-white/90 hover:bg-white backdrop-blur-sm rounded-full p-2 sm:p-3 transition-all touch-manipulation shadow-lg"
              aria-label="Next photo"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
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
                  setTimeout(() => setIsTransitioning(false), 500)
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? 'bg-gray-900 w-8' 
                    : 'bg-gray-400 w-2 hover:bg-gray-600'
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
