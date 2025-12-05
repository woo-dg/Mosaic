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
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [menuItemsLoading, setMenuItemsLoading] = useState(true)
  const [showAddMenuForm, setShowAddMenuForm] = useState(false)
  const [newMenuItem, setNewMenuItem] = useState({ name: '', category: '', description: '', price: '' })
  const [addingMenuItem, setAddingMenuItem] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      router.push('/sign-in')
      return
    }

    checkAuthorization()
  }, [user, isLoaded, slug])

  const loadMenuItems = useCallback(async () => {
    if (!user || !authorized) return

    setMenuItemsLoading(true)
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
        setMenuItemsLoading(false)
        return
      }

      const restaurantData = restaurant as { id: string }

      // Fetch menu items
      const response = await fetch(`/api/menu/items?restaurantId=${restaurantData.id}`)

      if (response.ok) {
        const data = await response.json()
        setMenuItems(data.menuItems || [])
      }
    } catch (error) {
      console.error('Error loading menu items:', error)
    } finally {
      setMenuItemsLoading(false)
    }
  }, [user, authorized, slug, getToken])

  useEffect(() => {
    if (authorized === true) {
      loadSubmissions()
      loadMenuItems()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, filterMarketing, filterDays])

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


  const handleAddMenuItem = async () => {
    if (!user || !authorized || !newMenuItem.name.trim()) return

    setAddingMenuItem(true)
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

      const response = await fetch('/api/menu/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restaurantId: restaurantData.id,
          name: newMenuItem.name.trim(),
          category: newMenuItem.category.trim() || null,
          description: newMenuItem.description.trim() || null,
          price: newMenuItem.price.trim() || null,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to add menu item')
        return
      }

      // Reset form and reload menu items
      setNewMenuItem({ name: '', category: '', description: '', price: '' })
      setShowAddMenuForm(false)
      loadMenuItems()
    } catch (error) {
      console.error('Error adding menu item:', error)
      alert('Failed to add menu item')
    } finally {
      setAddingMenuItem(false)
    }
  }

  const handleDeleteMenuItem = async (menuItemId: string) => {
    if (!user || !authorized || !confirm('Are you sure you want to delete this menu item?')) return

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

      const response = await fetch('/api/menu/items', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restaurantId: restaurantData.id,
          menuItemId,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to delete menu item')
        return
      }

      loadMenuItems()
    } catch (error) {
      console.error('Error deleting menu item:', error)
      alert('Failed to delete menu item')
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
        {/* Menu Items Section */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Menu Items</h3>
            <button
              onClick={() => setShowAddMenuForm(!showAddMenuForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {showAddMenuForm ? 'Cancel' : '+ Add Menu Item'}
            </button>
          </div>

          {showAddMenuForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-medium mb-3">Add New Menu Item</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newMenuItem.name}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                    placeholder="e.g., Enchiladas"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category (optional)
                  </label>
                  <input
                    type="text"
                    value={newMenuItem.category}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, category: e.target.value })}
                    placeholder="e.g., Entrees"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={newMenuItem.description}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, description: e.target.value })}
                    placeholder="e.g., Corn tortillas rolled around chicken tinga..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (optional)
                  </label>
                  <input
                    type="text"
                    value={newMenuItem.price}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })}
                    placeholder="e.g., $12.99"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAddMenuItem}
                    disabled={addingMenuItem || !newMenuItem.name.trim()}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                  >
                    {addingMenuItem ? 'Adding...' : 'Add Item'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {menuItemsLoading ? (
            <p className="text-gray-500">Loading menu items...</p>
          ) : menuItems.length === 0 ? (
            <p className="text-gray-500">No menu items yet. Add your first item above!</p>
          ) : (
            <div className="space-y-2">
              {menuItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {item.category && (
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                          {item.category}
                        </span>
                      )}
                      {item.price && (
                        <span className="text-sm text-gray-600">{item.price}</span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteMenuItem(item.id)}
                    className="ml-4 text-red-600 hover:text-red-800 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
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

