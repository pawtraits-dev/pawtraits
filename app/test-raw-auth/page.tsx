"use client"

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function TestRawAuthPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testRawAuth = async () => {
    setLoading(true)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      
      console.log('Creating raw Supabase client...')
      console.log('URL:', supabaseUrl)
      console.log('Key prefix:', supabaseKey.substring(0, 20))
      
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      console.log('Client created, testing auth...')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test_cust1@pawtraits.pics',
        password: 'testpassword123'
      })
      
      console.log('Raw auth result:', { data, error })
      
      setResult({
        approach: 'raw-supabase',
        success: !error,
        user: data?.user?.email || null,
        error: error?.message || null,
        errorCode: error?.status || null,
        fullError: error
      })
      
    } catch (err: any) {
      console.error('Raw auth exception:', err)
      setResult({
        approach: 'raw-supabase',
        success: false,
        error: err.message,
        name: err.name,
        stack: err.stack?.substring(0, 500)
      })
    } finally {
      setLoading(false)
    }
  }

  const testUrlValidation = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const urlTest = {
      url: url,
      urlLength: url.length,
      urlFormat: /^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co$/.test(url),
      urlTrimmed: url.trim() === url,
      urlHasSpaces: url.includes(' '),
      urlEndsCorrectly: url.endsWith('.supabase.co'),
      
      key: key.substring(0, 50) + '...',
      keyLength: key.length,
      keyFormat: /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]*$/.test(key),
      keyTrimmed: key.trim() === key,
      keyHasSpaces: key.includes(' '),
      keyStartsCorrectly: key.startsWith('eyJ'),
    }
    
    setResult(urlTest)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Raw Auth Test</h1>
      
      <div className="space-y-4">
        <button
          onClick={testUrlValidation}
          className="px-4 py-2 bg-purple-500 text-white rounded"
        >
          Test URL/Key Validation
        </button>
        
        <button
          onClick={testRawAuth}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          {loading ? 'Testing...' : 'Test Raw Supabase Auth'}
        </button>
      </div>
      
      {result && (
        <pre className="mt-4 bg-gray-100 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}