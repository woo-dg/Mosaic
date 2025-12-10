import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const createMiddlewareClient = async () => {
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


import { auth } from '@clerk/nextjs/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const createMiddlewareClient = async () => {
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

