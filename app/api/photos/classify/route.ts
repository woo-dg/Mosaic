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
    
    console.log('Photo classification request:', { photoId, restaurantId, imageUrl: imageUrl?.substring(0, 50) + '...' })
    
    if (!photoId || !restaurantId || !imageUrl) {
      console.error('Missing required fields for classification')
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const supabase = createServerClient()
    
    // Get menu items for this restaurant
    const menuItemsResult = await (supabase
      .from('menu_items') as any)
      .select('*')
      .eq('restaurant_id', restaurantId)
    
    console.log('Menu items query result:', { 
      error: menuItemsResult.error, 
      count: menuItemsResult.data?.length || 0 
    })
    
    if (menuItemsResult.error || !menuItemsResult.data || menuItemsResult.data.length === 0) {
      // No menu items, skip classification
      console.log('No menu items found for restaurant:', restaurantId)
      return NextResponse.json({ 
        menuItemId: null,
        reason: 'no_menu_items'
      })
    }
    
    const menuItems = menuItemsResult.data as Array<{
      id: string
      name: string
      category: string | null
      description: string | null
      price: string | null
    }>
    
    // STEP 1: Check if image contains food (using cheaper model)
    console.log('Starting food detection...')
    let foodDetection
    try {
      foodDetection = await openai.chat.completions.create({
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
    } catch (error: any) {
      console.error('Food detection API error:', error)
      // Continue anyway - assume it's food if API fails
      foodDetection = { choices: [{ message: { content: '{"isFood": true}' } }] }
    }
    
    const detectionResult = JSON.parse(foodDetection.choices[0].message.content || '{"isFood": false}')
    console.log('Food detection result:', detectionResult)
    
    // If not food, skip classification
    if (!detectionResult.isFood) {
      console.log('Image is not food, skipping classification')
      return NextResponse.json({ 
        menuItemId: null,
        reason: 'not_food'
      })
    }
    
    // STEP 2: Identify the specific dish
    console.log('Starting dish classification...')
    const menuItemsList = menuItems.map(item => 
      `- ${item.name}${item.category ? ` (${item.category})` : ''}${item.description ? `: ${item.description}` : ''}`
    ).join('\n')
    
    console.log('Menu items to match against:', menuItemsList.substring(0, 200) + '...')
    
    let classification
    try {
      classification = await openai.chat.completions.create({
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

IMPORTANT: Be very flexible with matching. Match based on the main food item, not exact wording:
- If photo shows "calamari" and menu has "Fried Calamari" or "Calamari Rings" → match it
- If photo shows "burrito" and menu has "Chicken Burrito" or "Steak Burrito" → match any burrito
- If photo shows "tacos" and menu has "Al Pastor Tacos" or "Chicken Tacos" → match any taco
- Match by the core food item name, even if modifiers differ

Return the FULL menu item name (e.g., "Fried Calamari" not just "Calamari"). If the dish doesn't match any menu item, return null.`
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }],
        response_format: { type: 'json_object' },
        max_tokens: 100,
        temperature: 0.3
      })
    } catch (error: any) {
      console.error('Classification API error:', error)
      return NextResponse.json({ 
        menuItemId: null,
        reason: 'api_error',
        error: error.message
      })
    }
    
    const classificationResult = JSON.parse(classification.choices[0].message.content || '{"menuItemName": null}')
    console.log('Classification result:', classificationResult)
    const identifiedItemName = classificationResult.menuItemName?.trim().toLowerCase()
    
    if (!identifiedItemName) {
      console.log('No menu item name identified')
      return NextResponse.json({ 
        menuItemId: null,
        reason: 'no_match'
      })
    }
    
    console.log('Looking for match for:', identifiedItemName)
    
    // First try exact match (AI might return the exact menu item name)
    let matchedItem = menuItems.find(item => 
      item.name.toLowerCase() === identifiedItemName
    )
    
    if (matchedItem) {
      console.log('Exact match found:', matchedItem.name)
    } else {
      // More flexible matching - check if menu item contains the identified name or vice versa
      matchedItem = menuItems.find(item => {
        const itemNameLower = item.name.toLowerCase()
        
        // Direct contains match (e.g., "fried calamari" contains "calamari")
        if (itemNameLower.includes(identifiedItemName) || identifiedItemName.includes(itemNameLower)) {
          return true
        }
        
        // Word-based match - check if key food words match
        const itemWords = itemNameLower.split(/\s+/).filter((w: string) => w.length > 3) // Filter out short words like "the", "and"
        const identifiedWords = identifiedItemName.split(/\s+/).filter((w: string) => w.length > 3)
        
        // Check if any significant word from identified matches any word in menu item
        const hasMatchingWord = identifiedWords.some((idWord: string) => 
          itemWords.some((itemWord: string) => {
            // Exact match
            if (itemWord === idWord) return true
            // Contains match
            if (itemWord.includes(idWord) || idWord.includes(itemWord)) return true
            // Handle plurals/singulars
            if ((itemWord.endsWith('s') && itemWord.slice(0, -1) === idWord) ||
                (idWord.endsWith('s') && idWord.slice(0, -1) === itemWord)) return true
            // Similar spelling (for cases like "calamari" vs "kalamari") - check if 80% of chars match
            const minLen = Math.min(itemWord.length, idWord.length)
            const maxLen = Math.max(itemWord.length, idWord.length)
            if (minLen >= 5 && maxLen <= minLen + 1) {
              let matches = 0
              for (let i = 0; i < minLen; i++) {
                if (itemWord[i] === idWord[i]) matches++
              }
              if (matches / minLen >= 0.8) return true
            }
            return false
          })
        )
        
        return hasMatchingWord
      })
      
      if (matchedItem) {
        console.log('Flexible match found:', matchedItem.name)
      }
    }
    
    console.log('Matched item:', matchedItem?.name || 'none')
    
    if (matchedItem) {
      console.log('Updating photo with menu item:', { photoId, menuItemId: matchedItem.id, menuItemName: matchedItem.name })
      
      // Update photo with menu_item_id
      const { error: updateError, data: updateData } = await (supabase
        .from('photos') as any)
        .update({ menu_item_id: matchedItem.id })
        .eq('id', photoId)
        .select()
      
      if (updateError) {
        console.error('Error updating photo with menu item:', updateError)
        return NextResponse.json({ 
          menuItemId: null,
          reason: 'update_failed',
          error: updateError.message
        })
      }
      
      console.log('Photo updated successfully:', updateData)
      
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

