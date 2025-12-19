# Tap-to-Upload Restaurant Platform

A Next.js application that enables restaurant guests to upload photos and feedback via mobile-friendly forms, and allows restaurant managers to review submissions in a secure dashboard.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, TailwindCSS
- **Backend**: Supabase (PostgreSQL + Storage)
- **Authentication**: Clerk
- **Deployment**: Vercel (recommended)

## Features

### Customer Features
- Public restaurant submission forms accessible via `/[slug]/guest`
- Mobile-optimized image upload (1-3 images)
- Optional feedback and Instagram handle
- Privacy and marketing consent checkboxes
- Thank you page after submission

### Manager Features
- Restaurant-specific dashboard at `/[slug]` (e.g., `/pizza-palace`)
- Secure authentication with Clerk
- View all submissions for their restaurant
- Filter by marketing consent and date range
- Detailed submission view with photo gallery
- Download images and copy signed URLs
- Self-service onboarding to create restaurant
