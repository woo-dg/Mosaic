import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select(`
        id,
        created_at,
        instagram_handle,
        photos(id, file_path)
      `)
      .eq('restaurant_id', restaurantData.id)
      .eq('allow_marketing', true)
      .order('created_at', { ascending: false })
      .limit(100)

    if (submissionsError) {
      return NextResponse.json(
        { error: 'Failed to fetch photos' },
        { status: 500 }
      )
    }

    // Flatten photos with submission info
    const photos = (submissions || []).flatMap((submission: any) =>
      (submission.photos || []).map((photo: any) => ({
        id: photo.id,
        file_path: photo.file_path,
        created_at: submission.created_at,
        instagram_handle: submission.instagram_handle,
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

