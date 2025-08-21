"use client"

import type React from "react"

// Force dynamic rendering for authentication routes
export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SupabaseService } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import Link from "next/link"

// Security imports temporarily disabled for debugging
// import { SecureWrapper } from '@/components/security/SecureWrapper'
// import { SecureForm, FormField } from '@/components/security/SecureForm'
// import { clientSanitizer } from '@/lib/client-data-sanitizer'

export default function LoginPage() {
  const router = useRouter()
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
      
      let redirectUrl = "/customer"; // default for customers
      
      if (profile) {
        console.log("Login - Profile user_type:", profile.user_type);
        switch (profile.user_type) {
          case 'admin':
            redirectUrl = "/admin";
            break;
          case 'partner':
            redirectUrl = "/partners";
            break;
          case 'customer':
            redirectUrl = "/customer";
            break;
          default:
            redirectUrl = "/customer";
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>Sign in to your Pawtraits account</CardDescription>
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
                  <Link href="/auth/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700">
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>
              </form>

              <Separator className="my-6" />

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{" "}
                  <Link href="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
                    Sign up here
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}
