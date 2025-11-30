'use client'

import { useEffect, useState, useRef } from 'react'
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
  const formRef = useRef<HTMLDivElement>(null)

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

  const [showUploadModal, setShowUploadModal] = useState(false)

  const handleUploadClick = () => {
    setShowUploadModal(true)
  }

  const handleSubmissionSuccess = () => {
    // Force carousel to refresh by changing key
    setCarouselKey(prev => prev + 1)
    // Close modal after a brief delay
    setTimeout(() => {
      setShowUploadModal(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile-optimized container */}
      <div className="min-h-screen flex flex-col">
        {/* Header - Mobile optimized */}
        <div className="bg-white shadow-sm sticky top-0 z-10 px-4 py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-center text-gray-900 truncate">
            {restaurant.name}
          </h1>
          <p className="text-center text-sm text-gray-600 mt-1">
            Share your dining experience
          </p>
        </div>

        {/* Photo Carousel */}
        <div className="bg-white py-4 flex-1">
          <PhotoCarousel key={carouselKey} restaurantSlug={restaurant.slug} onUploadClick={handleUploadClick} />
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowUploadModal(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <RestaurantForm 
              restaurantId={restaurant.id} 
              restaurantSlug={restaurant.slug} 
              onSubmissionSuccess={handleSubmissionSuccess}
              onClose={() => setShowUploadModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

