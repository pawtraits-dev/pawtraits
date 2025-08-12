"use client"

import { useState } from 'react'

export default function SimpleLoginPage() {
  const [email, setEmail] = useState('test_cust1@pawtraits.pics')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testLogin = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      // Use fetch directly to call our API
      console.log('Calling login API...')
      
      const response = await fetch('/api/auth/test-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      })
      
      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)
      
      setResult({
        approach: 'api-endpoint',
        success: response.ok,
        status: response.status,
        data: data
      })
      
    } catch (err: any) {
      console.error('API call error:', err)
      setResult({
        approach: 'api-endpoint',
        success: false,
        error: err.message,
        stack: err.stack?.substring(0, 300)
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Simple Login Test</h1>
      
      <div className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button
          onClick={testLogin}
          disabled={loading}
          className="w-full p-2 bg-blue-500 text-white rounded"
        >
          {loading ? 'Testing...' : 'Test Login via API'}
        </button>
      </div>
      
      {result && (
        <pre className="mt-4 bg-gray-100 p-4 rounded text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}