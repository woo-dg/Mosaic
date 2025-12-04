import { NextRequest, NextResponse } from 'next/server'
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
    
    // Use Promise.race with a timeout promise for reliable timeout handling
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.log('Fetch timeout after 4 seconds')
        reject(new Error('FETCH_TIMEOUT'))
      }, 4000)
    })
    
    const fetchPromise = fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MenuScraper/1.0)',
        'Accept': 'text/html'
      },
      // @ts-ignore - Next.js fetch options
      next: { revalidate: 0 }
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      return res
    })
    
    let response: Response
    try {
      console.log('Starting fetch with 4s timeout...')
      response = await Promise.race([fetchPromise, timeoutPromise])
      console.log('Fetch completed, status:', response.status)
    } catch (fetchError: any) {
      console.error('Fetch failed:', fetchError.message)
      if (fetchError.message === 'FETCH_TIMEOUT') {
        throw new Error('Menu website is too slow or blocking server requests. Please try a different menu URL or contact support for manual menu entry.')
      }
      throw fetchError
    }
    
    console.log('Reading menu HTML with 3s timeout...')
    const htmlTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.log('HTML read timeout after 3 seconds')
        reject(new Error('HTML_READ_TIMEOUT'))
      }, 3000)
    })
    
    const html = await Promise.race([response.text(), htmlTimeout])
    console.log('Menu HTML length:', html.length)
    
    console.log('Loading HTML into cheerio...')
    const $ = cheerio.load(html)
    console.log('Cheerio loaded successfully')
    
    console.log('Removing scripts, styles, nav, header, footer...')
    $('script, style, nav, header, footer').remove()
    console.log('Removed unwanted elements')
    
    // Try to find menu content - common selectors
    let menuText = ''
    
    // Try various common menu selectors
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
      const content = $(selector).text()
      if (content.length > 200) { // Found substantial content
        menuText = content
        console.log(`Found menu content with selector: ${selector}, length: ${content.length}`)
        break
      }
    }
    
    // If no specific menu section found, get body text
    if (!menuText || menuText.length < 200) {
      console.log('No menu found with selectors, using body text...')
      menuText = $('body').text()
      console.log('Body text length:', menuText.length)
    }
    
    // Clean up the text
    console.log('Cleaning menu text...')
    const cleanedText = menuText
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .substring(0, 10000) // Limit to 10k chars
    
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
      model: 'gpt-4o-mini', // Using cheaper model
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
    console.log('OpenAI response:', responseContent.substring(0, 500))
    
    const result = JSON.parse(responseContent)
    const items = result.items || []
    console.log('Extracted', items.length, 'menu items')
    
    return items
  } catch (error: any) {
    console.error('Error extracting menu items:', error)
    console.error('Error details:', error.message, error.stack)
    return []
  }
}

// Handle GET requests with proper error
export async function GET() {
  return NextResponse.json(
    { error: 'This endpoint only accepts POST requests' },
    { status: 405 }
  )
}

export async function POST(request: NextRequest) {
  console.log('=== MENU PROCESSING API CALLED ===')
  console.log('Timestamp:', new Date().toISOString())
  
  try {
    const body = await request.json().catch(() => ({}))
    const { restaurantId, menuSourceId } = body
    
    console.log('Request body:', { restaurantId, menuSourceId })
    console.log('Full body:', body)
    
    if (!restaurantId || !menuSourceId) {
      console.error('Missing required fields:', { restaurantId, menuSourceId })
      return NextResponse.json(
        { error: 'Missing restaurantId or menuSourceId' },
        { status: 400 }
      )
    }
    
    const supabase = createServerClient()
    
    // Type definition for menu source
    type MenuSource = {
      id: string
      restaurant_id: string
      source_type: string
      source_url: string | null
      file_path: string | null
      status: string
      scraped_at: string | null
      created_at: string
    }
    
    // Get menu source
    const menuSourceResult = await (supabase
      .from('menu_sources') as any)
      .select('*')
      .eq('id', menuSourceId)
      .eq('restaurant_id', restaurantId)
      .single()
    
    if (menuSourceResult.error || !menuSourceResult.data) {
      console.error('Menu source not found:', menuSourceResult.error)
      return NextResponse.json(
        { error: 'Menu source not found' },
        { status: 404 }
      )
    }
    
    // Type assertion
    const menuSourceData = menuSourceResult.data as MenuSource
    console.log('Menu source found:', { url: menuSourceData.source_url, status: menuSourceData.status })
    
    if (menuSourceData.source_type !== 'url' || !menuSourceData.source_url) {
      console.error('Invalid menu source:', menuSourceData)
      return NextResponse.json(
        { error: 'Invalid menu source type' },
        { status: 400 }
      )
    }
    
    // Update status to processing
    await (supabase
      .from('menu_sources') as any)
      .update({ status: 'processing' })
      .eq('id', menuSourceId)
    
    console.log('Starting menu scraping for:', menuSourceData.source_url)
    
    try {
      // Scrape menu content
      console.log('Starting to scrape menu from:', menuSourceData.source_url)
      let menuContent: string
      try {
        menuContent = await scrapeMenu(menuSourceData.source_url)
        console.log('Menu content scraped, length:', menuContent.length)
        console.log('Menu content preview:', menuContent.substring(0, 500))
      } catch (scrapeError: any) {
        console.error('Menu scraping failed:', scrapeError)
        throw new Error(`Failed to scrape menu: ${scrapeError.message}`)
      }
      
      if (!menuContent || menuContent.length < 50) {
        console.error('Menu content too short:', menuContent?.length || 0)
        throw new Error('Failed to extract menu content from URL - page may be empty or inaccessible')
      }
      
      // Use LLM to extract menu items
      console.log('Extracting menu items with LLM...')
      const menuItems = await extractMenuItems(menuContent)
      console.log('Menu items extracted:', menuItems.length)
      console.log('Sample menu items:', menuItems.slice(0, 3))
      
      if (menuItems.length === 0) {
        console.error('No menu items extracted from content')
        throw new Error('No menu items extracted - the menu page may not contain recognizable menu items')
      }
      
      // Save menu items (use upsert to avoid duplicates)
      console.log('Saving menu items to database...')
      const insertPromises = menuItems.map((item: any) => {
        if (!item.name || item.name.trim().length === 0) {
          console.warn('Skipping item with no name:', item)
          return null
        }
        
        const menuItemData = {
          restaurant_id: restaurantId,
          name: item.name.trim(),
          category: item.category?.trim() || null,
          description: item.description?.trim() || null,
          price: item.price?.trim() || null,
        }
        
        console.log('Saving menu item:', menuItemData.name)
        return (supabase.from('menu_items') as any).upsert(menuItemData, {
          onConflict: 'restaurant_id,name'
        })
      })
      
      const validPromises = insertPromises.filter(p => p !== null)
      console.log('Saving', validPromises.length, 'menu items...')
      
      const results = await Promise.all(validPromises)
      const errors = results.filter((r: any) => r?.error).map((r: any) => r.error)
      if (errors.length > 0) {
        console.error('Errors saving menu items:', errors)
        throw new Error(`Failed to save ${errors.length} menu items`)
      } else {
        console.log('All menu items saved successfully:', validPromises.length)
      }
      
      // Update status to completed
      await (supabase
        .from('menu_sources') as any)
        .update({ 
          status: 'completed', 
          scraped_at: new Date().toISOString() 
        })
        .eq('id', menuSourceId)
      
      return NextResponse.json({ 
        success: true, 
        itemsCount: menuItems.length 
      })
    } catch (error: any) {
      console.error('Menu processing error:', error)
      
      // Update status to failed
      await (supabase
        .from('menu_sources') as any)
        .update({ status: 'failed' })
        .eq('id', menuSourceId)
      
      return NextResponse.json(
        { error: error.message || 'Failed to process menu' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Menu process API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

