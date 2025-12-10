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

## Setup Instructions

### Prerequisites

1. Node.js 18+ installed
2. Supabase account and project
3. Clerk account and application

### 1. Database Setup

Run the SQL migration in Supabase:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Execute the SQL

This will create:
- `restaurants` table
- `submissions` table
- `photos` table
- `manager_users` table
- All necessary indexes and RLS policies

### 2. Storage Bucket Setup

1. In Supabase Dashboard, go to Storage
2. Create a new bucket named `submissions`
3. Keep it **private** (do not make it public)
4. The bucket will be used to store uploaded images

### 3. Clerk Configuration

1. Create a Clerk application at [clerk.com](https://clerk.com)
2. Enable email/password authentication (or your preferred method)
3. Enable sign-ups for manager onboarding
4. Configure redirect URLs:
   - After sign-in: `/dashboard`
   - After sign-up: `/onboarding`
5. Set up Clerk-Supabase integration:
   - In Clerk Dashboard → Integrations → Supabase
   - Enable the integration
   - Or manually configure JWT in Supabase to trust Clerk's JWKS URL

### 4. Supabase JWT Configuration

1. In Supabase Dashboard → Authentication → Providers
2. Add JWT provider or configure External Auth
3. Set JWKS URL: `https://<your-clerk-domain>/.well-known/jwks.json`
4. Ensure Clerk tokens include `role: "authenticated"` claim

### 5. Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

### 6. Install Dependencies

```bash
npm install
```

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### For Restaurant Managers

1. Sign up at `/sign-up`
2. Complete onboarding to create your restaurant
3. Get your restaurant slug (e.g., `pizza-palace`)
4. Access your dashboard at `/[slug]` (e.g., `/pizza-palace`)
5. Share the guest URL: `https://yourdomain.com/pizza-palace/guest`
6. View submissions in your dashboard

### For Customers

1. Visit the restaurant's guest URL (e.g., `/pizza-palace/guest`)
2. Upload 1-3 photos
3. Optionally add feedback and Instagram handle
4. Check required consent checkbox
5. Optionally allow marketing use
6. Submit and see thank you page

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── [slug]/          # Restaurant-specific routes
│   │   ├── page.tsx     # Manager dashboard (protected)
│   │   ├── guest/       # Guest submission form (public)
│   │   └── submissions/ # Submission detail views
│   ├── dashboard/       # Redirects to /[slug]
│   ├── sign-in/         # Clerk sign-in page
│   ├── sign-up/         # Clerk sign-up page
│   ├── onboarding/      # Restaurant creation form
│   └── privacy/         # Privacy policy page
├── components/          # React components
├── lib/                 # Utility functions
├── types/               # TypeScript types
└── supabase/            # Database migrations
```

## Security Features

- Row-Level Security (RLS) policies ensure managers only see their restaurant's data
- Private storage bucket with signed URLs for image access
- Clerk JWT authentication integrated with Supabase
- Server-side validation for all submissions
- File type and size validation

## Development

### Linting

```bash
npm run lint
```

### Building for Production

```bash
npm run build
```

### Running Production Build

```bash
npm start
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

The app will automatically build and deploy on every push to main.

## Troubleshooting

### Images not loading in dashboard

- Ensure the `submissions` storage bucket exists and is private
- Check that signed URL generation is working (check API route logs)
- Verify Clerk JWT is being passed correctly to Supabase

### RLS policies blocking queries

- Ensure Clerk-Supabase integration is configured
- Verify JWT includes `role: "authenticated"` claim
- Check that `manager_users` table has correct mappings

### Onboarding fails

- Check that slug is unique
- Verify user doesn't already have a restaurant
- Check database constraints and foreign keys

## License

MIT


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

## Setup Instructions

### Prerequisites

1. Node.js 18+ installed
2. Supabase account and project
3. Clerk account and application

### 1. Database Setup

Run the SQL migration in Supabase:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Execute the SQL

This will create:
- `restaurants` table
- `submissions` table
- `photos` table
- `manager_users` table
- All necessary indexes and RLS policies

### 2. Storage Bucket Setup

1. In Supabase Dashboard, go to Storage
2. Create a new bucket named `submissions`
3. Keep it **private** (do not make it public)
4. The bucket will be used to store uploaded images

### 3. Clerk Configuration

1. Create a Clerk application at [clerk.com](https://clerk.com)
2. Enable email/password authentication (or your preferred method)
3. Enable sign-ups for manager onboarding
4. Configure redirect URLs:
   - After sign-in: `/dashboard`
   - After sign-up: `/onboarding`
5. Set up Clerk-Supabase integration:
   - In Clerk Dashboard → Integrations → Supabase
   - Enable the integration
   - Or manually configure JWT in Supabase to trust Clerk's JWKS URL

### 4. Supabase JWT Configuration

1. In Supabase Dashboard → Authentication → Providers
2. Add JWT provider or configure External Auth
3. Set JWKS URL: `https://<your-clerk-domain>/.well-known/jwks.json`
4. Ensure Clerk tokens include `role: "authenticated"` claim

### 5. Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

### 6. Install Dependencies

```bash
npm install
```

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### For Restaurant Managers

1. Sign up at `/sign-up`
2. Complete onboarding to create your restaurant
3. Get your restaurant slug (e.g., `pizza-palace`)
4. Access your dashboard at `/[slug]` (e.g., `/pizza-palace`)
5. Share the guest URL: `https://yourdomain.com/pizza-palace/guest`
6. View submissions in your dashboard

### For Customers

1. Visit the restaurant's guest URL (e.g., `/pizza-palace/guest`)
2. Upload 1-3 photos
3. Optionally add feedback and Instagram handle
4. Check required consent checkbox
5. Optionally allow marketing use
6. Submit and see thank you page

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── [slug]/          # Restaurant-specific routes
│   │   ├── page.tsx     # Manager dashboard (protected)
│   │   ├── guest/       # Guest submission form (public)
│   │   └── submissions/ # Submission detail views
│   ├── dashboard/       # Redirects to /[slug]
│   ├── sign-in/         # Clerk sign-in page
│   ├── sign-up/         # Clerk sign-up page
│   ├── onboarding/      # Restaurant creation form
│   └── privacy/         # Privacy policy page
├── components/          # React components
├── lib/                 # Utility functions
├── types/               # TypeScript types
└── supabase/            # Database migrations
```

## Security Features

- Row-Level Security (RLS) policies ensure managers only see their restaurant's data
- Private storage bucket with signed URLs for image access
- Clerk JWT authentication integrated with Supabase
- Server-side validation for all submissions
- File type and size validation

## Development

### Linting

```bash
npm run lint
```

### Building for Production

```bash
npm run build
```

### Running Production Build

```bash
npm start
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

The app will automatically build and deploy on every push to main.

## Troubleshooting

### Images not loading in dashboard

- Ensure the `submissions` storage bucket exists and is private
- Check that signed URL generation is working (check API route logs)
- Verify Clerk JWT is being passed correctly to Supabase

### RLS policies blocking queries

- Ensure Clerk-Supabase integration is configured
- Verify JWT includes `role: "authenticated"` claim
- Check that `manager_users` table has correct mappings

### Onboarding fails

- Check that slug is unique
- Verify user doesn't already have a restaurant
- Check database constraints and foreign keys

## License

MIT

