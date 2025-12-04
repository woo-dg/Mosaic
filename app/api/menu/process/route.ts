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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch menu: ${response.statusText}`)
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // Remove script and style elements
    $('script, style, nav, header, footer').remove()
    
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
    
    for (const selector of menuSelectors) {
      const content = $(selector).text()
      if (content.length > 200) { // Found substantial content
        menuText = content
        break
      }
    }
    
    // If no specific menu section found, get body text
    if (!menuText || menuText.length < 200) {
      menuText = $('body').text()
    }
    
    // Clean up the text
    menuText = menuText
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .substring(0, 10000) // Limit to 10k chars
    
    return menuText
  } catch (error) {
    console.error('Error scraping menu:', error)
    throw error
  }
}

async function extractMenuItems(menuContent: string): Promise<any[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using cheaper model
      messages: [{
        role: 'system',
        content: `You are a menu parser. Extract menu items from the provided menu text. 
        Return a JSON object with a "items" array. Each item should have:
        - name: string (required)
        - category: string (optional, e.g., "appetizer", "main", "dessert", "drink", "side")
        - description: string (optional)
        - price: string (optional, keep original format)
        
        Only extract actual food/drink items, not headers or other text.`
      }, {
        role: 'user',
        content: `Extract menu items from this menu:\n\n${menuContent}`
      }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })
    
    const result = JSON.parse(completion.choices[0].message.content || '{"items": []}')
    return result.items || []
  } catch (error) {
    console.error('Error extracting menu items:', error)
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const { restaurantId, menuSourceId } = await request.json()
    
    if (!restaurantId || !menuSourceId) {
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
    const { data: menuSource, error: menuSourceError } = await supabase
      .from('menu_sources')
      .select('*')
      .eq('id', menuSourceId)
      .eq('restaurant_id', restaurantId)
      .single()
    
    if (menuSourceError || !menuSource) {
      return NextResponse.json(
        { error: 'Menu source not found' },
        { status: 404 }
      )
    }
    
    // Type assertion
    const menuSourceData = menuSource as unknown as MenuSource
    
    if (menuSourceData.source_type !== 'url' || !menuSourceData.source_url) {
      return NextResponse.json(
        { error: 'Invalid menu source type' },
        { status: 400 }
      )
    }
    
    // Update status to processing
    await supabase
      .from('menu_sources')
      .update({ status: 'processing' })
      .eq('id', menuSourceId)
    
    try {
      // Scrape menu content
      const menuContent = await scrapeMenu(menuSourceData.source_url)
      
      if (!menuContent || menuContent.length < 50) {
        throw new Error('Failed to extract menu content from URL')
      }
      
      // Use LLM to extract menu items
      const menuItems = await extractMenuItems(menuContent)
      
      if (menuItems.length === 0) {
        throw new Error('No menu items extracted')
      }
      
      // Save menu items (use upsert to avoid duplicates)
      const insertPromises = menuItems.map((item: any) => {
        if (!item.name || item.name.trim().length === 0) return null
        
        return supabase.from('menu_items').upsert({
          restaurant_id: restaurantId,
          name: item.name.trim(),
          category: item.category?.trim() || null,
          description: item.description?.trim() || null,
          price: item.price?.trim() || null,
        } as any, {
          onConflict: 'restaurant_id,name'
        })
      })
      
      await Promise.all(insertPromises.filter(p => p !== null))
      
      // Update status to completed
      await supabase
        .from('menu_sources')
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
      await supabase
        .from('menu_sources')
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

