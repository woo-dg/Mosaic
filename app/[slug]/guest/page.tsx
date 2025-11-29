import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import RestaurantForm from '@/components/RestaurantForm'

export default async function GuestPage({
  params,
}: {
  params: { slug: string }
}) {
  const supabase = createServerClient()
  
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', params.slug)
    .single()

  if (error || !restaurant) {
    notFound()
  }

  // TypeScript type guard - restaurant is guaranteed to exist here
  const restaurantData = restaurant as { id: string; name: string; slug: string }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-center mb-2">
            {restaurantData.name}
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Share your dining experience with us
          </p>
          <RestaurantForm restaurantId={restaurantData.id} restaurantSlug={restaurantData.slug} />
        </div>
      </div>
    </div>
  )
}

