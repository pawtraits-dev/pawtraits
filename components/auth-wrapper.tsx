"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SupabaseService } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

interface AuthWrapperProps {
  children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()
  const supabaseService = new SupabaseService()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      console.log("AuthWrapper: Checking authentication...")
      
      // For partner routes, check if they have both auth user and partner record
      const partner = await supabaseService.getCurrentPartner()
      console.log("AuthWrapper: Current partner:", partner)
      
      if (partner) {
        console.log("AuthWrapper: Partner found, authenticated")
        setIsAuthenticated(true)
      } else {
        console.log("AuthWrapper: No partner found, redirecting to login")
        router.push('/auth/login')
      }
    } catch (error) {
      console.error("AuthWrapper: Error checking auth:", error)
      router.push('/auth/login')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return <>{children}</>
}