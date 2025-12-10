import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Verify the user has access to this file by checking if it belongs to their restaurant
    // Extract restaurant slug from path (format: {slug}/{submissionId}/{filename})
    const pathParts = filePath.split('/')
    if (pathParts.length < 3) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }

    const restaurantSlug = pathParts[0]
    const submissionId = pathParts[1]

    // Get the restaurant ID from slug
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .single()

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    // TypeScript type guard - restaurant is guaranteed to exist here
    const restaurantData = restaurant as { id: string }

    // Verify the manager has access to this restaurant
    const { data: managerUser } = await supabase
      .from('manager_users')
      .select('restaurant_id')
      .eq('manager_id', userId)
      .eq('restaurant_id', restaurantData.id)
      .single()

    if (!managerUser) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Verify the photo belongs to a submission from this restaurant
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select(`
        submission_id,
        submissions!inner(restaurant_id)
      `)
      .eq('file_path', filePath)
      .single()

    if (photoError || !photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      )
    }

    // TypeScript type guard - photo is guaranteed to exist here
    type PhotoWithSubmission = {
      submission_id: string
      submissions: {
        restaurant_id: string
      }
    }
    const photoData = photo as PhotoWithSubmission
    const submission = photoData.submissions as any
    if (!submission || submission.restaurant_id !== restaurantData.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('submissions')
      .createSignedUrl(filePath, 3600)

    if (signedUrlError || !signedUrlData) {
      return NextResponse.json(
        { error: signedUrlError?.message || 'Failed to generate signed URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
    })
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
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Verify the user has access to this file by checking if it belongs to their restaurant
    // Extract restaurant slug from path (format: {slug}/{submissionId}/{filename})
    const pathParts = filePath.split('/')
    if (pathParts.length < 3) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }

    const restaurantSlug = pathParts[0]
    const submissionId = pathParts[1]

    // Get the restaurant ID from slug
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', restaurantSlug)
      .single()

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    // TypeScript type guard - restaurant is guaranteed to exist here
    const restaurantData = restaurant as { id: string }

    // Verify the manager has access to this restaurant
    const { data: managerUser } = await supabase
      .from('manager_users')
      .select('restaurant_id')
      .eq('manager_id', userId)
      .eq('restaurant_id', restaurantData.id)
      .single()

    if (!managerUser) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Verify the photo belongs to a submission from this restaurant
    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select(`
        submission_id,
        submissions!inner(restaurant_id)
      `)
      .eq('file_path', filePath)
      .single()

    if (photoError || !photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      )
    }

    // TypeScript type guard - photo is guaranteed to exist here
    type PhotoWithSubmission = {
      submission_id: string
      submissions: {
        restaurant_id: string
      }
    }
    const photoData = photo as PhotoWithSubmission
    const submission = photoData.submissions as any
    if (!submission || submission.restaurant_id !== restaurantData.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('submissions')
      .createSignedUrl(filePath, 3600)

    if (signedUrlError || !signedUrlData) {
      return NextResponse.json(
        { error: signedUrlError?.message || 'Failed to generate signed URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

