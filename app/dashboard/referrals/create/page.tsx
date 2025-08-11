"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, QrCode, Mail, Download, Copy, Check, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import DashboardLayout from "@/components/dashboard-layout"
import type { Referral, Breed, Coat } from '@/lib/types'
import { createClient } from '@supabase/supabase-js'

export default function CreateReferralPage() {
  const [breeds, setBreeds] = useState<Breed[]>([])
  const [coats, setCoats] = useState<Coat[]>([])
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    loadBreedAndCoatData()
  }, [])

  const loadBreedAndCoatData = async () => {
    try {
      const [
        { data: breedsData },
        { data: coatsData }
      ] = await Promise.all([
        supabase.from('breeds').select('*'),
        supabase.from('coats').select('*')
      ])
      setBreeds(breedsData?.filter((b: any) => b.is_active) || [])
      setCoats(coatsData?.filter((c: any) => c.is_active) || [])
    } catch (error) {
      console.error('Error loading breed/coat data:', error)
    }
  }
  const [formData, setFormData] = useState({
    clientName: "",
    email: "",
    phone: "",
    notes: "",
    petName: "",
    petBreedId: "",
    petCoatId: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [qrGenerated, setQrGenerated] = useState(false)
  const [referral, setReferral] = useState<Referral | null>(null)
  const [copied, setCopied] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.clientName.trim()) {
      newErrors.clientName = "Client name is required"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email address is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    // Phone is optional
    if (formData.phone.trim() && !/^[+]?[1-9][\d\s\-()]{8,20}$/.test(formData.phone.replace(/[\s\-()]/g, ""))) {
      newErrors.phone = "Please enter a valid phone number"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
    // Clear API error when user starts typing
    if (apiError) {
      setApiError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    setApiError(null)

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          client_name: formData.clientName.trim(),
          client_email: formData.email.toLowerCase().trim(),
          client_phone: formData.phone.trim() || null,
          client_notes: formData.notes.trim() || null,
          pet_name: formData.petName.trim() || null,
          pet_breed_id: formData.petBreedId || null,
          pet_coat_id: formData.petCoatId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create referral')
      }

      setReferral(data)
      setQrGenerated(true)
    } catch (error) {
      console.error('Error creating referral:', error)
      setApiError(error instanceof Error ? error.message : 'Failed to create referral')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!referral) return
    const referralLink = `${window.location.origin}/r/${referral.referral_code}`
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadQR = () => {
    if (!referral?.qr_code_url) return
    const link = document.createElement("a")
    link.href = referral.qr_code_url
    link.download = `qr-code-${referral.referral_code}.png`
    link.click()
  }

  const getExpirationDate = () => {
    if (!referral) return ''
    return new Date(referral.expires_at).toLocaleDateString()
  }

  if (qrGenerated) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Link href="/dashboard/referrals" className="flex items-center hover:text-indigo-600">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Referrals
            </Link>
          </div>

          <Card className="text-center">
            <CardHeader>
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <CardTitle className="text-2xl">Referral Created Successfully!</CardTitle>
              <CardDescription>
                QR code generated for {formData.clientName}. Expires on {getExpirationDate()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* QR Code Display */}
              <div className="bg-white p-6 rounded-lg border-2 border-dashed border-gray-300 inline-block">
                {referral?.qr_code_url ? (
                  <img
                    src={referral.qr_code_url}
                    alt={`QR Code for ${referral.referral_code}`}
                    className="w-48 h-48 mx-auto"
                  />
                ) : (
                  <div className="w-48 h-48 bg-gray-100 flex items-center justify-center mx-auto">
                    <QrCode className="w-16 h-16 text-gray-400" />
                  </div>
                )}
                <p className="text-sm text-gray-600 mt-2">
                  Referral Code: <code className="bg-gray-100 px-2 py-1 rounded">{referral?.referral_code}</code>
                </p>
              </div>

              {/* Client Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Client Information</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <strong>Name:</strong> {formData.clientName}
                  </p>
                  <p>
                    <strong>Email:</strong> {formData.email}
                  </p>
                  {formData.phone && (
                    <p>
                      <strong>Phone:</strong> {formData.phone}
                    </p>
                  )}
                  {formData.notes && (
                    <p>
                      <strong>Notes:</strong> {formData.notes}
                    </p>
                  )}
                  {formData.petName && (
                    <p>
                      <strong>Pet Name:</strong> {formData.petName}
                    </p>
                  )}
                  {(formData.petBreedId || formData.petCoatId) && (
                    <p>
                      <strong>Pet Details:</strong> {
                        [
                          breeds.find(b => b.id === formData.petBreedId)?.name,
                          coats.find(c => c.id === formData.petCoatId)?.name
                        ].filter(Boolean).join(' - ')
                      }
                    </p>
                  )}
                  <p>
                    <strong>Commission Rate:</strong> 20% initial, 5% lifetime
                  </p>
                  <p>
                    <strong>Expires:</strong> {getExpirationDate()}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleCopyLink} variant="outline" className="flex-1 bg-transparent">
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Referral Link
                    </>
                  )}
                </Button>
                <Button onClick={handleDownloadQR} variant="outline" className="flex-1 bg-transparent">
                  <Download className="w-4 h-4 mr-2" />
                  Download QR Code
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => {
                    setQrGenerated(false)
                    setFormData({ clientName: "", email: "", phone: "", notes: "", petName: "", petBreedId: "", petCoatId: "" })
                    setReferral(null)
                  }}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700"
                >
                  Create Another Referral
                </Button>
                <Link href="/dashboard/referrals" className="flex-1">
                  <Button variant="outline" className="w-full bg-transparent">
                    View All Referrals
                  </Button>
                </Link>
              </div>

              {/* Email Confirmation */}
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-blue-600" />
                  <span>Email with QR code sent to {formData.email}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Link href="/dashboard/referrals" className="flex items-center hover:text-indigo-600">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Referrals
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8 text-indigo-600" />
            </div>
            <CardTitle className="text-2xl">Create New Referral</CardTitle>
            <CardDescription>Generate a QR code for your client and send them a personalized email</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    value={formData.clientName}
                    onChange={(e) => handleInputChange("clientName", e.target.value)}
                    className={errors.clientName ? "border-red-500" : ""}
                    placeholder="Enter client's full name"
                  />
                  {errors.clientName && <p className="text-sm text-red-600">{errors.clientName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={errors.email ? "border-red-500" : ""}
                    placeholder="client@email.com"
                  />
                  {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className={errors.phone ? "border-red-500" : ""}
                    placeholder="(555) 123-4567"
                  />
                  {errors.phone && <p className="text-sm text-red-600">{errors.phone}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Any additional notes about this client"
                  />
                </div>
              </div>

              {/* Pet Details Section */}
              <Separator />
              
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-gray-900">Pet Information (Optional)</h3>
                <p className="text-sm text-gray-600">Add pet details to help personalize their portrait experience</p>
                
                <div className="space-y-2">
                  <Label htmlFor="petName">Pet Name</Label>
                  <Input
                    id="petName"
                    value={formData.petName}
                    onChange={(e) => handleInputChange("petName", e.target.value)}
                    placeholder="e.g., Max, Bella, Charlie"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="petBreed">Breed</Label>
                    <select
                      id="petBreed"
                      value={formData.petBreedId}
                      onChange={(e) => handleInputChange("petBreedId", e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select breed...</option>
                      {breeds.map(breed => (
                        <option key={breed.id} value={breed.id}>
                          {breed.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="petCoat">Coat Color</Label>
                    <select
                      id="petCoat"
                      value={formData.petCoatId}
                      onChange={(e) => handleInputChange("petCoatId", e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select coat color...</option>
                      {coats.map(coat => (
                        <option key={coat.id} value={coat.id}>
                          <div className="flex items-center">
                            {coat.name}
                          </div>
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {apiError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                    <div>
                      <h3 className="font-medium text-red-800">Error Creating Referral</h3>
                      <p className="text-sm text-red-700 mt-1">{apiError}</p>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">What happens next?</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• A unique QR code will be generated for this client</li>
                  <li>• The client can scan the QR code or use the referral link</li>
                  <li>• You'll earn 20% commission on their first purchase + 5% for life</li>
                  <li>• You can track their activity in your referrals dashboard</li>
                  <li>• Referrals expire after 30 days if not used</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 h-12"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating QR Code...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Generate QR Code & Create Referral
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
