'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CartRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to customer cart by default
    router.push('/customer/cart')
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
}