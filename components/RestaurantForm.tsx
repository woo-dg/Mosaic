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
  const [feedback, setFeedback] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')
  const [rating, setRating] = useState(0)
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
      setError('Please upload at least one photo')
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
      formData.append('feedback', feedback)
      formData.append('instagramHandle', instagramHandle)
      formData.append('agreedPrivate', 'true')
      formData.append('allowMarketing', allowMarketing ? 'true' : 'false')

      images.forEach((image) => {
        formData.append('images', image)
      })

      const response = await fetch(`/api/submit/${restaurantSlug}`, {
        method: 'POST',
        body: formData,
      })

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Invalid response type:', contentType, text.substring(0, 200))
        throw new Error('Server returned an invalid response. Please try again.')
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit')
      }

      // Notify parent component to refresh carousel FIRST (before closing modal)
      if (onSubmissionSuccess) {
        onSubmissionSuccess()
      }
      
      // Reset form
      setImages([])
      setFeedback('')
      setInstagramHandle('')
      setRating(0)
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
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload your favorite photos</h2>
        </div>

        {/* Image Upload */}
        <ImageUpload key={formKey} maxImages={3} onImagesChange={setImages} />

        {/* 5 Star Rating */}
        <div className="flex justify-center gap-3 py-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-4xl sm:text-5xl transition-all duration-200 ${
                star <= rating ? 'text-yellow-400 scale-110' : 'text-gray-300'
              } hover:text-yellow-400 hover:scale-110`}
              aria-label={`${star} star`}
            >
              ★
            </button>
          ))}
        </div>

        {/* Instagram Handle */}
        <div>
          <div className="relative">
            <span className="absolute left-0 top-1/2 transform -translate-y-1/2 text-gray-500 text-base">@</span>
            <input
              id="instagram"
              type="text"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value.replace('@', '').replace(/\s/g, ''))}
              className="w-full pl-6 pr-4 py-2 text-base border-0 border-b-2 focus:outline-none transition-colors touch-manipulation bg-transparent text-gray-900 border-gray-300 focus:border-green-300"
              style={{
                borderBottomColor: instagramHandle.length > 0 
                  ? `rgb(${34 + Math.min(instagramHandle.length * 15, 200)}, ${197 + Math.min(instagramHandle.length * 2, 58)}, ${94 + Math.min(instagramHandle.length * 2, 106)})`
                  : undefined
              }}
              placeholder="your social tag"
            />
          </div>
        </div>

        {/* Comment field - just a line */}
        <div>
          <input
            id="feedback"
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full py-2 text-base border-0 border-b-2 focus:outline-none transition-colors touch-manipulation bg-transparent text-gray-900 border-gray-300 focus:border-green-300"
            style={{
              borderBottomColor: feedback.length > 0 
                ? `rgb(${34 + Math.min(feedback.length * 15, 200)}, ${197 + Math.min(feedback.length * 2, 58)}, ${94 + Math.min(feedback.length * 2, 106)})`
                : undefined
            }}
            placeholder="leave a comment"
          />
        </div>

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
        
        {agreedToTerms && (
          <label className="flex items-center space-x-3 cursor-pointer touch-manipulation pl-4">
            <input
              type="checkbox"
              checked={allowMarketing}
              onChange={(e) => setAllowMarketing(e.target.checked)}
              className="w-5 h-5 sm:w-6 sm:h-6 text-gray-900 border-gray-300 rounded focus:ring-gray-500 flex-shrink-0"
            />
            <span className="text-sm sm:text-base text-gray-600">
              Also allow for marketing use (optional)
            </span>
          </label>
        )}
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

