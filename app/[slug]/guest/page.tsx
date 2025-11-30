'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import RestaurantForm from '@/components/RestaurantForm'
import PhotoGrid from '@/components/PhotoGrid'
import LandingPage from '@/components/LandingPage'
import { createBrowserClient } from '@/lib/supabase/client'

export default function GuestPage() {
  const params = useParams()
  const slug = params.slug as string
  const [restaurant, setRestaurant] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLanding, setShowLanding] = useState(true)
  const [error, setError] = useState(false)
  const [carouselKey, setCarouselKey] = useState(0)
  const [showModal, setShowModal] = useState(false)

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
        
        setRestaurant(data as { id: string; name: string; slug: string })
        
        // Show landing page for 2 seconds, then transition to FYP
        setTimeout(() => {
          setShowLanding(false)
        }, 2000)
      } catch (err) {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    loadRestaurant()
  }, [slug])

  const handleViewPhotos = () => {
    setShowLanding(false)
  }

  if (loading) {
    return <LoadingAnimation />
  }

  if (showLanding && restaurant) {
    return <LandingPage restaurantName={restaurant.name} restaurantSlug={restaurant.slug} onViewPhotos={handleViewPhotos} />
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
    // Close modal immediately
    setShowModal(false)
    // Force carousel to refresh multiple times to catch the new photo
    setTimeout(() => {
      setCarouselKey(prev => prev + 1)
    }, 200)
    setTimeout(() => {
      setCarouselKey(prev => prev + 1)
    }, 800)
    setTimeout(() => {
      setCarouselKey(prev => prev + 1)
    }, 1500)
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

        {/* Photo Grid - Instagram For You Page Style */}
        <div className="bg-white py-0 sm:py-0 px-0 sm:px-0 pb-20">
          <div className="w-full">
            <PhotoGrid key={carouselKey} restaurantSlug={restaurant.slug} onUploadClick={handleUploadClick} />
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

