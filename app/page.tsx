'use client'

import Link from 'next/link'
import { useUser, UserButton } from '@clerk/nextjs'

export default function Home() {
  const { isLoaded, isSignedIn } = useUser()

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {isSignedIn && (
          <div className="flex justify-end mb-4">
            <UserButton />
          </div>
        )}
        <h1 className="text-4xl font-bold">Restaurant Platform</h1>
        <p className="text-gray-600">
          Share your dining experience with restaurants
        </p>
        <div className="space-y-4 pt-8">
          {!isSignedIn ? (
            <>
              <Link
                href="/sign-in"
                className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Manager Sign In
              </Link>
              <Link
                href="/sign-up"
                className="block w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Manager Sign Up
              </Link>
            </>
          ) : (
            <Link
              href="/dashboard"
              className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
