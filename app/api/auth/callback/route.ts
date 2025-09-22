import { NextRequest, NextResponse } from 'next/server'
import { SupabaseService } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService()

    // Get the current session to verify auth callback worked
    const { data: { session }, error } = await supabaseService.getClient().auth.getSession()

    if (error) {
      console.error('Auth callback session error:', error)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    if (!session) {
      console.log('No session found after callback')
      return NextResponse.json(
        { redirectTo: '/auth/login' },
        { status: 200 }
      )
    }

    // Get user profile to determine redirect destination
    const userProfile = await supabaseService.getCurrentUserProfile()

    let redirectTo = '/dashboard' // Default redirect

    if (userProfile) {
      switch (userProfile.user_type) {
        case 'admin':
          redirectTo = '/admin'
          break
        case 'partner':
          redirectTo = '/partners'
          break
        case 'customer':
          redirectTo = '/customer'
          break
        default:
          redirectTo = '/dashboard'
      }
    }

    console.log('Auth callback successful, user type:', userProfile?.user_type, 'redirectTo:', redirectTo)

    return NextResponse.json({ redirectTo })
  } catch (error) {
    console.error('Auth callback API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}