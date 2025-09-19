'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'

export default function AuthCallbackPage() {
  const router = useRouter()
  
  const supabase = getSupabaseClient()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Handle the auth callback
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          router.push('/auth/login?error=callback_failed')
          return
        }

        if (data.session) {
          console.log('Auth callback successful, redirecting to dashboard')
          router.push('/dashboard')
        } else {
          console.log('No session found, redirecting to login')
          router.push('/auth/login')
        }
      } catch (error) {
        console.error('Callback handling error:', error)
        router.push('/auth/login?error=callback_error')
      }
    }

    handleCallback()
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  )
}