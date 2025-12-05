import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Manual endpoint to reprocess menu for a restaurant
export async function POST(request: NextRequest) {
  try {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { restaurantId } = await request.json()
    
    if (!restaurantId) {
      return NextResponse.json(
        { error: 'Missing restaurantId' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()
    
    // Get the most recent pending or failed menu source for this restaurant
    const { data: menuSource, error: menuSourceError } = await (supabase
      .from('menu_sources') as any)
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (menuSourceError || !menuSource) {
      return NextResponse.json(
        { error: 'No menu source found for this restaurant' },
        { status: 404 }
      )
    }

    // Trigger menu processing
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000'
    const processUrl = `${baseUrl}/api/menu/process`
    
    const response = await fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        restaurantId: restaurantId, 
        menuSourceId: menuSource.id 
      })
    })

    const result = await response.json()
    
    return NextResponse.json({
      success: response.ok,
      message: response.ok ? 'Menu processing triggered' : 'Menu processing failed',
      result
    })
  } catch (error: any) {
    console.error('Reprocess menu error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


