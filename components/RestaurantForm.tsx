'use client'

import { useState } from 'react'
import ImageUpload from './ImageUpload'
import Link from 'next/link'

interface RestaurantFormProps {
  restaurantId: string
  restaurantSlug: string
  onSubmissionSuccess?: () => void
}

export default function RestaurantForm({ restaurantId, restaurantSlug, onSubmissionSuccess }: RestaurantFormProps) {
  const [images, setImages] = useState<File[]>([])
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [allowMarketing, setAllowMarketing] = useState(true) // Default to true so photos show in carousel
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showThankYouModal, setShowThankYouModal] = useState(false)
  const [formKey, setFormKey] = useState(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (images.length === 0) {
      setError('Please capture at least one photo or video')
      return
    }

    if (!agreedToTerms) {
      setError('You must agree to the terms to submit')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('restaurantId', restaurantId)
      formData.append('restaurantSlug', restaurantSlug)
      formData.append('feedback', '')
      formData.append('instagramHandle', '')
      formData.append('rating', '0')
      formData.append('agreedPrivate', 'true')
      formData.append('allowMarketing', allowMarketing ? 'true' : 'false')

      images.forEach((image) => {
        formData.append('images', image)
      })

      const response = await fetch(`/api/submit/${restaurantSlug}`, {
        method: 'POST',
        body: formData,
      })

      // Get response as text first to handle both JSON and non-JSON responses
      const responseText = await response.text()
      const contentType = response.headers.get('content-type') || ''
      
      let data
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(responseText)
        } catch (parseError) {
          console.error('Failed to parse JSON:', parseError)
          console.error('Response text:', responseText.substring(0, 500))
          throw new Error('Server returned invalid JSON. Please try again.')
        }
      } else {
        // If not JSON, log the error and throw
        console.error('Invalid response type:', contentType)
        console.error('Response status:', response.status)
        console.error('Response text:', responseText.substring(0, 500))
        throw new Error(`Server error (${response.status}): ${responseText.substring(0, 100)}`)
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit')
      }

      // Notify parent component to refresh carousel FIRST (before closing modal)
      // Add a small delay to ensure submission is processed
      if (onSubmissionSuccess) {
        setTimeout(() => {
          onSubmissionSuccess()
        }, 300)
      }
      
      // Reset form
      setImages([])
      setAgreedToTerms(false)
      setAllowMarketing(false)
      setFormKey(prev => prev + 1) // Force ImageUpload to reset
      
      // Close modal immediately (no thank you modal)
      // The carousel will show the new photo
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Thank You Modal */}
      {showThankYouModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowThankYouModal(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center animate-zoom-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 className="text-3xl font-bold mb-3 text-gray-900">Thank You!</h2>
            <p className="text-gray-600 mb-6 text-lg">
              Your photos have been uploaded successfully!
            </p>
            <button
              onClick={() => setShowThankYouModal(false)}
              className="w-full bg-gray-900 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-gray-800 active:bg-gray-700 transition-all shadow-lg touch-manipulation"
            >
              Continue Browsing
            </button>
          </div>
        </div>
      )}

      <form key={formKey} onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="text-center -mt-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Capture your experience</h2>
        </div>

        {/* Image Upload */}
        <ImageUpload key={formKey} maxImages={3} onImagesChange={setImages} />

      <div className="space-y-3">
        <label className="flex items-start space-x-3 cursor-pointer touch-manipulation p-4 bg-gray-50 rounded-xl border border-gray-200">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-1 w-5 h-5 sm:w-6 sm:h-6 text-gray-900 border-gray-300 rounded focus:ring-gray-500 flex-shrink-0"
            required
          />
          <span className="text-sm sm:text-base text-gray-800 leading-relaxed">
            I agree to share my submission with the restaurant{' '}
            {allowMarketing && <span className="font-semibold">and allow it to be used for marketing (social media, etc.)</span>}
            {' '}
            <Link href="/privacy" className="text-gray-600 hover:underline font-medium inline">
              Learn more
            </Link>
          </span>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm sm:text-base">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !agreedToTerms || images.length === 0}
        className="w-full bg-gray-900 text-white py-4 sm:py-5 px-6 rounded-xl font-semibold text-base sm:text-lg hover:bg-gray-800 active:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all touch-manipulation shadow-lg disabled:shadow-none"
      >
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
    </>
  )
}

