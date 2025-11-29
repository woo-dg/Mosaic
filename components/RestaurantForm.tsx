'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUpload from './ImageUpload'
import Link from 'next/link'

interface RestaurantFormProps {
  restaurantId: string
  restaurantSlug: string
}

export default function RestaurantForm({ restaurantId, restaurantSlug }: RestaurantFormProps) {
  const router = useRouter()
  const [images, setImages] = useState<File[]>([])
  const [feedback, setFeedback] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')
  const [agreedPrivate, setAgreedPrivate] = useState(false)
  const [allowMarketing, setAllowMarketing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (images.length === 0) {
      setError('Please upload at least one photo')
      return
    }

    if (!agreedPrivate) {
      setError('You must agree to share your submission privately with the restaurant')
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

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push(`/${restaurantSlug}/guest/thanks`)
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-8 sm:py-12">
        <div className="text-green-600 text-6xl sm:text-7xl mb-4 animate-bounce">✓</div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-900">Thank You!</h2>
        <p className="text-gray-600 text-base sm:text-lg">Your submission has been received.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
      <ImageUpload maxImages={3} onImagesChange={setImages} />

      <div>
        <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
          Feedback (Optional)
        </label>
        <textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none touch-manipulation"
          placeholder="Tell us about your experience..."
        />
      </div>

      <div>
        <label htmlFor="instagram" className="block text-sm font-medium text-gray-700 mb-2">
          Instagram Handle (Optional)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-base">@</span>
          <input
            id="instagram"
            type="text"
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value.replace('@', ''))}
            className="w-full pl-8 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-manipulation"
            placeholder="yourusername"
          />
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <label className="flex items-start space-x-3 cursor-pointer touch-manipulation">
          <input
            type="checkbox"
            checked={agreedPrivate}
            onChange={(e) => setAgreedPrivate(e.target.checked)}
            className="mt-1 w-5 h-5 sm:w-6 sm:h-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
            required
          />
          <span className="text-sm sm:text-base text-gray-700 leading-relaxed">
            My submission will be shared privately with the restaurant.{' '}
            <Link href="/privacy" className="text-blue-600 hover:underline inline">
              Learn more
            </Link>
          </span>
        </label>

        <label className="flex items-start space-x-3 cursor-pointer touch-manipulation">
          <input
            type="checkbox"
            checked={allowMarketing}
            onChange={(e) => setAllowMarketing(e.target.checked)}
            className="mt-1 w-5 h-5 sm:w-6 sm:h-6 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
          />
          <span className="text-sm sm:text-base text-gray-700 leading-relaxed">
            I allow my content to be used for marketing (social media, etc.)
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
        disabled={loading || !agreedPrivate || images.length === 0}
        className="w-full bg-blue-600 text-white py-4 sm:py-5 px-6 rounded-xl font-semibold text-base sm:text-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all touch-manipulation shadow-lg shadow-blue-500/30 disabled:shadow-none"
      >
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}

