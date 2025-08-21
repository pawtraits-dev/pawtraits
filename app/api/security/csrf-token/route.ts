import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    // Generate CSRF token
    const token = crypto.randomUUID()
    
    // Create response with token
    const response = NextResponse.json({ 
      token,
      expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    })

    // Set CSRF token in httpOnly cookie
    response.cookies.set('csrf-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 // 24 hours
    })

    return response
  } catch (error) {
    console.error('CSRF token generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}