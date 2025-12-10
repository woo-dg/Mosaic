'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import RestaurantForm from '@/components/RestaurantForm'
import LoadingAnimation from '@/components/LoadingAnimation'
import PhotoCarousel from '@/components/PhotoCarousel'
import { createBrowserClient } from '@/lib/supabase/client'

export default function GuestPage() {
  const params = useParams()
  const slug = params.slug as string
  const [restaurant, setRestaurant] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [carouselKey, setCarouselKey] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [isLoadingNewPhoto, setIsLoadingNewPhoto] = useState(false)

  useEffect(() => {
    const loadRestaurant = async () => {
      try {
        const supabase = createBrowserClient()

        const { data, error: fetchError } = await supabase
          .from('restaurants')
          .select('id, name, slug')
          .eq('slug', slug)
          .single()

        if (fetchError || !data) {
          setError(true)
          return
        }

        // Small delay to show the animation (reduced for faster loading)
        await new Promise(resolve => setTimeout(resolve, 400))
        
        setRestaurant(data as { id: string; name: string; slug: string })
      } catch (err) {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadRestaurant()
  }, [slug])

  if (loading) {
    return <LoadingAnimation />
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Restaurant Not Found</h1>
          <p className="text-gray-600">The restaurant you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const handleUploadClick = () => {
    setShowModal(true)
  }

  const handleSubmissionSuccess = async () => {
    // Show loading state and close modal immediately
    setIsLoadingNewPhoto(true)
    setShowModal(false)
    
    // Poll for the new photo to appear in the carousel
    const checkForNewPhoto = async (attempt: number = 0): Promise<void> => {
      const maxAttempts = 20 // 20 attempts = 10 seconds max
      const delay = 500 // Check every 500ms
      
      try {
        const supabase = createBrowserClient()
        const { data: restaurantData } = await supabase
          .from('restaurants')
          .select('id')
          .eq('slug', slug)
          .single()
        
        if (!restaurantData) return
        
        // Check if there are any photos now
        const { data: submissions } = await supabase
          .from('submissions')
          .select('id, photos(id)')
          .eq('restaurant_id', restaurantData.id)
          .or(`allow_marketing.eq.true,created_at.gte.${new Date(Date.now() - 5 * 60 * 1000).toISOString()}`)
          .order('created_at', { ascending: false })
          .limit(1)
        
        const hasPhotos = submissions && submissions.length > 0 && 
                         submissions[0].photos && 
                         Array.isArray(submissions[0].photos) && 
                         submissions[0].photos.length > 0
        
        if (hasPhotos) {
          // Photo found! Refresh carousel and hide loading
          setCarouselKey(prev => prev + 1)
          // Small delay to ensure carousel renders before hiding loading
          setTimeout(() => {
            setIsLoadingNewPhoto(false)
          }, 300)
          return
        }
        
        // If no photo yet and we haven't exceeded max attempts, try again
        if (attempt < maxAttempts) {
          setTimeout(() => checkForNewPhoto(attempt + 1), delay)
        } else {
          // Max attempts reached, hide loading anyway and refresh carousel
          setCarouselKey(prev => prev + 1)
          setIsLoadingNewPhoto(false)
        }
      } catch (error) {
        console.error('Error checking for new photo:', error)
        // On error, refresh carousel and hide loading
        setCarouselKey(prev => prev + 1)
        setIsLoadingNewPhoto(false)
      }
    }
    
    // Start checking after a brief delay to allow upload to complete
    setTimeout(() => {
      checkForNewPhoto()
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile-optimized container */}
      <div className="min-h-screen flex flex-col">
        {/* Header - Rounded, centered, sticky bar */}
        <div className="sticky top-0 z-50 px-4 pt-4 pb-2 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="bg-black rounded-2xl px-6 py-3 flex items-center justify-center gap-4">
              {/* Shattered M logo */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                    {/* Shattered M - Left piece */}
                    <path d="M3 20 L3 6 L7 10 L7 20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
                    {/* Center left piece */}
                    <path d="M7 10 L11 2 L11 20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
                    {/* Center right piece */}
                    <path d="M11 2 L15 10 L15 20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
                    {/* Right piece */}
                    <path d="M15 10 L19 6 L19 20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.95"/>
                    {/* Shatter lines - creating the broken effect */}
                    <path d="M5 12 L5 16" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
                    <path d="M9 4 L9 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
                    <path d="M13 4 L13 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
                    <path d="M17 12 L17 16" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
                  </svg>
                </div>
                {/* Vertical line */}
                <div className="h-6 w-px bg-white/50"></div>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                {restaurant.name}
              </h1>
            </div>
          </div>
        </div>

        {/* Menu Link Bar - Only for El Mariachi */}
        {(slug === 'el-mariachi' || slug === 'elmariachi' || restaurant.name.toLowerCase().includes('mariachi')) && (
          <div className="px-4 py-3 bg-white border-b border-gray-200">
            <div className="max-w-4xl mx-auto">
              <a
                href="https://elmariachitacos.ca/menu/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">View Full Menu</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* Photo Carousel - Centered with padding */}
        <div className="bg-white py-4 px-4">
          <div className="max-w-4xl mx-auto">
            {isLoadingNewPhoto ? (
              <div className="mb-6 px-4">
                <div className="bg-gray-50 rounded-2xl p-12 text-center border-2 border-dashed border-gray-300">
                  <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                    <p className="text-gray-700 font-medium text-lg">Loading your image...</p>
                    <p className="text-gray-500 text-sm">This will just take a moment</p>
                  </div>
                </div>
              </div>
            ) : (
              <PhotoCarousel key={carouselKey} restaurantSlug={restaurant.slug} onUploadClick={handleUploadClick} />
            )}
          </div>
        </div>

        {/* Stacked text section */}
        <div className="bg-white px-4 pb-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Share Photos
              </h2>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Get Featured
              </h2>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Help Restaurants
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Form Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-4xl font-light w-12 h-12 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
              <RestaurantForm 
                restaurantId={restaurant.id} 
                restaurantSlug={restaurant.slug} 
                onSubmissionSuccess={handleSubmissionSuccess} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

