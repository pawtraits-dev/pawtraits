'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Elements } from '@stripe/react-stripe-js'
import { Stripe } from '@stripe/stripe-js'
import { CreditCard, Shield, Loader2 } from 'lucide-react'
import StripePaymentForm from '@/components/StripePaymentForm'
import { AddressData } from './AddressForm'
import { OrderSummaryData } from './OrderSummary'

interface PaymentStepProps {
  stripePromise: Promise<Stripe | null>
  clientSecret: string | null
  shippingData: AddressData
  orderSummary: OrderSummaryData
  onSuccess: (paymentIntent: any) => void
  onError: (error: any) => void
  onEditShipping: () => void
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
  userType?: 'customer' | 'partner'
}

export default function PaymentStep({
  stripePromise,
  clientSecret,
  shippingData,
  orderSummary,
  onSuccess,
  onError,
  onEditShipping,
  isProcessing,
  setIsProcessing,
  userType = 'customer'
}: PaymentStepProps) {
  const isPartner = userType === 'partner'
  const primaryColor = isPartner ? '#16a34a' : '#9333ea' // Green for partners, purple for customers

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CreditCard className="w-5 h-5 mr-2" />
          Payment Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Security Badge */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-blue-600 mr-2" />
            <span className="text-blue-800 font-medium">Secure payment powered by Stripe</span>
          </div>
          <p className="text-blue-700 text-sm mt-1">Your payment information is encrypted and secure</p>
        </div>

        {/* Shipping Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Shipping to:</h3>
          <p className="text-sm text-gray-600">
            {shippingData.firstName} {shippingData.lastName}
            <br />
            {shippingData.addressLine1 || shippingData.address}
            {shippingData.addressLine2 && (
              <>
                <br />
                {shippingData.addressLine2}
              </>
            )}
            <br />
            {shippingData.city}, {shippingData.postcode}
          </p>

          {/* Client Information (Partners only) */}
          {isPartner && shippingData.isForClient && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-sm font-medium text-blue-800">Client: {shippingData.clientName}</p>
              <p className="text-sm text-blue-600">{shippingData.clientEmail}</p>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onEditShipping}
            className={`mt-2 p-0 h-auto ${isPartner ? 'text-green-600 hover:text-green-700' : 'text-purple-600 hover:text-purple-700'}`}
          >
            Edit shipping information
          </Button>
        </div>

        {/* Stripe Payment Form */}
        {clientSecret && stripePromise ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: primaryColor,
                  colorBackground: '#ffffff',
                  colorText: '#1f2937',
                  colorDanger: '#dc2626',
                  fontFamily: 'system-ui, sans-serif',
                  spacingUnit: '4px',
                  borderRadius: '8px',
                },
                rules: {
                  '.Input': {
                    border: '1px solid #d1d5db',
                    boxShadow: 'none',
                  },
                  '.Input:focus': {
                    border: `1px solid ${primaryColor}`,
                    boxShadow: `0 0 0 2px ${primaryColor}1a`,
                  },
                },
              },
            }}
          >
            <StripePaymentForm
              orderSummary={{
                subtotal: orderSummary.subtotal,
                shipping: orderSummary.shipping,
                discount: orderSummary.discount,
                total: orderSummary.total,
                items: orderSummary.items.map(item => ({
                  title: item.title,
                  product: isPartner && item.discountedPrice
                    ? `${userType === 'partner' ? 'Partner' : 'Customer'} Order - 15% Discount Applied`
                    : `${userType === 'partner' ? 'Partner' : 'Customer'} Order`,
                  price: item.discountedPrice || item.price,
                  quantity: item.quantity
                }))
              }}
              customerDetails={{
                email: shippingData.email,
                name: `${shippingData.firstName} ${shippingData.lastName}`,
                address: {
                  line1: shippingData.addressLine1 || shippingData.address,
                  line2: shippingData.addressLine2,
                  city: shippingData.city,
                  postal_code: shippingData.postcode,
                  country: shippingData.country,
                },
              }}
              onSuccess={onSuccess}
              onError={onError}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
            />
          </Elements>
        ) : (
          <div className="text-center py-8">
            <Loader2 className={`w-8 h-8 animate-spin mx-auto mb-4 ${isPartner ? 'text-green-600' : 'text-purple-600'}`} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Setting up secure payment...</h3>
            <p className="text-gray-600">Please wait</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}