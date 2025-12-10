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
    console.log('Fetching menu URL directly:', url)
    
    // Direct fetch with browser-like headers
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      console.log('Fetch timeout after 12 seconds')
      controller.abort()
    }, 12000) // 12 second timeout
    
    let response: Response
    try {
      console.log('Making direct fetch request...')
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': url, // Use menu URL as referer to appear more legitimate
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        redirect: 'follow',
        signal: controller.signal,
        // @ts-ignore
        next: { revalidate: 0 }
      })
      clearTimeout(timeout)
      console.log('Fetch response received, status:', response.status)
    } catch (err: any) {
      clearTimeout(timeout)
      console.error('Fetch error:', err.name, err.message)
      if (err.name === 'AbortError') {
        throw new Error('Menu fetch timed out after 12 seconds - website may be slow or blocking requests')
      }
      throw new Error(`Failed to fetch menu: ${err.message}`)
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText.substring(0, 200)}`)
    }
    
    console.log('Reading HTML...')
    const html = await response.text()
    console.log('Menu HTML length:', html.length)
    
    // Check if HTML is too short (likely JS-rendered or empty page)
    if (html.length < 500) {
      throw new Error('Page returned minimal content - may require JavaScript rendering or is inaccessible')
    }
    
    console.log('Loading HTML into cheerio...')
    const $ = cheerio.load(html)
    console.log('Cheerio loaded successfully')
    
    console.log('Removing scripts, styles, nav, header, footer...')
    $('script, style, nav, header, footer').remove()
    console.log('Removed unwanted elements')
    
    // Try to find menu content - use .first() to get only the first matching container
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
    
    console.log('Searching for menu content with selectors...')
    for (const selector of menuSelectors) {
      const container = $(selector).first()
      if (container.length) {
        const content = container.text()
        if (content.length > 200) {
          menuText = content
          console.log(`Found menu content with selector: ${selector}, length: ${content.length}`)
          break
        }
      }
    }
    
    // Fallback to body text if no specific container found
    if (!menuText || menuText.length < 200) {
      console.log('No menu found with selectors, using body text...')
      menuText = $('body').text()
      console.log('Body text length:', menuText.length)
    }
    
    if (!menuText || menuText.length < 200) {
      throw new Error('Failed to extract sufficient menu content from page')
    }
    
    console.log('Cleaning menu text...')
    // Enhanced text cleaning - remove common non-menu content
    let cleanedText = menuText
      // Remove phone numbers
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '')
      // Remove email addresses
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
      // Remove common footer/header phrases
      .replace(/\b(Contact us|Follow us|Hours|Address|Phone|Email|Instagram|Facebook|Twitter|©|Copyright|All rights reserved)\b/gi, '')
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
    
    // Limit to 10,000 characters, try to cut at sentence boundary
    if (cleanedText.length > 10000) {
      const truncated = cleanedText.substring(0, 10000)
      const lastPeriod = truncated.lastIndexOf('.')
      const lastNewline = truncated.lastIndexOf('\n')
      const cutPoint = Math.max(lastPeriod, lastNewline)
      cleanedText = cutPoint > 8000 ? truncated.substring(0, cutPoint + 1) : truncated
    }
    
    console.log('Menu content extracted, length:', cleanedText.length)
    console.log('Menu content preview:', cleanedText.substring(0, 200))
    
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

    // Process menu directly (don't block response, but log errors properly)
    console.log('=== STARTING MENU PROCESSING INLINE ===')
    console.log('Restaurant ID:', restaurantId)
    console.log('Menu Source ID:', menuSourceId)
    console.log('Menu URL:', menuUrl.trim())
    
    // Run processing asynchronously but catch all errors
    processMenuAsync(restaurantId, menuSourceId, menuUrl.trim(), supabase)
      .then(() => {
        console.log('Menu processing completed successfully')
      })
      .catch((err: any) => {
        console.error('=== MENU PROCESSING FAILED IN UPDATE ROUTE ===')
        console.error('Error:', err.message)
        console.error('Stack:', err.stack)
        // Don't throw - we already returned success to user
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
      console.error('Menu scraping failed:', scrapeError.message)
      // If timeout, try one more time
      if (scrapeError.message === 'FETCH_TIMEOUT_2S') {
        console.log('First attempt timed out, trying one more time...')
        try {
          menuContent = await scrapeMenu(menuUrl)
          console.log('Retry successful, menu content length:', menuContent.length)
        } catch (retryError: any) {
          console.error('Retry also failed:', retryError.message)
          throw new Error('Menu website is blocking or too slow. The website may be blocking server requests. Please contact support for alternative menu entry methods.')
        }
      } else {
        throw new Error(`Failed to scrape menu: ${scrapeError.message}`)
      }
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
    console.log('Fetching menu URL directly:', url)
    
    // Direct fetch with browser-like headers
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      console.log('Fetch timeout after 12 seconds')
      controller.abort()
    }, 12000) // 12 second timeout
    
    let response: Response
    try {
      console.log('Making direct fetch request...')
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': url, // Use menu URL as referer to appear more legitimate
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        redirect: 'follow',
        signal: controller.signal,
        // @ts-ignore
        next: { revalidate: 0 }
      })
      clearTimeout(timeout)
      console.log('Fetch response received, status:', response.status)
    } catch (err: any) {
      clearTimeout(timeout)
      console.error('Fetch error:', err.name, err.message)
      if (err.name === 'AbortError') {
        throw new Error('Menu fetch timed out after 12 seconds - website may be slow or blocking requests')
      }
      throw new Error(`Failed to fetch menu: ${err.message}`)
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText.substring(0, 200)}`)
    }
    
    console.log('Reading HTML...')
    const html = await response.text()
    console.log('Menu HTML length:', html.length)
    
    // Check if HTML is too short (likely JS-rendered or empty page)
    if (html.length < 500) {
      throw new Error('Page returned minimal content - may require JavaScript rendering or is inaccessible')
    }
    
    console.log('Loading HTML into cheerio...')
    const $ = cheerio.load(html)
    console.log('Cheerio loaded successfully')
    
    console.log('Removing scripts, styles, nav, header, footer...')
    $('script, style, nav, header, footer').remove()
    console.log('Removed unwanted elements')
    
    // Try to find menu content - use .first() to get only the first matching container
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
    
    console.log('Searching for menu content with selectors...')
    for (const selector of menuSelectors) {
      const container = $(selector).first()
      if (container.length) {
        const content = container.text()
        if (content.length > 200) {
          menuText = content
          console.log(`Found menu content with selector: ${selector}, length: ${content.length}`)
          break
        }
      }
    }
    
    // Fallback to body text if no specific container found
    if (!menuText || menuText.length < 200) {
      console.log('No menu found with selectors, using body text...')
      menuText = $('body').text()
      console.log('Body text length:', menuText.length)
    }
    
    if (!menuText || menuText.length < 200) {
      throw new Error('Failed to extract sufficient menu content from page')
    }
    
    console.log('Cleaning menu text...')
    // Enhanced text cleaning - remove common non-menu content
    let cleanedText = menuText
      // Remove phone numbers
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '')
      // Remove email addresses
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
      // Remove common footer/header phrases
      .replace(/\b(Contact us|Follow us|Hours|Address|Phone|Email|Instagram|Facebook|Twitter|©|Copyright|All rights reserved)\b/gi, '')
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
    
    // Limit to 10,000 characters, try to cut at sentence boundary
    if (cleanedText.length > 10000) {
      const truncated = cleanedText.substring(0, 10000)
      const lastPeriod = truncated.lastIndexOf('.')
      const lastNewline = truncated.lastIndexOf('\n')
      const cutPoint = Math.max(lastPeriod, lastNewline)
      cleanedText = cutPoint > 8000 ? truncated.substring(0, cutPoint + 1) : truncated
    }
    
    console.log('Menu content extracted, length:', cleanedText.length)
    console.log('Menu content preview:', cleanedText.substring(0, 200))
    
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

    // Process menu directly (don't block response, but log errors properly)
    console.log('=== STARTING MENU PROCESSING INLINE ===')
    console.log('Restaurant ID:', restaurantId)
    console.log('Menu Source ID:', menuSourceId)
    console.log('Menu URL:', menuUrl.trim())
    
    // Run processing asynchronously but catch all errors
    processMenuAsync(restaurantId, menuSourceId, menuUrl.trim(), supabase)
      .then(() => {
        console.log('Menu processing completed successfully')
      })
      .catch((err: any) => {
        console.error('=== MENU PROCESSING FAILED IN UPDATE ROUTE ===')
        console.error('Error:', err.message)
        console.error('Stack:', err.stack)
        // Don't throw - we already returned success to user
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
      console.error('Menu scraping failed:', scrapeError.message)
      // If timeout, try one more time
      if (scrapeError.message === 'FETCH_TIMEOUT_2S') {
        console.log('First attempt timed out, trying one more time...')
        try {
          menuContent = await scrapeMenu(menuUrl)
          console.log('Retry successful, menu content length:', menuContent.length)
        } catch (retryError: any) {
          console.error('Retry also failed:', retryError.message)
          throw new Error('Menu website is blocking or too slow. The website may be blocking server requests. Please contact support for alternative menu entry methods.')
        }
      } else {
        throw new Error(`Failed to scrape menu: ${scrapeError.message}`)
      }
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
