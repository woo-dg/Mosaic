-- Run this SQL in your Supabase SQL Editor to add the rating column
-- Go to: Supabase Dashboard > SQL Editor > New Query > Paste this > Run

ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS rating INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN public.submissions.rating IS 'Rating from 1 to 5 stars provided by the user';



