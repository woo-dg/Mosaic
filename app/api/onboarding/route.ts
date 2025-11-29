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
    const { name, slug } = body

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

    // Create manager_users mapping
    const { error: managerError } = await supabase
      .from('manager_users')
      .insert({
        manager_id: userId,
        restaurant_id: restaurant.id,
      } as any)

    if (managerError) {
      // Rollback: delete restaurant if manager mapping fails
      await supabase.from('restaurants').delete().eq('id', restaurant.id)
      return NextResponse.json(
        { error: managerError.message || 'Failed to link manager' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, restaurant })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

