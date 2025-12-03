import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    let slug: string
    try {
      const resolvedParams = await params
      slug = resolvedParams.slug
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request parameters', photos: [] },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Get restaurant by slug
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    // TypeScript type guard
    const restaurantData = restaurant as { id: string }

    // Get submissions with photos (only those with allow_marketing = true for public display)
    // Also include recent submissions (last 5 minutes) to show immediately after upload
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select(`
        id,
        created_at,
        instagram_handle,
        feedback,
        rating,
        allow_marketing,
        photos(id, file_path)
      `)
      .eq('restaurant_id', restaurantData.id)
      .or(`allow_marketing.eq.true,created_at.gte.${fiveMinutesAgo}`)
      .order('created_at', { ascending: false })
      .limit(100)

    if (submissionsError) {
      console.error('Submissions error:', submissionsError)
      // If rating column doesn't exist, try without it
      if (submissionsError.message?.includes('rating') || submissionsError.message?.includes('column')) {
        const { data: submissionsRetry, error: retryError } = await supabase
          .from('submissions')
          .select(`
            id,
            created_at,
            instagram_handle,
            feedback,
            allow_marketing,
            photos(id, file_path)
          `)
          .eq('restaurant_id', restaurantData.id)
          .or(`allow_marketing.eq.true,created_at.gte.${fiveMinutesAgo}`)
          .order('created_at', { ascending: false })
          .limit(100)
        
        if (retryError) {
          return NextResponse.json(
            { error: 'Failed to fetch photos', photos: [] },
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          )
        }
        
        // Use retry data without rating
        const photos = (submissionsRetry || [])
          .filter((submission: any) => {
            const isRecent = new Date(submission.created_at) >= new Date(fiveMinutesAgo)
            return submission.allow_marketing === true || isRecent
          })
          .flatMap((submission: any) =>
            (submission.photos || []).map((photo: any) => ({
              id: photo.id,
              file_path: photo.file_path,
              created_at: submission.created_at,
              instagram_handle: submission.instagram_handle || null,
              feedback: submission.feedback || null,
              rating: null,
            }))
          )
        
        return NextResponse.json({ photos: photos || [] }, {
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch photos', photos: [] },
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Flatten photos with submission info
    // Include photos from submissions with allow_marketing = true OR recent submissions (last 5 minutes)
    const photos = (submissions || [])
      .filter((submission: any) => {
        const isRecent = new Date(submission.created_at) >= new Date(fiveMinutesAgo)
        return submission.allow_marketing === true || isRecent
      })
      .flatMap((submission: any) =>
        (submission.photos || []).map((photo: any) => ({
          id: photo.id,
          file_path: photo.file_path,
          created_at: submission.created_at,
          instagram_handle: submission.instagram_handle || null,
          feedback: submission.feedback || null,
          rating: submission.rating || null,
        }))
      )

    return NextResponse.json({ photos: photos || [] }, {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Photos API error:', error)
    return NextResponse.json(
      { 
        error: error?.message || 'Internal server error',
        photos: []
      },
      { status: 500 }
    )
  }
}

