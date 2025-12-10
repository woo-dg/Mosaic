'use client'

import { useState, useRef, useEffect } from 'react'
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
  const [capturing, setCapturing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

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

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCapturing(false)
  }

  const captureFromCamera = async (isVideo: boolean = false) => {
    // Prevent multiple camera sessions
    if (capturing) return
    
    try {
      setError(null)
      setCapturing(true)

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: isVideo // Only request audio for video
      })

      streamRef.current = stream

      // Create video element to show camera preview
      if (!videoRef.current) {
        const video = document.createElement('video')
        video.autoplay = true
        video.playsInline = true
        video.style.width = '100%'
        video.style.height = '100%'
        video.style.objectFit = 'cover'
        videoRef.current = video
      }

      videoRef.current.srcObject = stream

      // Create a modal/overlay for camera preview
      const overlay = document.createElement('div')
      overlay.style.position = 'fixed'
      overlay.style.top = '0'
      overlay.style.left = '0'
      overlay.style.width = '100%'
      overlay.style.height = '100%'
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)'
      overlay.style.zIndex = '9999'
      overlay.style.display = 'flex'
      overlay.style.flexDirection = 'column'
      overlay.style.alignItems = 'center'
      overlay.style.justifyContent = 'center'
      overlay.id = 'camera-overlay'

      const videoContainer = document.createElement('div')
      videoContainer.style.width = '100%'
      videoContainer.style.maxWidth = '100%'
      videoContainer.style.height = '70%'
      videoContainer.style.position = 'relative'
      videoContainer.style.display = 'flex'
      videoContainer.style.alignItems = 'center'
      videoContainer.style.justifyContent = 'center'
      videoContainer.style.overflow = 'hidden'

      videoContainer.appendChild(videoRef.current)
      overlay.appendChild(videoContainer)

      // Create canvas for capturing
      if (!canvasRef.current) {
        const canvas = document.createElement('canvas')
        canvasRef.current = canvas
      }

      // Create buttons
      const buttonContainer = document.createElement('div')
      buttonContainer.style.display = 'flex'
      buttonContainer.style.gap = '20px'
      buttonContainer.style.marginTop = '20px'
      buttonContainer.style.alignItems = 'center'
      buttonContainer.style.justifyContent = 'center'

      const captureButton = document.createElement('button')
      captureButton.textContent = isVideo ? 'Start Recording' : 'Capture Photo'
      captureButton.style.width = '80px'
      captureButton.style.height = '80px'
      captureButton.style.borderRadius = '50%'
      captureButton.style.backgroundColor = '#fff'
      captureButton.style.border = '4px solid #000'
      captureButton.style.cursor = 'pointer'
      captureButton.style.fontSize = '14px'
      captureButton.style.fontWeight = 'bold'
      captureButton.style.color = '#000'

      const cancelButton = document.createElement('button')
      cancelButton.textContent = 'Cancel'
      cancelButton.style.padding = '12px 24px'
      cancelButton.style.backgroundColor = '#666'
      cancelButton.style.color = '#fff'
      cancelButton.style.border = 'none'
      cancelButton.style.borderRadius = '8px'
      cancelButton.style.cursor = 'pointer'
      cancelButton.style.fontSize = '16px'
      cancelButton.style.marginLeft = '20px'

      let recording = false
      let mediaRecorder: MediaRecorder | null = null
      let recordedChunks: Blob[] = []

      captureButton.onclick = async () => {
        if (isVideo) {
          if (!recording) {
            // Start recording
            recording = true
            captureButton.textContent = 'Stop Recording'
            captureButton.style.backgroundColor = '#f00'
            
            recordedChunks = []
            
            // Find supported mime type for Android
            let mimeType = 'video/webm'
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
              mimeType = 'video/webm;codecs=vp9'
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
              mimeType = 'video/webm;codecs=vp8'
            } else if (MediaRecorder.isTypeSupported('video/mp4')) {
              mimeType = 'video/mp4'
            }
            
            mediaRecorder = new MediaRecorder(stream, {
              mimeType: mimeType
            })
            
            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) {
                recordedChunks.push(e.data)
              }
            }
            
            mediaRecorder.onstop = async () => {
              const blob = new Blob(recordedChunks, { type: mimeType })
              const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
              const file = new File([blob], `video-${Date.now()}.${extension}`, { type: mimeType })
              await processCapturedFile(file)
              stopCamera()
              if (document.body.contains(overlay)) {
                document.body.removeChild(overlay)
              }
            }
            
            mediaRecorder.start()
          } else {
            // Stop recording
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop()
            }
          }
        } else {
          // Capture photo
          if (videoRef.current && canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth
            canvasRef.current.height = videoRef.current.videoHeight
            const ctx = canvasRef.current.getContext('2d')
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0)
              canvasRef.current.toBlob(async (blob) => {
                if (blob) {
                  const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
              await processCapturedFile(file)
              stopCamera()
              if (document.body.contains(overlay)) {
                document.body.removeChild(overlay)
              }
                }
              }, 'image/jpeg', 0.9)
            }
          }
        }
      }

      cancelButton.onclick = () => {
        stopCamera()
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay)
        }
      }
      
      // Also handle clicking outside the overlay to close
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          stopCamera()
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay)
          }
        }
      }

      buttonContainer.appendChild(captureButton)
      buttonContainer.appendChild(cancelButton)
      overlay.appendChild(buttonContainer)

      document.body.appendChild(overlay)

    } catch (err: any) {
      console.error('Error accessing camera:', err)
      setError(err.message || 'Could not access camera. Please allow camera permissions.')
      setCapturing(false)
      // Fallback to file input
      fileInputRef.current?.click()
    }
  }

  const processCapturedFile = async (file: File) => {
    setCompressing(true)
    setError(null)

    try {
      let processedFile: File = file

      // Compress images
      if (file.type.startsWith('image/')) {
        try {
          const compressionOptions = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1400,
            initialQuality: 0.7,
            useWebWorker: true,
          }
          processedFile = await imageCompression(file, compressionOptions)
          
          if (processedFile.size > 3 * 1024 * 1024) {
            setError('Image is too large even after compression. Please try again.')
            setCompressing(false)
            return
          }
        } catch (compressionError) {
          console.error('Error compressing image:', compressionError)
          setError('Failed to process image. Please try again.')
          setCompressing(false)
          return
        }
      } else if (file.type.startsWith('video/')) {
        if (file.size > 50 * 1024 * 1024) {
          setError('Video is too large. Please try a shorter video.')
          setCompressing(false)
          return
        }
      }

      const newImages = [...images, processedFile].slice(0, maxImages)
      setImages(newImages)
      onImagesChange(newImages)

      // Create preview
      const newPreviews = newImages.map(f => URL.createObjectURL(f))
      previews.forEach(url => URL.revokeObjectURL(url))
      setPreviews(newPreviews)
    } catch (error) {
      console.error('Error processing captured file:', error)
      setError('Failed to process media. Please try again.')
    } finally {
      setCompressing(false)
    }
  }

  const handleClick = () => {
    // Try to use camera API first, fallback to file input
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      captureFromCamera(false)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleVideoClick = () => {
    // Try to use camera API first, fallback to file input
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      captureFromCamera(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      // Clean up any overlay that might be left
      const overlay = document.getElementById('camera-overlay')
      if (overlay) {
        document.body.removeChild(overlay)
      }
    }
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
          Capture Media ({images.length}/{maxImages})
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          multiple={maxImages > 1}
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleClick}
            disabled={images.length >= maxImages || compressing || capturing}
            className="w-full py-6 sm:py-8 px-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 active:border-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation bg-gray-50 hover:bg-gray-100"
          >
            <div className="text-center">
              <svg
                className="mx-auto h-8 w-8 sm:h-10 sm:w-10 text-gray-400"
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
              <p className="mt-2 text-xs sm:text-sm text-gray-600 font-medium">
                {capturing ? 'Camera Active...' : 'Take Photo'}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={handleVideoClick}
            disabled={images.length >= maxImages || compressing || capturing}
            className="w-full py-6 sm:py-8 px-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 active:border-gray-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation bg-gray-50 hover:bg-gray-100"
          >
            <div className="text-center">
              <svg
                className="mx-auto h-8 w-8 sm:h-10 sm:w-10 text-gray-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
              <p className="mt-2 text-xs sm:text-sm text-gray-600 font-medium">
                {capturing ? 'Recording...' : 'Record Video'}
              </p>
            </div>
          </button>
        </div>
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
