import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { restaurantId, menuUrl } = await request.json()
    
    if (!restaurantId) {
      return NextResponse.json(
        { error: 'Missing restaurantId' },
        { status: 400 }
      )
    }

    if (!menuUrl || !menuUrl.trim()) {
      return NextResponse.json(
        { error: 'Menu URL is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    
    // Verify user owns this restaurant
    const { data: managerUser } = await supabase
      .from('manager_users')
      .select('restaurant_id')
      .eq('manager_id', userId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!managerUser) {
      return NextResponse.json(
        { error: 'Unauthorized - you do not own this restaurant' },
        { status: 403 }
      )
    }
    
    // Check if menu source already exists
    const { data: existingSource } = await (supabase
      .from('menu_sources') as any)
      .select('id')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let menuSourceId: string

    if (existingSource) {
      // Update existing menu source
      const { data: updated, error: updateError } = await (supabase
        .from('menu_sources') as any)
        .update({
          source_url: menuUrl.trim(),
          status: 'pending'
        })
        .eq('id', existingSource.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating menu source:', updateError)
        return NextResponse.json(
          { error: 'Failed to update menu URL' },
          { status: 500 }
        )
      }

      menuSourceId = updated.id
      console.log('Updated existing menu source:', menuSourceId)
    } else {
      // Create new menu source
      const { data: created, error: createError } = await (supabase
        .from('menu_sources') as any)
        .insert({
          restaurant_id: restaurantId,
          source_type: 'url',
          source_url: menuUrl.trim(),
          status: 'pending'
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating menu source:', createError)
        return NextResponse.json(
          { error: 'Failed to create menu source' },
          { status: 500 }
        )
      }

      menuSourceId = created.id
      console.log('Created new menu source:', menuSourceId)
    }

    // Trigger menu processing - use await to ensure it starts
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   request.headers.get('origin') || 
                   'http://localhost:3000'
    
    console.log('Triggering menu processing for:', { restaurantId, menuSourceId, baseUrl })
    
    // Don't await - fire and forget, but log the result
    fetch(`${baseUrl}/api/menu/process`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // Forward authorization if available
        ...(request.headers.get('authorization') && {
          'authorization': request.headers.get('authorization')!
        })
      },
      body: JSON.stringify({ restaurantId, menuSourceId })
    })
    .then(async (response) => {
      const text = await response.text()
      console.log('Menu processing response:', response.status, text.substring(0, 500))
      if (!response.ok) {
        console.error('Menu processing failed:', text)
      }
    })
    .catch(err => {
      console.error('Failed to trigger menu processing:', err.message || err)
    })

    return NextResponse.json({ 
      success: true,
      message: 'Menu URL saved and processing started'
    })
  } catch (error: any) {
    console.error('Update menu URL error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

