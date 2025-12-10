'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useParams } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/supabase/auth-client'
import { useAuth } from '@clerk/nextjs'
import Image from 'next/image'

interface Photo {
  id: string
  file_path: string
}

interface Submission {
  id: string
  created_at: string
  instagram_handle: string | null
  feedback: string | null
  allow_marketing: boolean
  photos: Photo[]
}

export default function SubmissionDetailPage() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const router = useRouter()
  const params = useParams()
  const submissionId = params.id as string
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      router.push('/sign-in')
      return
    }

    loadSubmission()
  }, [user, isLoaded, submissionId])

  const loadSubmission = async () => {
    if (!user) return

    try {
      const token = await getToken()
      const supabase = await createAuthenticatedClient(token)
      
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          created_at,
          instagram_handle,
          feedback,
          allow_marketing,
          photos(id, file_path)
        `)
        .eq('id', submissionId)
        .single()

      if (error || !data) {
        console.error('Error loading submission:', error)
        router.push('/dashboard')
        return
      }

      // TypeScript type guard - data is guaranteed to exist here
      const submissionData = data as Submission
      setSubmission(submissionData)

      // Load signed URLs for all photos
      const urls: Record<string, string> = {}
      for (const photo of submissionData.photos) {
        try {
          const response = await fetch(`/api/sign-url?path=${encodeURIComponent(photo.file_path)}`)
          const urlData = await response.json()
          if (urlData.url) {
            urls[photo.id] = urlData.url
          }
        } catch (error) {
          console.error('Error loading image URL:', error)
        }
      }
      setImageUrls(urls)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (filePath: string, photoId: string) => {
    const url = imageUrls[photoId]
    if (!url) {
      // Get signed URL if not already loaded
      try {
        const response = await fetch(`/api/sign-url?path=${encodeURIComponent(filePath)}`)
        const data = await response.json()
        if (data.url) {
          window.open(data.url, '_blank')
        }
      } catch (error) {
        console.error('Error getting download URL:', error)
      }
    } else {
      window.open(url, '_blank')
    }
  }

  const handleCopyLink = async (filePath: string, photoId: string) => {
    let url = imageUrls[photoId]
    if (!url) {
      // Get signed URL if not already loaded
      try {
        const response = await fetch(`/api/sign-url?path=${encodeURIComponent(filePath)}`)
        const data = await response.json()
        if (data.url) {
          url = data.url
          setImageUrls(prev => ({ ...prev, [photoId]: url }))
        }
      } catch (error) {
        console.error('Error getting URL:', error)
        return
      }
    }

    if (url) {
      await navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (!user || !submission) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-6 text-blue-600 hover:text-blue-800 flex items-center"
        >
          ← Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Submission Details</h1>
            <p className="text-gray-600">
              Submitted on {new Date(submission.created_at).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          {/* Photos Gallery */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Photos ({submission.photos.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {submission.photos.map((photo) => (
                <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                  {imageUrls[photo.id] ? (
                    <Image
                      src={imageUrls[photo.id]}
                      alt={`Photo ${photo.id}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-gray-400">Loading...</div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2 flex gap-2">
                    <button
                      onClick={() => handleDownload(photo.file_path, photo.id)}
                      className="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleCopyLink(photo.file_path, photo.id)}
                      className="flex-1 bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback */}
          {submission.feedback && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Feedback</h2>
              <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                {submission.feedback}
              </p>
            </div>
          )}

          {/* Instagram Handle */}
          {submission.instagram_handle && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Instagram Handle</h2>
              <p className="text-gray-700">
                <a
                  href={`https://instagram.com/${submission.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  @{submission.instagram_handle}
                </a>
              </p>
            </div>
          )}

          {/* Consent Info */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Consent Information</h2>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                {submission.allow_marketing ? (
                  <>
                    <span className="text-green-600">✓</span>
                    <span className="text-gray-700">Marketing use allowed</span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-400">✗</span>
                    <span className="text-gray-700">Marketing use not allowed</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

