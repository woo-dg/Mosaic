'use client'

import { SignUp } from '@clerk/nextjs'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SignUpPage() {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const [showSignUp, setShowSignUp] = useState(false)

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        // If already signed in, redirect to dashboard
        router.push('/dashboard')
      } else {
        // Only show sign-up form if NOT signed in
        setShowSignUp(true)
      }
    }
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  if (isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Redirecting...</div>
      </div>
    )
  }

  if (!showSignUp) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignUp 
        path="/sign-up" 
        routing="path" 
        signInUrl="/sign-in"
        fallbackRedirectUrl="/onboarding"
      />
    </div>
  )
}
