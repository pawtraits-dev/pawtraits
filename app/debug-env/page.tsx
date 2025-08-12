"use client"

import { useEffect, useState } from 'react'

export default function DebugEnvPage() {
  const [envCheck, setEnvCheck] = useState<any>(null)

  useEffect(() => {
    const check = {
      supabaseUrl: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        value: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...',
        length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0
      },
      supabaseKey: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 30) + '...',
        length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0
      }
    }
    setEnvCheck(check)
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Debug</h1>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(envCheck, null, 2)}
      </pre>
      
      <div className="mt-6">
        <h2 className="text-xl font-bold mb-2">Next.js Runtime Info</h2>
        <p>Node env: {process.env.NODE_ENV}</p>
        <p>Vercel env: {process.env.VERCEL_ENV}</p>
      </div>
    </div>
  )
}