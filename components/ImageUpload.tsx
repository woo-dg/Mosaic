'use client'

import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'

interface ImageUploadProps {
  maxImages?: number
  onImagesChange: (files: File[]) => void
}

export default function ImageUpload({ maxImages = 3, onImagesChange }: ImageUploadProps) {
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [compressing, setCompressing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    // Accept both images and videos
    const mediaFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/')
    )
    
    if (mediaFiles.length === 0) {
      setError('Please capture a photo or video')
      return
    }

    setCompressing(true)
    setError(null)

    try {
      const compressionOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1400,
        initialQuality: 0.7,
        useWebWorker: true,
      }

      const processedFiles: File[] = []
      
      for (const file of mediaFiles) {
        // Only compress images, not videos
        if (file.type.startsWith('image/')) {
          try {
            const compressedFile = await imageCompression(file, compressionOptions)
            
            // Check if compressed file is still too large (>3MB)
            if (compressedFile.size > 3 * 1024 * 1024) {
              setError(`Image "${file.name}" is too large even after compression. Please try again.`)
              continue
            }
            
            processedFiles.push(compressedFile)
          } catch (compressionError) {
            console.error('Error compressing image:', compressionError)
            setError(`Failed to process "${file.name}". Please try again.`)
          }
        } else if (file.type.startsWith('video/')) {
          // For videos, just add them directly (no compression)
          // Check size limit (e.g., 50MB)
          if (file.size > 50 * 1024 * 1024) {
            setError(`Video "${file.name}" is too large. Please try a shorter video.`)
            continue
          }
          processedFiles.push(file)
        }
      }

      if (processedFiles.length === 0) {
        setError('No media could be processed. Please try again.')
        setCompressing(false)
        return
      }

      const newImages = [...images, ...processedFiles].slice(0, maxImages)
      setImages(newImages)
      onImagesChange(newImages)

      // Create previews from processed files
      const newPreviews = newImages.map(file => URL.createObjectURL(file))
      // Clean up old previews
      previews.forEach(url => URL.revokeObjectURL(url))
      setPreviews(newPreviews)
    } catch (error) {
      console.error('Error processing media:', error)
      setError('Failed to process media. Please try again.')
    } finally {
      setCompressing(false)
    }
  }

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    const newPreviews = previews.filter((_, i) => i !== index)
    
    // Clean up URL
    URL.revokeObjectURL(previews[index])
    
    setImages(newImages)
    setPreviews(newPreviews)
    onImagesChange(newImages)
    setError(null)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
          Capture Media ({images.length}/{maxImages})
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/3gpp"
          capture="environment"
          multiple={maxImages > 1}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleClick}
          disabled={images.length >= maxImages || compressing}
          className="w-full py-6 sm:py-8 px-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 active:border-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation bg-gray-50 hover:bg-gray-100"
        >
          <div className="text-center">
            <svg
              className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="mt-2 text-sm sm:text-base text-gray-600 font-medium">
              {compressing
                ? 'Processing...'
                : images.length >= maxImages
                ? 'Maximum reached'
                : 'Take Photo/Video Now'}
            </p>
          </div>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm">
              {images[index]?.type.startsWith('video/') ? (
                <video
                  src={preview}
                  className="w-full h-full object-cover"
                  controls={false}
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-base sm:text-lg font-bold hover:bg-red-600 active:bg-red-700 touch-manipulation shadow-lg"
                aria-label="Remove media"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
