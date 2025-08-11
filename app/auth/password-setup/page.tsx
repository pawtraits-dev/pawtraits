"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Eye, EyeOff, CheckCircle, X, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function PasswordSetupPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const passwordRequirements = [
    { text: "At least 8 characters", met: password.length >= 8 },
    { text: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { text: "Contains lowercase letter", met: /[a-z]/.test(password) },
    { text: "Contains number", met: /\d/.test(password) },
    { text: "Contains special character", met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ]

  const passwordStrength = passwordRequirements.filter((req) => req.met).length
  const strengthPercentage = (passwordStrength / passwordRequirements.length) * 100

  const getStrengthColor = () => {
    if (strengthPercentage < 40) return "bg-red-500"
    if (strengthPercentage < 80) return "bg-amber-500"
    return "bg-emerald-500"
  }

  const getStrengthText = () => {
    if (strengthPercentage < 40) return "Weak"
    if (strengthPercentage < 80) return "Good"
    return "Strong"
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (passwordStrength < 5) {
      newErrors.password = "Password must meet all requirements"
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Redirect to email verification
    window.location.href = "/auth/verify-email"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Step 2 of 4</span>
            <span>50% Complete</span>
          </div>
          <Progress value={50} className="h-2" />
        </div>

        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <Link href="/" className="inline-flex items-center text-indigo-600 hover:text-indigo-700 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to signup
            </Link>
            <CardTitle className="text-2xl">Create Your Password</CardTitle>
            <CardDescription>Secure your account with a strong password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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

                {/* Password strength indicator */}
                {password && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Password strength:</span>
                      <span
                        className={`text-sm font-medium ${
                          strengthPercentage < 40
                            ? "text-red-600"
                            : strengthPercentage < 80
                              ? "text-amber-600"
                              : "text-emerald-600"
                        }`}
                      >
                        {getStrengthText()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor()}`}
                        style={{ width: `${strengthPercentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={errors.confirmPassword ? "border-red-500 pr-10" : "pr-10"}
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword}</p>}
              </div>

              {/* Password requirements */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Password Requirements:</Label>
                <div className="space-y-1">
                  {passwordRequirements.map((req, index) => (
                    <div key={index} className="flex items-center text-sm">
                      {req.met ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500 mr-2" />
                      ) : (
                        <X className="w-4 h-4 text-gray-400 mr-2" />
                      )}
                      <span className={req.met ? "text-emerald-700" : "text-gray-600"}>{req.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700"
                disabled={isLoading || passwordStrength < 5}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
