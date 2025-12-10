'use client'

import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/supabase/auth-client'
import { useAuth } from '@clerk/nextjs'

export default function DashboardPage() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const router = useRouter()
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      router.push('/sign-in')
      return
    }

    // Only redirect once
    if (!hasRedirected.current) {
      hasRedirected.current = true
      redirectToRestaurantDashboard()
    }
  }, [user, isLoaded])

  const redirectToRestaurantDashboard = async () => {
    if (!user) return

    try {
      // Get token without template (Clerk-Supabase integration should work with default token)
      const token = await getToken()
      const supabase = await createAuthenticatedClient(token)
      
      console.log('=== DASHBOARD REDIRECT DEBUG ===')
      console.log('User ID:', user.id)
      console.log('User email:', user.primaryEmailAddress?.emailAddress)
      
      // Add delay so console logs are visible
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // First, try to get manager_user record
      const { data: managerUser, error: managerError } = await supabase
        .from('manager_users')
        .select('restaurant_id')
        .eq('manager_id', user.id)
        .single()

      console.log('Manager user query result:', { managerUser, managerError })
      console.log('Manager error details:', managerError?.message, managerError?.code)

      if (managerError || !managerUser) {
        console.error('❌ No manager_users record found')
        console.log('This means your account is not linked to a restaurant')
        console.log('Redirecting to onboarding...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        window.location.href = '/onboarding'
        return
      }

      // TypeScript type guard - managerUser is guaranteed to exist here
      type ManagerUser = { restaurant_id: string }
      const managerUserData: ManagerUser = managerUser as ManagerUser

      // Now get the restaurant slug
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('slug')
        .eq('id', managerUserData.restaurant_id)
        .single()

      console.log('Restaurant query result:', { restaurant, restaurantError })

      if (restaurantError || !restaurant) {
        console.error('❌ Restaurant not found:', restaurantError)
        await new Promise(resolve => setTimeout(resolve, 1000))
        window.location.href = '/onboarding'
        return
      }

      // TypeScript type guard - restaurant is guaranteed to exist here
      type Restaurant = { slug: string }
      const restaurantData: Restaurant = restaurant as Restaurant

      if (restaurantData.slug) {
        console.log('✅ Found restaurant! Redirecting to:', restaurantData.slug)
        await new Promise(resolve => setTimeout(resolve, 500))
        window.location.href = `/${restaurantData.slug}`
      } else {
        console.error('❌ Restaurant has no slug')
        await new Promise(resolve => setTimeout(resolve, 1000))
        window.location.href = '/onboarding'
      }
    } catch (error) {
      console.error('❌ Error redirecting:', error)
      await new Promise(resolve => setTimeout(resolve, 1000))
      window.location.href = '/onboarding'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">Redirecting...</div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/supabase/auth-client'
import { useAuth } from '@clerk/nextjs'

export default function DashboardPage() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const router = useRouter()
  const hasRedirected = useRef(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      router.push('/sign-in')
      return
    }

    // Only redirect once
    if (!hasRedirected.current) {
      hasRedirected.current = true
      redirectToRestaurantDashboard()
    }
  }, [user, isLoaded])

  const redirectToRestaurantDashboard = async () => {
    if (!user) return

    try {
      // Get token without template (Clerk-Supabase integration should work with default token)
      const token = await getToken()
      const supabase = await createAuthenticatedClient(token)
      
      console.log('=== DASHBOARD REDIRECT DEBUG ===')
      console.log('User ID:', user.id)
      console.log('User email:', user.primaryEmailAddress?.emailAddress)
      
      // Add delay so console logs are visible
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // First, try to get manager_user record
      const { data: managerUser, error: managerError } = await supabase
        .from('manager_users')
        .select('restaurant_id')
        .eq('manager_id', user.id)
        .single()

      console.log('Manager user query result:', { managerUser, managerError })
      console.log('Manager error details:', managerError?.message, managerError?.code)

      if (managerError || !managerUser) {
        console.error('❌ No manager_users record found')
        console.log('This means your account is not linked to a restaurant')
        console.log('Redirecting to onboarding...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        window.location.href = '/onboarding'
        return
      }

      // TypeScript type guard - managerUser is guaranteed to exist here
      type ManagerUser = { restaurant_id: string }
      const managerUserData: ManagerUser = managerUser as ManagerUser

      // Now get the restaurant slug
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('slug')
        .eq('id', managerUserData.restaurant_id)
        .single()

      console.log('Restaurant query result:', { restaurant, restaurantError })

      if (restaurantError || !restaurant) {
        console.error('❌ Restaurant not found:', restaurantError)
        await new Promise(resolve => setTimeout(resolve, 1000))
        window.location.href = '/onboarding'
        return
      }

      // TypeScript type guard - restaurant is guaranteed to exist here
      type Restaurant = { slug: string }
      const restaurantData: Restaurant = restaurant as Restaurant

      if (restaurantData.slug) {
        console.log('✅ Found restaurant! Redirecting to:', restaurantData.slug)
        await new Promise(resolve => setTimeout(resolve, 500))
        window.location.href = `/${restaurantData.slug}`
      } else {
        console.error('❌ Restaurant has no slug')
        await new Promise(resolve => setTimeout(resolve, 1000))
        window.location.href = '/onboarding'
      }
    } catch (error) {
      console.error('❌ Error redirecting:', error)
      await new Promise(resolve => setTimeout(resolve, 1000))
      window.location.href = '/onboarding'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">Redirecting...</div>
    </div>
  )
}
