import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const restaurantId = formData.get('restaurantId') as string
    const imageFile = formData.get('image') as File

    if (!restaurantId || !imageFile) {
      return NextResponse.json(
        { error: 'Restaurant ID and image are required' },
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

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    console.log('Parsing menu image for restaurant:', restaurantId)

    // Use OpenAI Vision to parse menu
    let menuParse
    try {
      menuParse = await openai.chat.completions.create({
        model: 'gpt-4o', // Use GPT-4o for better vision capabilities
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `This is a photo of a restaurant menu. Extract ALL menu items from this menu image.

For each menu item, identify:
- Name (required)
- Category (if visible, e.g., "Appetizers", "Entrees", "Desserts")
- Description (if visible)
- Price (if visible)

Return a JSON object with a "menuItems" array in this exact format:
{
  "menuItems": [
    {
      "name": "Item Name",
      "category": "Category Name or null",
      "description": "Description or null",
      "price": "Price or null"
    }
  ]
}

Extract as many items as you can see. Be thorough and accurate. If an item has variations (e.g., "Steak Burrito", "Chicken Burrito"), list them as separate items.`
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl }
            }
          ]
        }],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        temperature: 0.1
      })
    } catch (error: any) {
      console.error('OpenAI Vision API error:', error)
      return NextResponse.json(
        { error: `Failed to parse menu image: ${error.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    const parseContent = menuParse.choices[0].message.content
    if (!parseContent) {
      return NextResponse.json(
        { error: 'Failed to parse menu - no response from AI' },
        { status: 500 }
      )
    }

    // Parse the JSON response
    let parsedData
    try {
      parsedData = JSON.parse(parseContent)
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseContent)
      return NextResponse.json(
        { error: 'Failed to parse menu - invalid response format' },
        { status: 500 }
      )
    }

    // Extract menu items array (handle both direct array and wrapped in object)
    let menuItems: Array<{
      name: string
      category?: string | null
      description?: string | null
      price?: string | null
    }> = []

    if (Array.isArray(parsedData)) {
      menuItems = parsedData
    } else if (parsedData.menuItems && Array.isArray(parsedData.menuItems)) {
      menuItems = parsedData.menuItems
    } else if (parsedData.items && Array.isArray(parsedData.items)) {
      menuItems = parsedData.items
    } else {
      // Try to find any array in the response
      const keys = Object.keys(parsedData)
      for (const key of keys) {
        if (Array.isArray(parsedData[key])) {
          menuItems = parsedData[key]
          break
        }
      }
    }

    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      console.error('No menu items found in response:', parsedData)
      return NextResponse.json(
        { error: 'No menu items found in the image. Please ensure the menu is clearly visible.' },
        { status: 400 }
      )
    }

    // Filter and validate menu items
    const validMenuItems = menuItems
      .filter(item => item.name && typeof item.name === 'string' && item.name.trim().length > 0)
      .map(item => ({
        name: item.name.trim(),
        category: item.category?.trim() || null,
        description: item.description?.trim() || null,
        price: item.price?.trim() || null,
      }))

    if (validMenuItems.length === 0) {
      return NextResponse.json(
        { error: 'No valid menu items found in the image.' },
        { status: 400 }
      )
    }

    console.log(`Extracted ${validMenuItems.length} menu items from image`)

    // Return the parsed items (don't save yet - let user review first)
    return NextResponse.json({
      success: true,
      menuItems: validMenuItems,
      count: validMenuItems.length
    })
  } catch (error: any) {
    console.error('Menu image parsing error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

