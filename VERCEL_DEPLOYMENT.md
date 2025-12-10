# Vercel Deployment Guide

This guide will walk you through deploying your Restaurant Platform to Vercel.

## Prerequisites

1. **GitHub Account** - Your code needs to be in a GitHub repository
2. **Vercel Account** - Sign up at [vercel.com](https://vercel.com) (free tier is fine)
3. **All Environment Variables Ready** - Have your Supabase and Clerk keys ready

## Step 1: Push Code to GitHub

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create GitHub Repository**:
   - Go to [github.com](https://github.com) and create a new repository
   - Name it something like `restaurant-platform` or `mosaic-platform`
   - **Don't** initialize with README, .gitignore, or license (we already have these)

3. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git branch -M main
   git push -u origin main
   ```

## Step 2: Deploy to Vercel

1. **Import Project**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Add New..." → "Project"
   - Click "Import Git Repository"
   - Select your GitHub repository
   - Click "Import"

2. **Configure Project**:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

3. **Add Environment Variables**:
   Click "Environment Variables" and add all of these:

   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
   ```

   **Important**: Use the **exact same values** from your `.env.local` file.

4. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes for the build to complete
   - You'll get a URL like: `https://your-app-name.vercel.app`

## Step 3: Update Clerk Configuration

1. **Go to Clerk Dashboard**:
   - Visit [dashboard.clerk.com](https://dashboard.clerk.com)
   - Select your application

2. **Update Redirect URLs**:
   - Go to **Paths** or **Redirect URLs** section
   - Add your Vercel domain:
     - `https://your-app-name.vercel.app`
     - `https://your-app-name.vercel.app/*` (wildcard)
   - Save changes

3. **Update After Sign-In/Up URLs** (if needed):
   - These are already set via environment variables, but you can also set them in Clerk dashboard
   - After Sign-In: `/dashboard` (will redirect to `/[slug]`)
   - After Sign-Up: `/onboarding`

## Step 4: Update Supabase (if needed)

1. **Check Allowed Origins**:
   - Go to Supabase Dashboard → Settings → API
   - Under "Allowed Origins", add your Vercel domain:
     - `https://your-app-name.vercel.app`
   - This ensures CORS works correctly

2. **Storage Bucket Policies** (if needed):
   - Your storage bucket should already be configured
   - If you have issues with image uploads, check Storage → Policies

## Step 5: Test Your Deployment

1. **Visit Your Live URL**:
   - Go to `https://your-app-name.vercel.app`
   - You should see the homepage

2. **Test Manager Flow**:
   - Go to `/sign-up`
   - Create a manager account
   - Complete onboarding (create restaurant)
   - You should be redirected to `/[your-slug]` (your restaurant dashboard)

3. **Test Guest Flow**:
   - Visit `https://your-app-name.vercel.app/[your-slug]/guest`
   - Try uploading photos and submitting
   - Check your dashboard to see the submission

## Step 6: Configure NFC Tags

Once everything is working:

1. **Get Your Restaurant Slug**:
   - After creating a restaurant in onboarding, note the slug (e.g., `pizza-palace`)

2. **Create Guest URL**:
   - Format: `https://your-app-name.vercel.app/[slug]/guest`
   - Example: `https://your-app-name.vercel.app/pizza-palace/guest`

3. **Program NFC Tags**:
   - Use an NFC writer app on your phone
   - Write the guest URL to each NFC tag
   - Test by tapping the tag with your phone

## Custom Domain (Optional)

If you want to use a custom domain like `mosaic.com`:

1. **In Vercel Dashboard**:
   - Go to your project → Settings → Domains
   - Add your domain (e.g., `mosaic.com`)
   - Follow Vercel's DNS instructions

2. **Update Clerk**:
   - Add your custom domain to Clerk's allowed redirect URLs
   - Update environment variables if needed

3. **Update Supabase**:
   - Add custom domain to allowed origins

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all environment variables are set
- Verify `package.json` has all dependencies

### Images Not Uploading
- Check Supabase storage bucket exists and is named `submissions`
- Verify storage policies allow uploads
- Check browser console for errors

### Authentication Issues
- Verify Clerk environment variables are correct
- Check Clerk dashboard for redirect URL configuration
- Ensure Clerk-Supabase integration is enabled

### Dashboard Not Loading
- Check browser console for errors
- Verify RLS policies in Supabase are correct
- Ensure manager_users table has correct entries

## Environment Variables Reference

Make sure these are set in Vercel (Settings → Environment Variables):

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJhbGc...` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | `pk_test_...` |
| `CLERK_SECRET_KEY` | Clerk secret key | `sk_test_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in page path | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up page path | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | After sign-in redirect | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | After sign-up redirect | `/onboarding` |

## Next Steps After Deployment

1. **Test Everything**:
   - Manager sign-up and onboarding
   - Guest submission form
   - Dashboard viewing submissions
   - Image uploads and downloads

2. **Program NFC Tags**:
   - Use your restaurant's guest URL
   - Test each tag before placing them

3. **Monitor**:
   - Check Vercel dashboard for deployment status
   - Monitor Supabase dashboard for database activity
   - Check Clerk dashboard for authentication metrics

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for client-side errors
3. Check Supabase logs for database errors
4. Verify all environment variables are set correctly






