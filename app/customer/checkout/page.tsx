"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, ArrowRight, CreditCard, Shield, Loader2 } from "lucide-react"
import Link from "next/link"
import { useServerCart } from "@/lib/server-cart-context"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from '@/lib/supabase-client'
import { Elements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe-client'
import StripePaymentForm from '@/components/StripePaymentForm'

export default function CustomerCheckoutPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [shippingData, setShippingData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    address: "",
    city: "",
    postcode: "",
    country: "United Kingdom",
  })
  const [referralCode, setReferralCode] = useState("")
  const [referralValidation, setReferralValidation] = useState<any>(null)
  const [validatingReferral, setValidatingReferral] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const { cart, getShippingCost, getCartTotal, clearCart } = useServerCart()
  const router = useRouter()
  const supabase = getSupabaseClient()
  const stripePromise = getStripe()

  // Load user profile and customer data
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        // First get auth user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          setLoading(false);
          return;
        }

        // Use the debug API to get full customer profile and customer data
        console.log('Checkout: Loading user profile for email:', user.email);
        const response = await fetch(`/api/debug/check-user-no-auth?email=${encodeURIComponent(user.email)}`);
        const result = await response.json();
        
        console.log('Checkout: Debug API response:', {
          hasUserProfile: !!result.userProfile,
          hasCustomer: !!result.customer,
          userType: result.userProfile?.user_type,
          error: result.error
        });
        
        if (result.userProfile || result.customer) {
          if (result.userProfile) {
            setUserProfile(result.userProfile);
          }
          
          console.log('Checkout: Pre-populating with data:', {
            firstName: result.userProfile?.first_name || result.customer?.first_name,
            lastName: result.userProfile?.last_name || result.customer?.last_name,
            email: result.userProfile?.email || user.email
          });
          
          // Pre-populate shipping data from customer profile and customer record
          setShippingData(prev => ({
            ...prev,
            email: result.userProfile?.email || user.email,
            firstName: result.userProfile?.first_name || result.customer?.first_name || prev.firstName,
            lastName: result.userProfile?.last_name || result.customer?.last_name || prev.lastName,
            // Note: We don't have address data in the current customer schema
            // In a real app, you'd store address in the customer record or separate addresses table
            address: prev.address, // Keep empty for now - user will need to enter
            city: prev.city,
            postcode: prev.postcode,
            country: "United Kingdom",
          }));

          // Always prioritize server-side referral code from customer record
          if (result.customer?.referral_code) {
            setReferralCode(result.customer.referral_code);
            // Update localStorage to match server data
            localStorage.setItem('referralCode', result.customer.referral_code);
          }
        } else {
          console.log('Checkout: No user profile or customer data found');
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  // Check for referral code in URL or localStorage (only if no server-side data available)
  useEffect(() => {
    // Only set referral code from URL/localStorage if we don't already have one from server-side customer data
    if (!referralCode) {
      const urlParams = new URLSearchParams(window.location.search)
      const urlReferralCode = urlParams.get('ref') || urlParams.get('referral')
      const storedReferralCode = localStorage.getItem('referralCode')
      
      if (urlReferralCode) {
        setReferralCode(urlReferralCode.toUpperCase())
        localStorage.setItem('referralCode', urlReferralCode.toUpperCase())
      } else if (storedReferralCode) {
        setReferralCode(storedReferralCode)
      }
    }
  }, [referralCode])

  // Validate referral code when it changes and user email is available
  useEffect(() => {
    if (referralCode && shippingData.email && cart.totalPrice > 0) {
      validateReferralCode()
    } else {
      setReferralValidation(null)
    }
  }, [referralCode, shippingData.email, cart.totalPrice])

  const validateReferralCode = async () => {
    if (!referralCode || !shippingData.email) return

    setValidatingReferral(true)
    try {
      const response = await fetch('/api/referrals/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCode: referralCode,
          customerEmail: shippingData.email,
          orderTotal: cart.totalPrice / 100 // Convert to pounds
        })
      })

      const data = await response.json()
      setReferralValidation(data)
      
      if (!data.valid) {
        setErrors(prev => ({ ...prev, referral: data.error }))
      } else {
        setErrors(prev => ({ ...prev, referral: '' }))
      }
    } catch (error) {
      console.error('Error validating referral:', error)
      setReferralValidation(null)
      setErrors(prev => ({ ...prev, referral: 'Failed to validate referral code' }))
    } finally {
      setValidatingReferral(false)
    }
  }

  const orderSummary = {
    subtotal: cart.totalPrice / 100, // Convert from pence to pounds
    shipping: getShippingCost() / 100,
    discount: referralValidation?.valid && referralValidation?.discount?.eligible 
      ? referralValidation.discount.amount / 100 // Already in pence from API
      : 0,
    // Apply discount to subtotal only, then add shipping
    total: (cart.totalPrice / 100) - (referralValidation?.valid && referralValidation?.discount?.eligible 
      ? referralValidation.discount.amount / 100 
      : 0) + (getShippingCost() / 100),
    items: cart.items.map(item => ({
      title: item.imageTitle,
      price: item.pricing.sale_price / 100, // Convert from pence to pounds
      quantity: item.quantity
    })),
  }


  const validateShipping = () => {
    const newErrors: Record<string, string> = {}

    if (!shippingData.firstName.trim()) newErrors.firstName = "First name is required"
    if (!shippingData.lastName.trim()) newErrors.lastName = "Last name is required"
    if (!shippingData.address.trim()) newErrors.address = "Address is required"
    if (!shippingData.city.trim()) newErrors.city = "City is required"
    if (!shippingData.postcode.trim()) newErrors.postcode = "Postcode is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validateShipping()) {
      setIsProcessing(true)
      try {
        await createPaymentIntent()
        setCurrentStep(2)
      } finally {
        setIsProcessing(false)
      }
    }
  }

  // Create PaymentIntent when moving to payment step
  const createPaymentIntent = async () => {
    try {
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: getCartTotal(), // in pence
          currency: 'gbp',
          customerEmail: shippingData.email,
          customerName: `${shippingData.firstName} ${shippingData.lastName}`,
          shippingAddress: shippingData,
          cartItems: cart.items.map(item => ({
            productId: item.productId,
            imageId: item.imageId,
            imageTitle: item.imageTitle,
            quantity: item.quantity,
            unitPrice: item.pricing.sale_price,
          })),
          referralCode: referralCode || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const data = await response.json();
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      
      console.log('PaymentIntent created:', {
        id: data.paymentIntentId,
        amount: data.amount,
        currency: data.currency,
      });
    } catch (error) {
      console.error('Error creating PaymentIntent:', error);
      alert('Failed to set up payment. Please try again.');
      setCurrentStep(1); // Go back to shipping step
    }
  };

  // Handle successful payment completion
  const handlePaymentSuccess = async (paymentIntent: any) => {
    try {
      console.log('Payment succeeded:', paymentIntent.id);
      
      // Clear cart
      await clearCart();
      
      // Redirect to order confirmation
      router.push(`/customer/order-confirmation?payment_intent=${paymentIntent.id}`);
      
    } catch (error) {
      console.error('Error handling payment success:', error);
      // Still redirect to confirmation since payment succeeded
      router.push(`/customer/order-confirmation?payment_intent=${paymentIntent.id}`);
    }
  };

  // Handle payment errors
  const handlePaymentError = (error: any) => {
    console.error('Payment failed:', error);
    setIsProcessing(false);
    
    // Show user-friendly error message
    let errorMessage = 'Payment failed. Please try again.';
    
    if (error.type === 'card_error' || error.type === 'validation_error') {
      errorMessage = error.message;
    }
    
    alert(errorMessage);
  };

  const handleInputChange = (field: string, value: string) => {
    setShippingData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const steps = [
    { number: 1, title: "Shipping", completed: currentStep > 1 },
    { number: 2, title: "Payment", completed: false },
    { number: 3, title: "Confirmation", completed: false },
  ]

  // Show loading state while user profile is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading your account information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/customer/cart" className="flex items-center text-gray-600 hover:text-purple-600 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cart
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    step.completed
                      ? "bg-green-600 text-white"
                      : currentStep === step.number
                        ? "bg-purple-600 text-white"
                        : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {step.completed ? "✓" : step.number}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    currentStep === step.number ? "text-purple-600" : "text-gray-600"
                  }`}
                >
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-4">
                    <div className={`h-1 rounded ${step.completed ? "bg-green-600" : "bg-gray-200"}`} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <Progress value={(currentStep / 3) * 100} className="h-2" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Step 1: Shipping Information */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleShippingSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          value={shippingData.firstName}
                          onChange={(e) => handleInputChange("firstName", e.target.value)}
                          className={`${errors.firstName ? "border-red-500" : ""} ${shippingData.firstName ? "bg-blue-50" : ""}`}
                          placeholder="John"
                        />
                        {shippingData.firstName && <p className="text-xs text-blue-600">Pre-filled from your profile</p>}
                        {errors.firstName && <p className="text-sm text-red-600">{errors.firstName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          value={shippingData.lastName}
                          onChange={(e) => handleInputChange("lastName", e.target.value)}
                          className={`${errors.lastName ? "border-red-500" : ""} ${shippingData.lastName ? "bg-blue-50" : ""}`}
                          placeholder="Doe"
                        />
                        {shippingData.lastName && <p className="text-xs text-blue-600">Pre-filled from your profile</p>}
                        {errors.lastName && <p className="text-sm text-red-600">{errors.lastName}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={shippingData.email}
                        readOnly
                        className="bg-gray-50 text-gray-700 cursor-not-allowed"
                        placeholder="Loading from your account..."
                      />
                      <p className="text-xs text-gray-500">Using email from your account</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Address *</Label>
                      <Input
                        id="address"
                        value={shippingData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        className={errors.address ? "border-red-500" : ""}
                        placeholder="123 Main Street"
                      />
                      {errors.address && <p className="text-sm text-red-600">{errors.address}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={shippingData.city}
                          onChange={(e) => handleInputChange("city", e.target.value)}
                          className={errors.city ? "border-red-500" : ""}
                          placeholder="London"
                        />
                        {errors.city && <p className="text-sm text-red-600">{errors.city}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postcode">Postcode *</Label>
                        <Input
                          id="postcode"
                          value={shippingData.postcode}
                          onChange={(e) => handleInputChange("postcode", e.target.value)}
                          className={errors.postcode ? "border-red-500" : ""}
                          placeholder="SW1A 1AA"
                        />
                        {errors.postcode && <p className="text-sm text-red-600">{errors.postcode}</p>}
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Setting up payment...
                        </>
                      ) : (
                        <>
                          Continue to Payment
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Payment */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="w-5 h-5 mr-2" />
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
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
                      {shippingData.address}
                      <br />
                      {shippingData.city}, {shippingData.postcode}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentStep(1)}
                      className="mt-2 text-purple-600 hover:text-purple-700 p-0 h-auto"
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
                            colorPrimary: '#7c3aed',
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
                              border: '1px solid #7c3aed',
                              boxShadow: '0 0 0 2px rgba(124, 58, 237, 0.1)',
                            },
                          },
                        },
                      }}
                    >
                      <StripePaymentForm
                        orderSummary={orderSummary}
                        customerDetails={{
                          email: shippingData.email,
                          name: `${shippingData.firstName} ${shippingData.lastName}`,
                          address: {
                            line1: shippingData.address,
                            city: shippingData.city,
                            postal_code: shippingData.postcode,
                            country: shippingData.country,
                          },
                        }}
                        onSuccess={handlePaymentSuccess}
                        onError={handlePaymentError}
                        isProcessing={isProcessing}
                        setIsProcessing={setIsProcessing}
                      />
                    </Elements>
                  ) : (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Setting up secure payment...</h3>
                      <p className="text-gray-600">Please wait</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderSummary.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.title} {item.quantity > 1 && `(×${item.quantity})`}
                    </span>
                    <span className="font-medium">£{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">£{orderSummary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">
                    {orderSummary.shipping === 0 ? "Free" : `£${orderSummary.shipping.toFixed(2)}`}
                  </span>
                </div>
                {referralCode && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-purple-600">
                      <span>Referral Code Applied</span>
                      <span className="font-medium">{referralCode}</span>
                    </div>
                    {validatingReferral && (
                      <div className="text-xs text-gray-500">Validating referral code...</div>
                    )}
                    {referralValidation?.valid && referralValidation?.discount?.eligible && (
                      <div className="flex justify-between text-green-600">
                        <span>First Order Discount (20%)</span>
                        <span className="font-medium">-£{orderSummary.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {referralValidation?.valid && !referralValidation?.discount?.eligible && (
                      <div className="text-xs text-gray-500">
                        {referralValidation.discount.description}
                      </div>
                    )}
                    {errors.referral && (
                      <div className="text-xs text-red-600">{errors.referral}</div>
                    )}
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>£{orderSummary.total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}