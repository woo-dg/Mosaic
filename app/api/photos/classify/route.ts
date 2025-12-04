import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

export async function POST(request: NextRequest) {
  try {
    const { photoId, restaurantId, imageUrl } = await request.json()
    
    if (!photoId || !restaurantId || !imageUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const supabase = createServerClient()
    
    // Get menu items for this restaurant
    const { data: menuItems, error: menuItemsError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
    
    if (menuItemsError || !menuItems || menuItems.length === 0) {
      // No menu items, skip classification
      return NextResponse.json({ 
        menuItemId: null,
        reason: 'no_menu_items'
      })
    }
    
    // STEP 1: Check if image contains food (using cheaper model)
    const foodDetection = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using cheaper model
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this restaurant photo. Does it show a food item or dish that could be on a menu? 
            
Return ONLY a JSON object with this format:
{
  "isFood": true/false
}

Return "true" only if it's clearly a food item/dish. Return "false" for drinks, people, ambiance, or anything else.`
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }],
      response_format: { type: 'json_object' },
      max_tokens: 20
    })
    
    const detectionResult = JSON.parse(foodDetection.choices[0].message.content || '{"isFood": false}')
    
    // If not food, skip classification
    if (!detectionResult.isFood) {
      return NextResponse.json({ 
        menuItemId: null,
        reason: 'not_food'
      })
    }
    
    // STEP 2: Identify the specific dish
    const menuItemsList = menuItems.map(item => 
      `- ${item.name}${item.category ? ` (${item.category})` : ''}${item.description ? `: ${item.description}` : ''}`
    ).join('\n')
    
    const classification = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using cheaper model
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `This is a photo of a food dish from a restaurant. Identify what dish/food item this is. Here are the menu items available:

${menuItemsList}

Return ONLY a JSON object with this format:
{
  "menuItemName": "exact menu item name that matches" or null
}

If the dish doesn't match any menu item, return null.`
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }],
      response_format: { type: 'json_object' },
      max_tokens: 50
    })
    
    const classificationResult = JSON.parse(classification.choices[0].message.content || '{"menuItemName": null}')
    const identifiedItemName = classificationResult.menuItemName?.trim().toLowerCase()
    
    if (!identifiedItemName) {
      return NextResponse.json({ 
        menuItemId: null,
        reason: 'no_match'
      })
    }
    
    // Find matching menu item (fuzzy match)
    const matchedItem = menuItems.find(item => {
      const itemNameLower = item.name.toLowerCase()
      return itemNameLower === identifiedItemName || 
             identifiedItemName.includes(itemNameLower) ||
             itemNameLower.includes(identifiedItemName)
    })
    
    if (matchedItem) {
      // Update photo with menu_item_id
      const { error: updateError } = await supabase
        .from('photos')
        .update({ menu_item_id: matchedItem.id })
        .eq('id', photoId)
      
      if (updateError) {
        console.error('Error updating photo with menu item:', updateError)
      }
      
      return NextResponse.json({ 
        menuItemId: matchedItem.id,
        menuItemName: matchedItem.name 
      })
    }
    
    return NextResponse.json({ 
      menuItemId: null,
      reason: 'no_match'
    })
  } catch (error: any) {
    console.error('Photo classification error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

