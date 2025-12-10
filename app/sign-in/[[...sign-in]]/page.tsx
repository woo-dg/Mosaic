'use client'

import { SignIn } from '@clerk/nextjs'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SignInPage() {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const [showSignIn, setShowSignIn] = useState(false)

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        // If already signed in, redirect to dashboard
        router.push('/dashboard')
      } else {
        // Only show sign-in form if NOT signed in
        setShowSignIn(true)
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

  if (!showSignIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignIn 
        path="/sign-in" 
        routing="path" 
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  )
}

import { SignIn } from '@clerk/nextjs'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SignInPage() {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const [showSignIn, setShowSignIn] = useState(false)

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        // If already signed in, redirect to dashboard
        router.push('/dashboard')
      } else {
        // Only show sign-in form if NOT signed in
        setShowSignIn(true)
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

  if (!showSignIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignIn 
        path="/sign-in" 
        routing="path" 
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  )
}
