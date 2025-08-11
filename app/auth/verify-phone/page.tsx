"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Phone, Loader2, RefreshCw } from "lucide-react"

export default function VerifyPhonePage() {
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [timeLeft])

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)
    setError("")

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`phone-code-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`phone-code-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const verificationCode = code.join("")
    if (verificationCode.length !== 6) {
      setError("Please enter the complete verification code")
      return
    }

    setIsLoading(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Redirect to welcome/dashboard
    window.location.href = "/auth/welcome"
  }

  const handleResend = async () => {
    setIsResending(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setIsResending(false)
    setTimeLeft(60)
    setCanResend(false)
    setCode(["", "", "", "", "", ""])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Step 4 of 4</span>
            <span>100% Complete</span>
          </div>
          <Progress value={100} className="h-2" />
        </div>

        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl">Verify Your Phone</CardTitle>
            <CardDescription>
              We've sent a 6-digit SMS code to your phone number. Enter it below to complete your registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-center block">SMS Verification Code</Label>
                <div className="flex justify-center space-x-2">
                  {code.map((digit, index) => (
                    <Input
                      key={index}
                      id={`phone-code-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-12 h-12 text-center text-lg font-semibold"
                    />
                  ))}
                </div>
                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700"
                disabled={isLoading || code.join("").length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Completing Registration...
                  </>
                ) : (
                  "Complete Registration"
                )}
              </Button>

              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Didn't receive the SMS?</p>
                {canResend ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleResend}
                    disabled={isResending}
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    {isResending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Resend SMS"
                    )}
                  </Button>
                ) : (
                  <p className="text-sm text-gray-500">Resend available in {timeLeft}s</p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
