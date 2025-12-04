'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useParams } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/supabase/auth-client'
import { useAuth } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'

interface Submission {
  id: string
  created_at: string
  instagram_handle: string | null
  feedback: string | null
  allow_marketing: boolean
  photos: { id: string; file_path: string }[]
}

export default function RestaurantDashboardPage() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantName, setRestaurantName] = useState<string>('')
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [filterMarketing, setFilterMarketing] = useState(false)
  const [filterDays, setFilterDays] = useState<number | null>(null)
  const [menuUrl, setMenuUrl] = useState<string>('')
  const [menuUrlLoading, setMenuUrlLoading] = useState(true)
  const [menuUrlSaving, setMenuUrlSaving] = useState(false)
  const [menuUrlSaved, setMenuUrlSaved] = useState(false)
  const [menuStatus, setMenuStatus] = useState<string>('')
  const loadMenuUrlRef = useRef(false) // Prevent concurrent calls

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      router.push('/sign-in')
      return
    }

    checkAuthorization()
  }, [user, isLoaded, slug])

  const loadMenuUrl = useCallback(async (showLoading = false) => {
    if (!user || !authorized || loadMenuUrlRef.current) return

    loadMenuUrlRef.current = true
    if (showLoading) {
      setMenuUrlLoading(true)
    }
    
    try {
      const token = await getToken()
      const supabase = await createAuthenticatedClient(token)
      
      // Get restaurant ID
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!restaurant) {
        loadMenuUrlRef.current = false
        return
      }

      const restaurantData = restaurant as { id: string }

      // Get most recent menu source
      const { data: menuSource, error } = await (supabase
        .from('menu_sources') as any)
        .select('source_url, status')
        .eq('restaurant_id', restaurantData.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading menu URL:', error)
      }

      if (menuSource) {
        setMenuUrl(menuSource.source_url || '')
        setMenuStatus(menuSource.status || '')
      }
    } catch (error) {
      // No menu source exists yet, that's okay
      if (showLoading) {
        console.log('No menu source found')
      }
    } finally {
      setMenuUrlLoading(false)
      loadMenuUrlRef.current = false
    }
  }, [user, authorized, slug, getToken])

  useEffect(() => {
    if (authorized === true) {
      loadSubmissions()
      loadMenuUrl(true) // Show loading on initial load
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, filterMarketing, filterDays])

  // Single polling effect for menu status - replaces multiple overlapping intervals
  useEffect(() => {
    if (!authorized || (menuStatus !== 'pending' && menuStatus !== 'processing')) {
      return
    }

    const statusInterval = setInterval(() => {
      loadMenuUrl(false) // Don't show loading spinner during polling
    }, 5000) // Poll every 5 seconds

    return () => {
      clearInterval(statusInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, menuStatus])

  const checkAuthorization = async () => {
    if (!user) return

    try {
      const token = await getToken()
      const supabase = await createAuthenticatedClient(token)
      
      // Get restaurant by slug
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('slug', slug)
        .single()

      if (!restaurant) {
        setAuthorized(false)
        setLoading(false)
        return
      }

      // TypeScript type guard - restaurant is guaranteed to exist here
      const restaurantData = restaurant as { id: string; name: string }

      // Check if manager owns this restaurant
      const { data: managerUser } = await supabase
        .from('manager_users')
        .select('restaurant_id')
        .eq('manager_id', user.id)
        .eq('restaurant_id', restaurantData.id)
        .single()

      if (!managerUser) {
        setAuthorized(false)
        setLoading(false)
        return
      }

      setRestaurantName(restaurantData.name)
      setAuthorized(true)
    } catch (error) {
      console.error('Error checking authorization:', error)
      setAuthorized(false)
      setLoading(false)
    }
  }

  const loadSubmissions = async () => {
    if (!user || !authorized) return

    try {
      const token = await getToken()
      const supabase = await createAuthenticatedClient(token)
      
      // Get restaurant ID
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!restaurant) return

      // TypeScript type guard
      const restaurantData = restaurant as { id: string }

      // Build query
      let query = supabase
        .from('submissions')
        .select(`
          id,
          created_at,
          instagram_handle,
          feedback,
          allow_marketing,
          photos(id, file_path)
        `)
        .eq('restaurant_id', restaurantData.id)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filterMarketing) {
        query = query.eq('allow_marketing', true)
      }

      if (filterDays) {
        const date = new Date()
        date.setDate(date.getDate() - filterDays)
        query = query.gte('created_at', date.toISOString())
      }

      const { data, error } = await query

      if (error) {
        console.error('Error loading submissions:', error)
        setSubmissions([])
      } else {
        setSubmissions(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
      setSubmissions([])
    } finally {
      setLoading(false)
    }
  }


  const handleSaveMenuUrl = async () => {
    if (!user || !authorized || !menuUrl.trim()) return

    setMenuUrlSaving(true)
    try {
      const token = await getToken()
      const supabase = await createAuthenticatedClient(token)
      
      // Get restaurant ID
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!restaurant) return

      const restaurantData = restaurant as { id: string }

      const response = await fetch('/api/menu/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restaurantId: restaurantData.id,
          menuUrl: menuUrl.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to save menu URL')
        setMenuUrlSaved(false)
        return
      }

      // Set status to processing (will be updated by polling)
      setMenuStatus('processing')
      setMenuUrlSaved(true)
      
      // Clear saved state after 5 seconds
      setTimeout(() => {
        setMenuUrlSaved(false)
      }, 5000)
      
      // Polling effect will handle status updates automatically
    } catch (error) {
      console.error('Error saving menu URL:', error)
      alert('Failed to save menu URL')
      setMenuUrlSaved(false)
    } finally {
      setMenuUrlSaving(false)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You don't have access to this restaurant's dashboard.
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition"
          >
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div>
              <h1 className="text-xl font-bold">{restaurantName}</h1>
              <p className="text-sm text-gray-500">Dashboard</p>
            </div>
            <UserButton />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Menu URL Section */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Menu Settings</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="menuUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Menu URL
              </label>
              <input
                id="menuUrl"
                type="url"
                value={menuUrl}
                onChange={(e) => setMenuUrl(e.target.value)}
                placeholder="https://yourrestaurant.com/menu"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={menuUrlLoading || menuUrlSaving}
              />
              {menuStatus && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">
                    Status: <span className="font-medium capitalize">{menuStatus}</span>
                    {menuStatus === 'completed' && (
                      <span className="ml-2 text-green-600">✓ Menu items extracted</span>
                    )}
                    {menuStatus === 'processing' && (
                      <span className="ml-2 text-blue-600">⏳ Processing menu...</span>
                    )}
                    {menuStatus === 'failed' && (
                      <span className="ml-2 text-red-600">✗ Processing failed</span>
                    )}
                  </p>
                  {menuStatus === 'processing' && (
                    <p className="mt-1 text-xs text-amber-600">
                      ⚠️ Note: If processing takes too long, check your Supabase quota (egress may be exceeded)
                    </p>
                  )}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                We'll automatically extract menu items from your website
              </p>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSaveMenuUrl}
                disabled={menuUrlSaving || !menuUrl.trim() || menuUrlLoading || menuUrlSaved}
                className={`px-6 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                  menuUrlSaved 
                    ? 'bg-gray-500 text-white cursor-default' 
                    : menuUrlSaving
                    ? 'bg-blue-500 text-white cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
                }`}
              >
                {menuUrlSaved ? 'Saved' : menuUrlSaving ? 'Saving...' : 'Save & Process'}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h2 className="text-2xl font-bold">Submissions</h2>
          
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filterMarketing}
                onChange={(e) => setFilterMarketing(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Marketing allowed only</span>
            </label>
            
            <select
              value={filterDays || ''}
              onChange={(e) => setFilterDays(e.target.value ? parseInt(e.target.value) : null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No submissions yet
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preview
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Instagram
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Marketing
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {submissions.map((submission) => (
                    <tr key={submission.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(submission.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <SubmissionThumbnail filePath={submission.photos[0]?.file_path} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {submission.instagram_handle ? (
                          <span>@{submission.instagram_handle}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {submission.allow_marketing ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Allowed
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Not allowed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/${slug}/submissions/${submission.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SubmissionThumbnail({ filePath }: { filePath: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadImage = async () => {
      try {
        const response = await fetch(`/api/sign-url?path=${encodeURIComponent(filePath)}`)
        const data = await response.json()
        if (data.url) {
          setImageUrl(data.url)
        }
      } catch (error) {
        console.error('Error loading thumbnail:', error)
      } finally {
        setLoading(false)
      }
    }
    loadImage()
  }, [filePath])

  if (loading) {
    return <div className="w-16 h-16 bg-gray-200 rounded animate-pulse" />
  }

  if (!imageUrl) {
    return <div className="w-16 h-16 bg-gray-200 rounded" />
  }

  return (
    <img
      src={imageUrl}
      alt="Preview"
      className="w-16 h-16 object-cover rounded"
    />
  )
}

