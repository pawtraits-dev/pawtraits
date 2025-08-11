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

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [rememberMe, setRememberMe] = useState(false)
  
  const supabaseService = new SupabaseService()

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (!password.trim()) {
      newErrors.password = "Password is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)

    try {
      console.log("Attempting login with email:", email)
      
      const data = await supabaseService.signIn(email, password)

      console.log("Login successful:", data)
      
      // Clear any previous errors
      setErrors({})
      
      // Wait for session to be established
      console.log("Login - Waiting for session to be established...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get user profile to determine redirect destination
      try {
        const profile = await supabaseService.getCurrentUserProfile();
        console.log("Login - Profile found:", profile);
        
        let redirectUrl = "/partners"; // default for partners
        
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
              redirectUrl = "/partners";
          }
        } else {
          console.log("Login - No profile found, using default redirect");
        }
        
        console.log("Login - Final redirect URL:", redirectUrl);
        
        // Use Next.js router to preserve session
        console.log("Login - About to redirect with router.push");
        router.push(redirectUrl);
      } catch (profileError) {
        console.warn("Could not get user profile, using default redirect:", profileError);
        router.push("/dashboard");
      }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>Sign in to your Pawtraits Partner account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {errors.general && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{errors.general}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={errors.email ? "border-red-500" : ""}
                  placeholder="your@email.com"
                />
                {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? "border-red-500 pr-10" : "pr-10"}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Label htmlFor="remember" className="text-sm text-gray-600">
                    Remember me
                  </Label>
                </div>
                <Link href="/auth/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
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
