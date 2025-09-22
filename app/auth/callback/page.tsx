'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Use API endpoint to handle auth callback - follows architectural patterns
        const response = await fetch('/api/auth/callback', {
          method: 'POST',
          credentials: 'include'
        })

        if (!response.ok) {
          console.error('Auth callback failed:', response.status)
          router.push('/auth/login?error=callback_failed')
          return
        }

        const { redirectTo } = await response.json()
        console.log('Auth callback successful, redirecting to:', redirectTo)
        router.push(redirectTo || '/dashboard')
      } catch (error) {
        console.error('Callback handling error:', error)
        router.push('/auth/login?error=callback_error')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  )
}