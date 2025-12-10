import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filePath = searchParams.get('path')
    const slug = searchParams.get('slug')

    if (!filePath || !slug) {
      return NextResponse.json(
        { error: 'File path and slug are required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Verify the photo belongs to a submission with allow_marketing = true
    const pathParts = filePath.split('/')
    if (pathParts.length < 3) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }

    const restaurantSlug = pathParts[0]
    const submissionId = pathParts[1]

    // Verify restaurant slug matches
    if (restaurantSlug !== slug) {
      return NextResponse.json(
        { error: 'Invalid restaurant' },
        { status: 403 }
      )
    }

    // Get restaurant ID
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    // Verify the photo belongs to a submission with allow_marketing = true
    const { data: photo } = await supabase
      .from('photos')
      .select(`
        id,
        submissions!inner(allow_marketing, restaurant_id)
      `)
      .eq('file_path', filePath)
      .eq('submissions.restaurant_id', (restaurant as { id: string }).id)
      .eq('submissions.allow_marketing', true)
      .single()

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found or not available for public viewing' },
        { status: 404 }
      )
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('submissions')
      .createSignedUrl(filePath, 3600)

    if (urlError || !signedUrlData) {
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: signedUrlData.signedUrl })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}







import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filePath = searchParams.get('path')
    const slug = searchParams.get('slug')

    if (!filePath || !slug) {
      return NextResponse.json(
        { error: 'File path and slug are required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Verify the photo belongs to a submission with allow_marketing = true
    const pathParts = filePath.split('/')
    if (pathParts.length < 3) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }

    const restaurantSlug = pathParts[0]
    const submissionId = pathParts[1]

    // Verify restaurant slug matches
    if (restaurantSlug !== slug) {
      return NextResponse.json(
        { error: 'Invalid restaurant' },
        { status: 403 }
      )
    }

    // Get restaurant ID
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    // Verify the photo belongs to a submission with allow_marketing = true
    const { data: photo } = await supabase
      .from('photos')
      .select(`
        id,
        submissions!inner(allow_marketing, restaurant_id)
      `)
      .eq('file_path', filePath)
      .eq('submissions.restaurant_id', (restaurant as { id: string }).id)
      .eq('submissions.allow_marketing', true)
      .single()

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found or not available for public viewing' },
        { status: 404 }
      )
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('submissions')
      .createSignedUrl(filePath, 3600)

    if (urlError || !signedUrlData) {
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: signedUrlData.signedUrl })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}







