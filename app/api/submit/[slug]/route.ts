import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    let slug: string
    try {
      const resolvedParams = await params
      slug = resolvedParams.slug
    } catch (error: any) {
      console.error('Error resolving params:', error)
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createServerClient()
    
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to parse form data' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const restaurantId = formData.get('restaurantId') as string
    const restaurantSlug = formData.get('restaurantSlug') as string
    const feedback = formData.get('feedback') as string | null
    const instagramHandle = formData.get('instagramHandle') as string | null
    const rating = formData.get('rating') ? parseInt(formData.get('rating') as string) : null
    const agreedPrivate = formData.get('agreedPrivate') === 'true'
    const allowMarketing = formData.get('allowMarketing') === 'true'
    const images = formData.getAll('images') as File[]

    if (!restaurantId || !restaurantSlug) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate restaurant slug matches
    if (restaurantSlug !== slug) {
      return NextResponse.json(
        { error: 'Invalid restaurant' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate required fields
    if (!agreedPrivate) {
      return NextResponse.json(
        { error: 'Consent is required' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'At least one image is required' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (images.length > 3) {
      return NextResponse.json(
        { error: 'Maximum 3 images allowed' },
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate file types and sizes
    for (const image of images) {
      if (!image.type.startsWith('image/')) {
        return NextResponse.json(
          { error: 'Only image files are allowed' },
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
      if (image.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Each image must be less than 5MB' },
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // Verify restaurant exists
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .eq('id', restaurantId)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // TypeScript type guard - restaurant is guaranteed to exist here
    const restaurantData = restaurant as { id: string }

    // Create submission
    const submissionId = uuidv4()
    
    // Try to insert with rating first, fallback to without rating if column doesn't exist
    let submissionData: any = {
      id: submissionId,
      restaurant_id: restaurantData.id,
      feedback: feedback?.trim() || null,
      instagram_handle: instagramHandle?.trim() || null,
      allow_marketing: allowMarketing,
      agreed_private: true,
    }
    
    // Add rating if provided
    if (rating !== null && rating !== undefined) {
      submissionData.rating = rating
    }
    
    let { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .insert(submissionData as any)
      .select()
      .single()

    // If error is about rating column, try without it
    if (submissionError && (submissionError.message?.includes('rating') || submissionError.message?.includes('column'))) {
      console.warn('Rating column not found, creating submission without rating')
      const { rating: _, ...submissionDataWithoutRating } = submissionData
      const retryResult = await supabase
        .from('submissions')
        .insert(submissionDataWithoutRating as any)
        .select()
        .single()
      
      submission = retryResult.data
      submissionError = retryResult.error
    }

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: submissionError?.message || 'Failed to create submission' },
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Upload images and create photo records
    const uploadedPhotos = []
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      const fileExt = image.name.split('.').pop()
      const fileName = `${uuidv4()}.${fileExt}`
      const filePath = `${restaurantSlug}/${submissionId}/${fileName}`

      // Convert File to ArrayBuffer
      const arrayBuffer = await image.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, buffer, {
          contentType: image.type,
          upsert: false,
        })

      if (uploadError) {
        // Clean up: delete submission if upload fails
        await supabase.from('submissions').delete().eq('id', submissionId)
        return NextResponse.json(
          { error: uploadError.message || 'Failed to upload image' },
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      // Create photo record
      const { data: photoData, error: photoError } = await supabase
        .from('photos')
        .insert({
          submission_id: submissionId,
          file_path: filePath,
        } as any)
        .select()
        .single()

      if (photoError || !photoData) {
        // Clean up: delete uploaded file and submission
        await supabase.storage.from('submissions').remove([filePath])
        await supabase.from('submissions').delete().eq('id', submissionId)
        return NextResponse.json(
          { error: photoError?.message || 'Failed to save photo record' },
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      // Get signed URL for classification (async, don't wait)
      const signedUrlResult = await supabase.storage
        .from('submissions')
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      const photoId = (photoData as any).id
      if (signedUrlResult.data?.signedUrl && photoId) {
        // Trigger async classification (don't wait for it)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                       request.headers.get('origin') || 
                       'http://localhost:3000'
        
        fetch(`${baseUrl}/api/photos/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photoId: photoId,
            restaurantId: restaurantData.id,
            imageUrl: signedUrlResult.data.signedUrl
          })
        }).catch(err => console.error('Failed to trigger photo classification:', err))
      }

      uploadedPhotos.push(filePath)
    }

    return NextResponse.json({
      success: true,
      submissionId: submissionId,
    }, {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Submit error:', error)
    return NextResponse.json(
      { 
        error: error?.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

