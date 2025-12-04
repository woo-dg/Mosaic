# Menu Item Detection System - Setup Guide

## ✅ Implementation Complete

All code has been implemented. Follow these steps to complete the setup:

## Step 1: Run Database Migration

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `supabase/migrations/003_add_menu_system.sql`
5. Click **Run**

This will create:
- `menu_sources` table (stores menu URLs)
- `menu_items` table (stores extracted menu items)
- Adds `menu_item_id` column to `photos` table
- Adds `menu_url` column to `restaurants` table

## Step 2: Add Environment Variables

Create a `.env.local` file in the root directory with:

```env
# OpenAI API Key (get your key from https://platform.openai.com/api-keys)
OPENAI_API_KEY=your_openai_api_key_here

# Next.js Public URL (update for production)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**For production**, update `NEXT_PUBLIC_APP_URL` to your actual domain (e.g., `https://yourdomain.com`)

## Step 3: Dependencies Installed ✅

The following packages have been installed:
- `openai` - For LLM API calls
- `cheerio` - For web scraping menu content

## Step 4: Test the System

### For Restaurant Managers:

1. **Onboarding with Menu URL:**
   - Sign up and go through onboarding
   - When creating your restaurant, enter your menu URL (optional)
   - The system will automatically scrape and extract menu items

2. **Check Menu Processing:**
   - Go to Supabase Dashboard → Table Editor → `menu_sources`
   - Check the `status` column:
     - `pending` - Waiting to process
     - `processing` - Currently being processed
     - `completed` - Successfully processed
     - `failed` - Processing failed
   - Check `menu_items` table to see extracted items

### For Customers:

1. **Upload a Photo:**
   - Go to the restaurant's guest page
   - Upload a photo of a food item
   - The system will:
     - Check if it's a food item (not a drink/person/ambiance)
     - Match it to a menu item if available
     - Display the menu item name above the photo

2. **View Menu Items:**
   - When viewing photos in the carousel
   - If a photo matches a menu item, you'll see:
     - Category (if available) - e.g., "DESSERT"
     - Menu item name - e.g., "Apple Crumble"
   - The menu item appears at the top of the photo
   - Instagram handle appears below it (if provided)

## How It Works

### Menu Processing Flow:
1. Restaurant provides menu URL during onboarding
2. System scrapes the menu page HTML
3. LLM (GPT-4o-mini) extracts menu items from the text
4. Menu items are saved to the database

### Photo Classification Flow:
1. Customer uploads a photo
2. System gets a signed URL for the image
3. LLM checks if it's a food item (not drink/person/etc.)
4. If food, LLM matches it to a menu item
5. Photo is linked to the menu item
6. Menu item name displays on the carousel

## API Endpoints Created

- `POST /api/menu/process` - Processes menu URL and extracts items
- `POST /api/photos/classify` - Classifies uploaded photos and matches to menu items

## Cost Considerations

- **GPT-4o-mini** is used (cheaper than GPT-4 Vision)
- Menu processing: ~$0.01-0.05 per menu (one-time)
- Photo classification: ~$0.001-0.005 per photo
- Food detection happens first to skip classification for non-food items

## Troubleshooting

### Menu items not extracting:
- Check `menu_sources` table - status should be `completed`
- Check browser console for errors
- Verify the menu URL is accessible and contains menu text

### Photos not matching menu items:
- Verify menu items exist in `menu_items` table
- Check that photos are of actual food items
- Classification happens asynchronously - may take a few seconds

### Menu item not displaying:
- Check that `photos.menu_item_id` is set (in Supabase)
- Verify the photo has a menu item linked
- Refresh the carousel to see updates

## Next Steps

1. Run the database migration
2. Add the `.env.local` file with your OpenAI key
3. Test with a restaurant that has a menu URL
4. Upload food photos and verify menu items appear

