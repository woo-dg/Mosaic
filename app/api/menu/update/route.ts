import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import * as cheerio from 'cheerio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

async function scrapeMenu(url: string): Promise<string> {
  try {
    console.log('Fetching menu URL:', url)
    
    // Add timeout to fetch (5 seconds max - Vercel Hobby has 10s limit)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.log('Timeout triggered, aborting fetch after 5 seconds...')
      controller.abort()
    }, 5000) // 5 second timeout - must complete before Vercel kills function
    
    let response: Response
    try {
      console.log('Starting fetch request...')
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none'
        },
        signal: controller.signal,
        redirect: 'follow',
        // @ts-ignore
        cache: 'no-store'
      })
      clearTimeout(timeoutId)
      console.log('Fetch completed, status:', response.status)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      console.error('Fetch error caught:', fetchError.name, fetchError.message)
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
        throw new Error('Menu fetch timed out after 5 seconds - website may be slow or blocking requests')
      }
      throw new Error(`Failed to fetch menu: ${fetchError.message || fetchError}`)
    }
    
    console.log('Menu fetch response status:', response.status)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch menu: ${response.status} ${response.statusText}`)
    }
    
    console.log('Reading menu HTML...')
    const html = await response.text()
    console.log('Menu HTML length:', html.length)
    
    const $ = cheerio.load(html)
    
    $('script, style, nav, header, footer').remove()
    
    let menuText = ''
    const menuSelectors = [
      '[class*="menu"]',
      '[id*="menu"]',
      '[class*="Menu"]',
      '[id*="Menu"]',
      'main',
      'article',
      '.content',
      '#content'
    ]
    
    for (const selector of menuSelectors) {
      const content = $(selector).text()
      if (content.length > 200) {
        menuText = content
        break
      }
    }
    
    if (!menuText || menuText.length < 200) {
      menuText = $('body').text()
    }
    
    const cleanedText = menuText
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .substring(0, 10000)
    
    console.log('Menu content extracted, length:', cleanedText.length)
    
    return cleanedText
  } catch (error: any) {
    console.error('Error scraping menu:', error)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    })
    throw error
  }
}

async function extractMenuItems(menuContent: string): Promise<any[]> {
  try {
    console.log('Calling OpenAI to extract menu items...')
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `You are a menu parser. Extract ALL menu items from the provided menu text. 
        Return a JSON object with an "items" array. Each item should have:
        - name: string (required) - the exact name of the dish/item
        - category: string (optional, e.g., "appetizer", "main", "dessert", "drink", "side", "taco", "burrito", "entree")
        - description: string (optional) - brief description if available
        - price: string (optional, keep original format)
        
        Extract ALL food and drink items you can find. Include items like:
        - Tacos, burritos, quesadillas
        - Appetizers, entrees, desserts
        - Drinks, beverages
        - Any food items listed
        
        Be thorough and extract as many items as possible.`
      }, {
        role: 'user',
        content: `Extract ALL menu items from this menu. Be comprehensive and include every food and drink item you can find:\n\n${menuContent.substring(0, 8000)}`
      }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2000
    })
    
    const responseContent = completion.choices[0].message.content || '{"items": []}'
    console.log('OpenAI response preview:', responseContent.substring(0, 500))
    
    const result = JSON.parse(responseContent)
    const items = result.items || []
    console.log('Extracted', items.length, 'menu items')
    
    return items
  } catch (error: any) {
    console.error('Error extracting menu items:', error)
    return []
  }
}

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
          status: 'processing'
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
          status: 'processing'
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

    // Trigger menu processing via separate endpoint (better timeout handling)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000'
    const processUrl = `${baseUrl}/api/menu/process`
    
    console.log('Triggering menu processing at:', processUrl)
    
    // Fire and forget - don't wait for response
    fetch(processUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        restaurantId: restaurantId, 
        menuSourceId: menuSourceId 
      })
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

// Async function to process menu without blocking
async function processMenuAsync(
  restaurantId: string, 
  menuSourceId: string, 
  menuUrl: string,
  supabase: any
) {
  try {
    console.log('=== STARTING MENU PROCESSING ===')
    console.log('Timestamp:', new Date().toISOString())
    console.log('URL:', menuUrl)
    console.log('Restaurant ID:', restaurantId)
    console.log('Menu Source ID:', menuSourceId)
    
    // Scrape menu
    console.log('Scraping menu...')
    let menuContent: string
    try {
      menuContent = await scrapeMenu(menuUrl)
      console.log('Menu content length:', menuContent.length)
      console.log('Menu content preview:', menuContent.substring(0, 300))
    } catch (scrapeError: any) {
      console.error('Menu scraping failed:', scrapeError)
      throw new Error(`Failed to scrape menu: ${scrapeError.message}`)
    }
    
    if (!menuContent || menuContent.length < 50) {
      throw new Error('Failed to extract menu content from URL - page may be empty or inaccessible')
    }
    
    // Extract menu items
    console.log('Extracting menu items with LLM...')
    const menuItems = await extractMenuItems(menuContent)
    console.log('Extracted items:', menuItems.length)
    console.log('Sample items:', menuItems.slice(0, 3))
    
    if (menuItems.length === 0) {
      throw new Error('No menu items extracted - the menu page may not contain recognizable menu items')
    }
    
    // Save menu items
    console.log('Saving menu items to database...')
    let savedCount = 0
    for (const item of menuItems) {
      if (!item.name || item.name.trim().length === 0) {
        console.warn('Skipping item with no name:', item)
        continue
      }
      
      const { error: upsertError } = await (supabase.from('menu_items') as any).upsert({
        restaurant_id: restaurantId,
        name: item.name.trim(),
        category: item.category?.trim() || null,
        description: item.description?.trim() || null,
        price: item.price?.trim() || null,
      }, {
        onConflict: 'restaurant_id,name'
      })
      
      if (upsertError) {
        console.error('Error saving menu item:', item.name, upsertError)
        // If it's a quota/rate limit error, throw to stop processing
        if (upsertError.message?.includes('quota') || upsertError.message?.includes('limit') || upsertError.code === 'PGRST301') {
          throw new Error(`Database quota exceeded: ${upsertError.message}. Please upgrade your Supabase plan.`)
        }
      } else {
        savedCount++
        console.log('Saved menu item:', item.name)
      }
    }
    
    console.log(`Saved ${savedCount} out of ${menuItems.length} menu items`)
    
    // Update status to completed
    const { error: updateError } = await (supabase
      .from('menu_sources') as any)
      .update({ 
        status: 'completed', 
        scraped_at: new Date().toISOString() 
      })
      .eq('id', menuSourceId)
    
    if (updateError) {
      console.error('Failed to update status to completed:', updateError)
      console.error('Update error details:', JSON.stringify(updateError, null, 2))
      // Try to update to failed instead (but don't throw if this also fails due to quota)
      try {
        await (supabase
          .from('menu_sources') as any)
          .update({ status: 'failed' })
          .eq('id', menuSourceId)
      } catch (statusUpdateError) {
        console.error('Failed to update status to failed:', statusUpdateError)
      }
      throw new Error(`Database update failed: ${updateError.message || 'Unknown error'}. This may be due to Supabase quota limits (you're at 170% egress).`)
    }
    
    console.log('=== MENU PROCESSING COMPLETED ===')
  } catch (error: any) {
    console.error('=== MENU PROCESSING FAILED ===')
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Error name:', error.name)
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    
    // Try to update status to failed, but don't throw if this also fails
    try {
      const { error: statusError } = await (supabase
        .from('menu_sources') as any)
        .update({ status: 'failed' })
        .eq('id', menuSourceId)
      
      if (statusError) {
        console.error('Failed to update status to failed:', statusError)
        console.error('Status update error details:', JSON.stringify(statusError, null, 2))
      } else {
        console.log('Status updated to failed successfully')
      }
    } catch (statusError: any) {
      console.error('Exception updating status to failed:', statusError)
      console.error('Exception details:', JSON.stringify(statusError, Object.getOwnPropertyNames(statusError)))
    }
  }
}
