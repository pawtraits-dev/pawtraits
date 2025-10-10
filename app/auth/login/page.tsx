"use client"

import type React from "react"

// Force dynamic rendering for authentication routes
export const dynamic = 'force-dynamic'

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SupabaseService } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Eye, EyeOff, Loader2, Heart, Camera } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import UserAwareNavigation from '@/components/UserAwareNavigation'

// Security imports temporarily disabled for debugging
// import { SecureWrapper } from '@/components/security/SecureWrapper'
// import { SecureForm, FormField } from '@/components/security/SecureForm'
// import { clientSanitizer } from '@/lib/client-data-sanitizer'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loginAttempts, setLoginAttempts] = useState(0)
  const [lastAttemptTime, setLastAttemptTime] = useState<number>(0)
  
  const supabaseService = new SupabaseService()

  // Rate limiting check
  const checkRateLimit = () => {
    const now = Date.now()
    const timeSinceLastAttempt = now - lastAttemptTime
    
    // Allow 5 attempts per 15 minutes
    if (loginAttempts >= 5 && timeSinceLastAttempt < 15 * 60 * 1000) {
      const remainingTime = Math.ceil((15 * 60 * 1000 - timeSinceLastAttempt) / 1000 / 60)
      setErrors({ general: `Too many login attempts. Please try again in ${remainingTime} minutes.` })
      return false
    }
    
    // Reset counter if enough time has passed
    if (timeSinceLastAttempt > 15 * 60 * 1000) {
      setLoginAttempts(0)
    }
    
    return true
  }

  // Secure form fields temporarily disabled for debugging
  // const loginFields: FormField[] = [...]

  const handleSecureSubmit = async (formData: Record<string, any>, securityInfo: any) => {
    // Check rate limiting
    if (!checkRateLimit()) {
      return
    }

    setIsLoading(true)
    setLoginAttempts(prev => prev + 1)
    setLastAttemptTime(Date.now())

    try {
      const { email, password } = formData
      
      console.log("Attempting secure login with email:", email)
      
      const data = await supabaseService.signIn(email, password)
      console.log("Login successful:", data)
      
      // Clear any previous errors
      setErrors({})
      
      // Wait for session to be established and verify it's working
      console.log("Login - Waiting for session to be established...");
      let profile = null;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!profile && attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          console.log(`Login - Attempt ${attempts} to get profile...`);
          profile = await supabaseService.getCurrentUserProfile();
          console.log(`Login - Attempt ${attempts} result:`, profile);
        } catch (error) {
          console.log(`Login - Attempt ${attempts} error:`, error);
        }
      }
      
      let redirectUrl = "/browse"; // default for customers

      // Use returnTo parameter if provided and valid
      if (returnTo && returnTo.startsWith('/')) {
        console.log("Login - Using returnTo redirect:", returnTo);
        redirectUrl = returnTo;
      } else if (profile) {
        console.log("Login - Profile user_type:", profile.user_type);
        switch (profile.user_type) {
          case 'admin':
            redirectUrl = "/admin";
            break;
          case 'partner':
            redirectUrl = "/";
            break;
          case 'customer':
            redirectUrl = "/browse";
            break;
          default:
            redirectUrl = "/browse";
        }
      } else {
        console.log("Login - No profile found after all attempts, using default redirect");
      }
      
      console.log("Login - Final redirect URL:", redirectUrl);
      
      // Reset login attempts on successful login
      setLoginAttempts(0)
      
      // Force a page reload to ensure fresh session state
      window.location.href = redirectUrl;
    } catch (error: any) {
      console.error("Login error:", error)
      
      // Show user-friendly error messages
      if (error.message?.includes('Invalid login credentials')) {
        setErrors({ general: "Invalid email or password. Please check your credentials and try again." })
      } else if (error.message?.includes('Email not confirmed')) {
        setErrors({ general: "Please check your email and click the confirmation link before signing in." })
      } else {
        setErrors({ general: error.message || "An unexpected error occurred during login. Please try again." })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSecurityViolation = (violation: any) => {
    console.warn('Security violation detected:', violation)
    // Could add additional security measures here
  }

  return (
    <>
      <UserAwareNavigation />
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Image
                src="/assets/logos/paw-svgrepo-200x200-purple.svg"
                alt="Pawtraits Logo"
                width={60}
                height={60}
                className="w-15 h-15"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 font-[family-name:var(--font-life-savers)]">
              Welcome Back to Pawtraits! 🎨
            </h1>
            <p className="text-gray-600">
              Sign in to continue creating beautiful pet portraits
            </p>
          </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl text-gray-800">Sign In</CardTitle>
          </CardHeader>
            <CardContent>
              {errors.general && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-red-600">{errors.general}</p>
                </div>
              )}

              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                handleSecureSubmit({
                  email: formData.get('email') as string,
                  password: formData.get('password') as string
                }, {})
              }} className="space-y-4">
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="your@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="Enter your password"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Link href="/auth/forgot-password" className="text-sm text-purple-600 hover:text-purple-700">
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4 mr-2" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>

              <Separator className="my-6" />

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{" "}
                  <Link href={returnTo ? `/signup/user?returnTo=${encodeURIComponent(returnTo)}` : "/signup/user"} className="text-purple-600 hover:text-purple-700 font-medium">
                    Sign up here
                  </Link>
                </p>
              </div>

              {/* Additional Features */}
              <div className="mt-6 text-center">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Camera className="w-4 h-4 mr-1 text-purple-500" />
                      <span>Create Portraits</span>
                    </div>
                    <div className="flex items-center">
                      <Heart className="w-4 h-4 mr-1 text-pink-500" />
                      <span>Track Orders</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Image
                src="/assets/logos/paw-svgrepo-200x200-purple.svg"
                alt="Pawtraits Logo"
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-xl font-bold font-[family-name:var(--font-life-savers)]">Pawtraits</span>
            </div>
            <p className="text-gray-400 mb-4">Perfect Pet Pawtraits</p>
            <p className="text-sm text-gray-500">
              Questions? Contact us at{' '}
              <a href="mailto:support@pawtraits.pics" className="text-purple-400 hover:underline">
                support@pawtraits.pics
              </a>
            </p>
            <div className="mt-8 pt-8 border-t border-gray-800 text-center">
              <p className="text-gray-400">
                © 2024 Pawtraits. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}
