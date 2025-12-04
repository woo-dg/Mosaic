import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, slug, menuUrl } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Check if slug already exists
    const { data: existing } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'This slug is already taken' },
        { status: 400 }
      )
    }

    // Check if user already has a restaurant
    const { data: existingManager } = await supabase
      .from('manager_users')
      .select('restaurant_id')
      .eq('manager_id', userId)
      .single()

    if (existingManager) {
      return NextResponse.json(
        { error: 'You already have a restaurant' },
        { status: 400 }
      )
    }

    // Create restaurant
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .insert({
        name: name.trim(),
        slug: slug.trim(),
      } as any)
      .select()
      .single()

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        { error: restaurantError?.message || 'Failed to create restaurant' },
        { status: 500 }
      )
    }

    // TypeScript type guard - restaurant is guaranteed to exist here
    type Restaurant = { id: string; name: string; slug: string }
    const restaurantData: Restaurant = restaurant as Restaurant

    // Create manager_users mapping
    const { error: managerError } = await supabase
      .from('manager_users')
      .insert({
        manager_id: userId,
        restaurant_id: restaurantData.id,
      } as any)

    if (managerError) {
      // Rollback: delete restaurant if manager mapping fails
      await supabase.from('restaurants').delete().eq('id', restaurantData.id)
      return NextResponse.json(
        { error: managerError.message || 'Failed to link manager' },
        { status: 500 }
      )
    }

    // If menu URL provided, create menu source and trigger processing
    if (menuUrl && menuUrl.trim()) {
      const menuSourceResult = await (supabase
        .from('menu_sources') as any)
        .insert({
          restaurant_id: restaurantData.id,
          source_type: 'url',
          source_url: menuUrl.trim(),
          status: 'pending',
        })
        .select()
        .single()

      if (!menuSourceResult.error && menuSourceResult.data) {
        const menuSourceId = (menuSourceResult.data as any).id
        console.log('Menu source created:', { restaurantId: restaurantData.id, menuSourceId, menuUrl: menuUrl.trim() })
        
        // Trigger async menu processing (don't wait for it)
        // Use absolute URL to ensure it works in production
        const origin = request.headers.get('origin') || request.headers.get('host')
        const protocol = request.headers.get('x-forwarded-proto') || 'https'
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                       (origin ? `${protocol}://${origin}` : 'http://localhost:3000')
        const processUrl = `${baseUrl}/api/menu/process`
        console.log('Triggering menu processing:', processUrl, { restaurantId: restaurantData.id, menuSourceId })
        
        // Don't await - fire and forget, but log errors
        fetch(processUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            // Forward auth if needed
            ...(request.headers.get('authorization') && { 
              'authorization': request.headers.get('authorization')! 
            })
          },
          body: JSON.stringify({ restaurantId: restaurantData.id, menuSourceId })
        })
        .then(async (response) => {
          if (!response.ok) {
            const text = await response.text()
            console.error('Menu processing failed:', response.status, text.substring(0, 500))
          } else {
            const result = await response.json()
            console.log('Menu processing started successfully:', result)
          }
        })
        .catch(err => {
          console.error('Failed to trigger menu processing:', err.message || err)
        })
      } else {
        console.error('Failed to create menu source:', menuSourceResult.error)
      }
    }

    return NextResponse.json({ success: true, restaurant: restaurantData })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

