-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create restaurants table
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create manager_users table
CREATE TABLE IF NOT EXISTS public.manager_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id TEXT NOT NULL UNIQUE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    instagram_handle TEXT,
    feedback TEXT,
    allow_marketing BOOLEAN DEFAULT FALSE,
    agreed_private BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create photos table
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_restaurant_id ON public.submissions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON public.submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_photos_submission_id ON public.photos(submission_id);
CREATE INDEX IF NOT EXISTS idx_manager_users_manager_id ON public.manager_users(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_users_restaurant_id ON public.manager_users(restaurant_id);

-- Enable Row Level Security
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow anonymous users to read restaurant info (for public pages)
CREATE POLICY "public_restaurant_info" ON public.restaurants
    FOR SELECT
    USING (true);

-- RLS Policy: Allow anonymous users to insert submissions (with consent check)
CREATE POLICY "anon_insert_submissions" ON public.submissions
    FOR INSERT
    TO anon
    WITH CHECK (agreed_private = true);

-- RLS Policy: Managers can read their restaurant's submissions
CREATE POLICY "manager_select_submissions" ON public.submissions
    FOR SELECT
    USING (
        auth.jwt() ->> 'sub' IN (
            SELECT manager_id 
            FROM public.manager_users 
            WHERE manager_users.restaurant_id = submissions.restaurant_id
        )
    );

-- RLS Policy: Allow anonymous users to insert photos (when creating submissions)
CREATE POLICY "anon_insert_photos" ON public.photos
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- RLS Policy: Managers can read photos from their restaurant's submissions
CREATE POLICY "manager_select_photos" ON public.photos
    FOR SELECT
    USING (
        auth.jwt() ->> 'sub' IN (
            SELECT manager_id 
            FROM public.manager_users 
            JOIN public.submissions ON submissions.restaurant_id = manager_users.restaurant_id
            WHERE submissions.id = photos.submission_id
        )
    );

-- RLS Policy: Managers can read their own manager_users mapping
CREATE POLICY "manager_read_own_mapping" ON public.manager_users
    FOR SELECT
    USING (auth.jwt() ->> 'sub' = manager_id);


