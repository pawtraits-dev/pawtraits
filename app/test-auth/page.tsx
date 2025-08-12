"use client"

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function TestAuthPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testAuth = async () => {
    setLoading(true)
    try {
      const supabase = createClientComponentClient()
      
      // Test basic connection first
      console.log('Testing basic connection...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.log('Get user error:', userError)
        setResult({
          step: 'getUser',
          success: false,
          error: userError.message,
          fullError: userError
        })
        return
      }
      
      console.log('Basic connection OK, current user:', user?.email || 'none')
      
      // Now try login
      console.log('Attempting login...')
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test_cust1@pawtraits.pics',
        password: 'testpassword123'
      })
      
      setResult({
        step: 'signIn',
        success: !error,
        currentUser: user?.email || null,
        data: data?.user?.email || null,
        error: error?.message || null,
        errorDetails: error
      })
      
    } catch (err: any) {
      console.error('Caught exception:', err)
      setResult({
        step: 'exception',
        success: false,
        error: err.message,
        stack: err.stack?.substring(0, 500)
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Auth Test</h1>
      
      <button
        onClick={testAuth}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        {loading ? 'Testing...' : 'Test Auth'}
      </button>
      
      {result && (
        <pre className="mt-4 bg-gray-100 p-4 rounded text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}