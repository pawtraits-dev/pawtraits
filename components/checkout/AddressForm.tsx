'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowRight, Loader2, Users } from 'lucide-react'

interface Country {
  code: string
  name: string
  currency_code: string
  currency_symbol: string
  flag: string
}

export interface AddressData {
  firstName: string
  lastName: string
  email: string
  address: string // For backward compatibility
  addressLine1: string
  addressLine2: string
  city: string
  postcode: string
  country: string
  businessName?: string
  isForClient?: boolean
  clientName?: string
  clientEmail?: string
}

interface AddressFormProps {
  data: AddressData
  onChange: (field: string, value: string | boolean) => void
  onSubmit: (e: React.FormEvent) => void | Promise<void>
  errors: Record<string, string>
  countries?: Country[]
  isLoading?: boolean
  userType?: 'customer' | 'partner'
  showClientSection?: boolean
  submitButtonText?: string
}

export default function AddressForm({
  data,
  onChange,
  onSubmit,
  errors,
  countries = [],
  isLoading = false,
  userType = 'customer',
  showClientSection = true,
  submitButtonText = 'Continue to Shipping'
}: AddressFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Shipping Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* General validation errors */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Client Toggle (Partners only) */}
          {userType === 'partner' && showClientSection && (
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isForClient"
                  checked={data.isForClient}
                  onChange={(e) => onChange("isForClient", e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="isForClient" className="text-sm font-medium text-green-800">
                  This order is for a client
                </label>
              </div>
              {data.isForClient && (
                <p className="text-xs text-green-700 mt-1">
                  Client information will be included in the order confirmation
                </p>
              )}
            </div>
          )}

          {/* Client Information (if applicable) */}
          {userType === 'partner' && data.isForClient && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900">Client Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name *</Label>
                  <Input
                    id="clientName"
                    value={data.clientName || ''}
                    onChange={(e) => onChange("clientName", e.target.value)}
                    className={errors.clientName ? "border-red-500" : ""}
                    placeholder="Client's full name"
                  />
                  {errors.clientName && <p className="text-sm text-red-600">{errors.clientName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Client Email *</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    value={data.clientEmail || ''}
                    onChange={(e) => onChange("clientEmail", e.target.value)}
                    className={errors.clientEmail ? "border-red-500" : ""}
                    placeholder="client@example.com"
                  />
                  {errors.clientEmail && <p className="text-sm text-red-600">{errors.clientEmail}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={data.firstName}
                onChange={(e) => onChange("firstName", e.target.value)}
                className={`${errors.firstName ? "border-red-500" : ""} ${data.firstName ? "bg-green-50" : ""}`}
                placeholder="John"
              />
              {data.firstName && <p className="text-xs text-green-600">Pre-filled from your profile</p>}
              {errors.firstName && <p className="text-sm text-red-600">{errors.firstName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={data.lastName}
                onChange={(e) => onChange("lastName", e.target.value)}
                className={`${errors.lastName ? "border-red-500" : ""} ${data.lastName ? "bg-green-50" : ""}`}
                placeholder="Doe"
              />
              {data.lastName && <p className="text-xs text-green-600">Pre-filled from your profile</p>}
              {errors.lastName && <p className="text-sm text-red-600">{errors.lastName}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={data.email}
              onChange={(e) => onChange("email", e.target.value)}
              className={`${errors.email ? "border-red-500" : ""} ${data.email && !errors.email ? "bg-green-50" : ""}`}
              placeholder="Enter your email address"
            />
            {data.email && !errors.email && <p className="text-xs text-green-600">Email address confirmed</p>}
            {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
          </div>

          {/* Business Name (Partners only) */}
          {userType === 'partner' && data.businessName && (
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                value={data.businessName}
                readOnly
                className="bg-gray-50 text-gray-700 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500">From your partner profile</p>
            </div>
          )}

          {/* Address Fields */}
          <div className="space-y-2">
            <Label htmlFor="addressLine1">Address Line 1 *</Label>
            <Input
              id="addressLine1"
              value={data.addressLine1}
              onChange={(e) => {
                onChange("addressLine1", e.target.value);
                // Update the old address field for backward compatibility
                onChange("address", e.target.value);
              }}
              className={errors.addressLine1 ? "border-red-500" : ""}
              placeholder="123 Main Street"
            />
            {errors.addressLine1 && <p className="text-sm text-red-600">{errors.addressLine1}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
            <Input
              id="addressLine2"
              value={data.addressLine2}
              onChange={(e) => onChange("addressLine2", e.target.value)}
              placeholder="Apartment, suite, etc."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={data.city}
                onChange={(e) => onChange("city", e.target.value)}
                className={errors.city ? "border-red-500" : ""}
                placeholder="London"
              />
              {errors.city && <p className="text-sm text-red-600">{errors.city}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode *</Label>
              <Input
                id="postcode"
                value={data.postcode}
                onChange={(e) => onChange("postcode", e.target.value)}
                className={errors.postcode ? "border-red-500" : ""}
                placeholder="SW1A 1AA"
              />
              {errors.postcode && <p className="text-sm text-red-600">{errors.postcode}</p>}
            </div>
          </div>

          {/* Country Selection (Customers only - Partners are UK only) */}
          {userType === 'customer' && countries.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="country">Country *</Label>
              <Select
                value={data.country}
                onValueChange={(value) => onChange("country", value)}
              >
                <SelectTrigger className={errors.country ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.name}>
                      <span className="flex items-center">
                        <span className="mr-2">{country.flag}</span>
                        {country.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.country && <p className="text-sm text-red-600">{errors.country}</p>}
            </div>
          )}

          <Button
            type="submit"
            className={`w-full py-3 ${userType === 'partner' ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'} text-white`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {submitButtonText}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}