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
    const { restaurantId, name, category, description, price } = body

    if (!restaurantId || !name) {
      return NextResponse.json(
        { error: 'Restaurant ID and name are required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Verify user owns this restaurant
    const { data: manager } = await supabase
      .from('manager_users')
      .select('restaurant_id')
      .eq('manager_id', userId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!manager) {
      return NextResponse.json(
        { error: 'Unauthorized - you do not own this restaurant' },
        { status: 403 }
      )
    }

    // Insert menu item (upsert to avoid duplicates)
    const { data: menuItem, error: insertError } = await (supabase
      .from('menu_items') as any)
      .insert({
        restaurant_id: restaurantId,
        name: name.trim(),
        category: category?.trim() || null,
        description: description?.trim() || null,
        price: price?.trim() || null,
      })
      .select()
      .single()

    if (insertError) {
      // If duplicate, try to update instead
      if (insertError.code === '23505') {
        const { data: updatedItem, error: updateError } = await (supabase
          .from('menu_items') as any)
          .update({
            category: category?.trim() || null,
            description: description?.trim() || null,
            price: price?.trim() || null,
          })
          .eq('restaurant_id', restaurantId)
          .eq('name', name.trim())
          .select()
          .single()

        if (updateError) {
          return NextResponse.json(
            { error: updateError.message || 'Failed to update menu item' },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true, menuItem: updatedItem })
      }

      return NextResponse.json(
        { error: insertError.message || 'Failed to create menu item' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, menuItem })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get('restaurantId')

    if (!restaurantId) {
      return NextResponse.json(
        { error: 'Restaurant ID is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Verify user owns this restaurant
    const { data: manager } = await supabase
      .from('manager_users')
      .select('restaurant_id')
      .eq('manager_id', userId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!manager) {
      return NextResponse.json(
        { error: 'Unauthorized - you do not own this restaurant' },
        { status: 403 }
      )
    }

    // Get all menu items for this restaurant
    const { data: menuItems, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to fetch menu items' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, menuItems: menuItems || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { restaurantId, menuItemId } = body

    if (!restaurantId || !menuItemId) {
      return NextResponse.json(
        { error: 'Restaurant ID and menu item ID are required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Verify user owns this restaurant
    const { data: manager } = await supabase
      .from('manager_users')
      .select('restaurant_id')
      .eq('manager_id', userId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (!manager) {
      return NextResponse.json(
        { error: 'Unauthorized - you do not own this restaurant' },
        { status: 403 }
      )
    }

    // Delete menu item
    const { error: deleteError } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', menuItemId)
      .eq('restaurant_id', restaurantId)

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete menu item' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

