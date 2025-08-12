import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body
    
    console.log('Server-side login attempt for:', email)
    
    // Get environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        error: 'Missing Supabase environment variables',
        details: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey
        }
      }, { status: 500 })
    }
    
    console.log('Creating Supabase client on server...')
    console.log('URL:', supabaseUrl)
    console.log('Key prefix:', supabaseKey.substring(0, 20))
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    console.log('Attempting server-side authentication...')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    console.log('Server auth result:', {
      success: !error,
      userEmail: data?.user?.email,
      errorMessage: error?.message
    })
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        errorCode: error.status,
        errorName: error.name,
        fullError: error
      }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      user: {
        email: data?.user?.email,
        id: data?.user?.id
      },
      session: !!data?.session
    })
    
  } catch (error: any) {
    console.error('Server auth exception:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      errorName: error.name,
      stack: error.stack?.substring(0, 500)
    }, { status: 500 })
  }
}