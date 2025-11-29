import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server client with service role (bypasses RLS)
export const createServerClient = () => {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Server client with Clerk JWT (respects RLS)
export const createAuthenticatedServerClient = async () => {
  const { getToken } = auth()
  const token = await getToken()
  
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? {
        Authorization: `Bearer ${token}`
      } : {}
    }
  })
}

