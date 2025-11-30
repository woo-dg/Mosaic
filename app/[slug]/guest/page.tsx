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

        // Small delay to show the animation
        await new Promise(resolve => setTimeout(resolve, 800))
        
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

  const handleSubmissionSuccess = () => {
    // Force carousel to refresh by changing key
    setCarouselKey(prev => prev + 1)
    // Close modal after successful submission
    setShowModal(false)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile-optimized container */}
      <div className="min-h-screen flex flex-col">
        {/* Header - Rounded, centered, sticky bar */}
        <div className="sticky top-0 z-10 px-4 pt-4 pb-2">
          <div className="max-w-4xl mx-auto">
            <div className="bg-black rounded-full px-6 py-3 flex items-center justify-center">
              <h1 className="text-lg sm:text-xl font-bold text-white">
                {restaurant.name}
              </h1>
            </div>
          </div>
        </div>

        {/* Photo Carousel - Centered with padding */}
        <div className="bg-white py-4 px-4">
          <div className="max-w-4xl mx-auto">
            <PhotoCarousel key={carouselKey} restaurantSlug={restaurant.slug} onUploadClick={handleUploadClick} />
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
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Share Your Experience</h2>
                <p className="text-sm text-gray-600 mt-1">Upload your photos and feedback</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="p-6">
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

