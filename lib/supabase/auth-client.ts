'use client'

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function createAuthenticatedClient(token: string | null) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? {
        Authorization: `Bearer ${token}`
      } : {}
    }
  })
}








import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function createAuthenticatedClient(token: string | null) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? {
        Authorization: `Bearer ${token}`
      } : {}
    }
  })
}







