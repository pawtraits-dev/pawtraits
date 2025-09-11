'use client'

import React, { useState } from 'react'
import {
  useStripe,
  useElements,
  PaymentElement,
  AddressElement,
} from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CreditCard, AlertCircle } from 'lucide-react'

interface OrderSummary {
  subtotal: number
  shipping: number
  discount: number
  total: number
  items: Array<{
    title: string
    price: number
    quantity: number
  }>
}

interface CustomerDetails {
  email: string
  name: string
  address: {
    line1: string
    line2?: string
    city: string
    postal_code: string
    country: string
  }
}

interface StripePaymentFormProps {
  orderSummary: OrderSummary
  customerDetails: CustomerDetails
  onSuccess: (paymentIntent: any) => void
  onError: (error: any) => void
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
}

export default function StripePaymentForm({
  orderSummary,
  customerDetails,
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing,
}: StripePaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [paymentElementReady, setPaymentElementReady] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      setError('Stripe has not loaded yet. Please try again.')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Confirm the payment with Stripe
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/customer/order-confirmation`,
          receipt_email: customerDetails.email,
        },
        redirect: 'if_required', // Only redirect if required by payment method
      })

      if (confirmError) {
        console.error('Payment confirmation error:', confirmError)
        
        // Handle different types of errors
        let errorMessage = 'Payment failed. Please try again.'
        
        if (confirmError.type === 'card_error' || confirmError.type === 'validation_error') {
          errorMessage = confirmError.message || errorMessage
        } else if (confirmError.type === 'invalid_request_error') {
          errorMessage = 'Invalid payment details. Please check your information and try again.'
        }
        
        setError(errorMessage)
        onError(confirmError)
      } else if (paymentIntent) {
        // Payment succeeded
        console.log('Payment successful:', paymentIntent)
        onSuccess(paymentIntent)
      }
    } catch (err) {
      console.error('Unexpected error during payment:', err)
      setError('An unexpected error occurred. Please try again.')
      onError(err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePaymentElementReady = () => {
    setPaymentElementReady(true)
  }

  const handlePaymentElementChange = (event: any) => {
    if (event.error) {
      setError(event.error.message)
    } else {
      setError(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Method */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <CreditCard className="w-5 h-5 mr-2" />
          Payment Details
        </h3>
        
        <div className="p-4 border border-gray-200 rounded-lg">
          <PaymentElement
            onReady={handlePaymentElementReady}
            onChange={handlePaymentElementChange}
            options={{
              layout: {
                type: 'tabs',
                defaultCollapsed: false,
              },
            }}
          />
        </div>
      </div>

      {/* Billing Address */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Billing Address</h3>
        <div className="p-4 border border-gray-200 rounded-lg">
          <AddressElement
            options={{
              mode: 'billing',
              defaultValues: {
                name: customerDetails.name,
                address: {
                  line1: customerDetails.address.line1,
                  ...(customerDetails.address.line2 && { line2: customerDetails.address.line2 }),
                  city: customerDetails.address.city,
                  postal_code: customerDetails.address.postal_code,
                  country: customerDetails.address.country,
                },
              },
            }}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Order Total and Submit Button */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-medium text-gray-900">Total</span>
          <span className="text-xl font-bold text-gray-900">£{orderSummary.total.toFixed(2)}</span>
        </div>
        
        <Button
          type="submit"
          disabled={!stripe || !paymentElementReady || isProcessing}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing Payment...
            </>
          ) : (
            `Pay £${orderSummary.total.toFixed(2)}`
          )}
        </Button>
      </div>

      {/* Security Notice */}
      <div className="text-center text-sm text-gray-500">
        <div className="flex items-center justify-center">
          <div className="w-4 h-4 mr-1">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z" />
            </svg>
          </div>
          Secured by Stripe. Your payment information is encrypted and secure.
        </div>
      </div>
    </form>
  )
}