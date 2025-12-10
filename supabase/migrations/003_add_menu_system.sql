-- Menu sources table (stores menu URLs or file paths)
CREATE TABLE IF NOT EXISTS public.menu_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL, -- 'url' or 'file'
    source_url TEXT, -- URL to menu page
    file_path TEXT, -- Path to uploaded menu file
    scraped_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu items table
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT, -- 'appetizer', 'main', 'dessert', etc.
    description TEXT,
    price TEXT, -- Store as text to handle various formats
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, name) -- Prevent duplicates
);

-- Add menu_item_id to photos table
ALTER TABLE public.photos 
ADD COLUMN IF NOT EXISTS menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL;

-- Add menu_url to restaurants table (optional, for quick access)
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS menu_url TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_photos_menu_item_id ON public.photos(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_sources_restaurant_id ON public.menu_sources(restaurant_id);

-- RLS Policies for menu tables
ALTER TABLE public.menu_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Allow managers to read/write their restaurant's menu data
CREATE POLICY "manager_menu_sources" ON public.menu_sources
    FOR ALL
    USING (
        auth.jwt() ->> 'sub' IN (
            SELECT manager_id 
            FROM public.manager_users 
            WHERE manager_users.restaurant_id = menu_sources.restaurant_id
        )
    );

CREATE POLICY "manager_menu_items" ON public.menu_items
    FOR ALL
    USING (
        auth.jwt() ->> 'sub' IN (
            SELECT manager_id 
            FROM public.manager_users 
            WHERE manager_users.restaurant_id = menu_items.restaurant_id
        )
    );

-- Allow public read access to menu items (for displaying on guest page)
CREATE POLICY "public_menu_items_read" ON public.menu_items
    FOR SELECT
    USING (true);




CREATE TABLE IF NOT EXISTS public.menu_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL, -- 'url' or 'file'
    source_url TEXT, -- URL to menu page
    file_path TEXT, -- Path to uploaded menu file
    scraped_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu items table
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT, -- 'appetizer', 'main', 'dessert', etc.
    description TEXT,
    price TEXT, -- Store as text to handle various formats
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, name) -- Prevent duplicates
);

-- Add menu_item_id to photos table
ALTER TABLE public.photos 
ADD COLUMN IF NOT EXISTS menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL;

-- Add menu_url to restaurants table (optional, for quick access)
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS menu_url TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_photos_menu_item_id ON public.photos(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_sources_restaurant_id ON public.menu_sources(restaurant_id);

-- RLS Policies for menu tables
ALTER TABLE public.menu_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Allow managers to read/write their restaurant's menu data
CREATE POLICY "manager_menu_sources" ON public.menu_sources
    FOR ALL
    USING (
        auth.jwt() ->> 'sub' IN (
            SELECT manager_id 
            FROM public.manager_users 
            WHERE manager_users.restaurant_id = menu_sources.restaurant_id
        )
    );

CREATE POLICY "manager_menu_items" ON public.menu_items
    FOR ALL
    USING (
        auth.jwt() ->> 'sub' IN (
            SELECT manager_id 
            FROM public.manager_users 
            WHERE manager_users.restaurant_id = menu_items.restaurant_id
        )
    );

-- Allow public read access to menu items (for displaying on guest page)
CREATE POLICY "public_menu_items_read" ON public.menu_items
    FOR SELECT
    USING (true);




