'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, ArrowRight, Truck, Loader2 } from 'lucide-react'

interface ShippingOption {
  id: string
  name: string
  description: string
  price: number // in pence
  estimatedDeliveryDays?: number
}

interface ShippingOptionsProps {
  options: ShippingOption[]
  selectedOption: ShippingOption | null
  onSelect: (option: ShippingOption) => void
  onContinue: () => void
  onBack: () => void
  isLoading?: boolean
  isProcessing?: boolean
  errors: Record<string, string>
  userType?: 'customer' | 'partner'
}

export default function ShippingOptions({
  options,
  selectedOption,
  onSelect,
  onContinue,
  onBack,
  isLoading = false,
  isProcessing = false,
  errors,
  userType = 'customer'
}: ShippingOptionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Truck className="w-5 h-5 mr-2" />
          Select Shipping Option
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
            <p className="text-gray-600">Finding shipping options...</p>
          </div>
        ) : (
          <>
            {errors.shipping && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{errors.shipping}</p>
              </div>
            )}

            <div className="space-y-4">
              {options.map((option, index) => (
                <div
                  key={option.id || index}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedOption?.id === option.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                  onClick={() => onSelect(option)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{option.name}</h3>
                      <p className="text-sm text-gray-600">{option.description}</p>
                      {option.estimatedDeliveryDays && (
                        <p className="text-xs text-gray-500 mt-1">
                          Estimated delivery: {option.estimatedDeliveryDays} business days
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-lg">
                        {option.price === 0 ? 'Free' : `£${(option.price / 100).toFixed(2)}`}
                      </p>
                      {selectedOption?.id === option.id && (
                        <p className="text-green-600 text-sm">Selected</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Address
              </Button>
              <Button
                type="button"
                onClick={onContinue}
                disabled={!selectedOption || isProcessing}
                className={`flex-1 ${userType === 'partner' ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Continue to Payment
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}