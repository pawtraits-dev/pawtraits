"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, ArrowRight, CreditCard, Shield, Loader2 } from "lucide-react"
import Link from "next/link"
import { useHybridCart } from "@/lib/hybrid-cart-context"
import { useRouter } from "next/navigation"
import { useUserRouting } from "@/hooks/use-user-routing"
import PublicNavigation from '@/components/PublicNavigation'
import { CountryProvider, useCountryPricing } from '@/lib/country-context'

function CheckoutPageContent() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const { selectedCountry, getCountryPricing } = useCountryPricing()
  const [shippingData, setShippingData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    address: "", // Keep for backward compatibility
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    country: selectedCountry || "GB",
  })
  const [referralCode, setReferralCode] = useState("")
  const [referralValidation, setReferralValidation] = useState<any>(null)
  const [validatingReferral, setValidatingReferral] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { items, totalItems, totalPrice, clearCart } = useHybridCart()
  const router = useRouter()
  const { userProfile, loading: userLoading } = useUserRouting()

  // Note: Shipping costs will be calculated via Gelato API at checkout time
  // For now, we just show the cart total without shipping
  const getCartTotal = () => {
    return totalPrice
  }

  // Update shipping data when user profile loads
  useEffect(() => {
    if (userProfile?.email) {
      setShippingData(prev => ({
        ...prev,
        email: userProfile.email || '',
        firstName: userProfile.first_name || prev.firstName,
        lastName: userProfile.last_name || prev.lastName,
      }))
    }
  }, [userProfile])

  // Update country when selectedCountry changes
  useEffect(() => {
    if (selectedCountry) {
      setShippingData(prev => ({
        ...prev,
        country: selectedCountry,
      }))
    }
  }, [selectedCountry])

  // Check for referral code in URL or localStorage
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlReferralCode = urlParams.get('ref') || urlParams.get('referral')
    const storedReferralCode = localStorage.getItem('referralCode')
    
    if (urlReferralCode) {
      setReferralCode(urlReferralCode.toUpperCase())
      localStorage.setItem('referralCode', urlReferralCode.toUpperCase())
    } else if (storedReferralCode) {
      setReferralCode(storedReferralCode)
    }
  }, [])

  // Validate referral code when it changes and user email is available
  useEffect(() => {
    if (referralCode && shippingData.email && totalPrice > 0) {
      validateReferralCode()
    } else {
      setReferralValidation(null)
    }
  }, [referralCode, shippingData.email, totalPrice])

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
          orderTotal: totalPrice / 100 // Convert to pounds
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
    subtotal: totalPrice / 100, // Convert from pence to pounds
    shipping: 0, // Shipping calculated by Gelato at fulfillment
    discount: referralValidation?.valid && referralValidation?.discount?.eligible
      ? referralValidation.discount.amount / 100
      : 0,
    // Apply discount to subtotal only - shipping calculated at checkout via Gelato
    total: (totalPrice / 100) - (referralValidation?.valid && referralValidation?.discount?.eligible
      ? referralValidation.discount.amount / 100
      : 0),
    items: items.map(item => ({
      title: item.imageTitle,
      price: item.pricing.sale_price / 100, // Convert from pence to pounds
      quantity: item.quantity
    })),
  }

  const validateShipping = () => {
    const newErrors: Record<string, string> = {}

    if (!shippingData.firstName.trim()) newErrors.firstName = "First name is required"
    if (!shippingData.lastName.trim()) newErrors.lastName = "Last name is required"
    // Email validation removed since it's auto-populated from user profile
    if (!shippingData.addressLine1.trim()) newErrors.addressLine1 = "Address line 1 is required"
    if (!shippingData.city.trim()) newErrors.city = "City is required"
    if (!shippingData.postcode.trim()) newErrors.postcode = "Postcode is required"
    if (!shippingData.country.trim()) newErrors.country = "Country is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateShipping()) {
      setCurrentStep(2)
    }
  }

  const handlePayment = async () => {
    setIsProcessing(true)

    try {
      // Create order data
      const orderData = {
        items: items.map(item => ({
          productId: item.productId,
          imageId: item.imageId,
          imageUrl: item.imageUrl,
          imageTitle: item.imageTitle,
          quantity: item.quantity,
          unitPrice: item.pricing.sale_price, // in pence
          totalPrice: item.pricing.sale_price * item.quantity // in pence
        })),
        shippingAddress: shippingData,
        totalAmount: getCartTotal(), // in pence, shipping added by Gelato
        currency: 'GBP',
        referralCode: referralCode || undefined
      }

      // Create order via API
      const response = await fetch('/api/shop/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      })

      if (!response.ok) {
        throw new Error('Failed to create order')
      }

      const result = await response.json()
      
      // Clear cart and redirect to confirmation with order details
      clearCart()
      const confirmationRoute = userProfile?.user_type === 'partner' ? '/partners/order-confirmation' : userProfile?.user_type === 'customer' ? '/customer/order-confirmation' : '/shop/order-confirmation';
      router.push(`${confirmationRoute}?orderId=${result.order.id}&orderNumber=${result.order.orderNumber}`)
      
    } catch (error) {
      console.error('Error creating order:', error)
      alert('There was an error processing your order. Please try again.')
      setIsProcessing(false)
    }
  }

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
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    )
  }

  // Redirect to signup/login if user is not authenticated
  if (!userLoading && !userProfile) {
    const returnUrl = encodeURIComponent('/shop/checkout')
    return (
      <>
        <PublicNavigation />
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="text-center">
              <CardHeader>
                <CardTitle className="flex items-center justify-center space-x-2">
                  <Shield className="w-6 h-6 text-purple-600" />
                  <span>Sign In Required</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Please create an account or sign in to complete your purchase.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Why do I need an account?</h4>
                    <ul className="text-sm text-blue-800 space-y-1 text-left">
                      <li>• Track your orders and delivery status</li>
                      <li>• Save your shipping information</li>
                      <li>• Access your order history</li>
                      <li>• Receive updates about your portraits</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link href={`/signup?returnTo=${returnUrl}`} className="block">
                    <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3">
                      Create Account & Continue
                    </Button>
                  </Link>

                  <div className="flex items-center">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="px-3 text-sm text-gray-500">or</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>

                  <Link href={`/auth/login?returnTo=${returnUrl}`} className="block">
                    <Button variant="outline" className="w-full py-3">
                      Sign In to Existing Account
                    </Button>
                  </Link>
                </div>

                <div className="text-center">
                  <Link href="/shop/cart" className="text-sm text-gray-600 hover:text-purple-600">
                    ← Back to Cart
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PublicNavigation />
      <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href={userProfile?.user_type === 'partner' ? '/partners/cart' : userProfile?.user_type === 'customer' ? '/customer/cart' : '/shop/cart'} className="flex items-center text-gray-600 hover:text-purple-600 mb-4">
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
                          className={errors.firstName ? "border-red-500" : ""}
                          placeholder="John"
                        />
                        {errors.firstName && <p className="text-sm text-red-600">{errors.firstName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          value={shippingData.lastName}
                          onChange={(e) => handleInputChange("lastName", e.target.value)}
                          className={errors.lastName ? "border-red-500" : ""}
                          placeholder="Doe"
                        />
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
                      <Label htmlFor="addressLine1">Address Line 1 *</Label>
                      <Input
                        id="addressLine1"
                        value={shippingData.addressLine1}
                        onChange={(e) => {
                          handleInputChange("addressLine1", e.target.value);
                          // Update the old address field for backward compatibility
                          handleInputChange("address", e.target.value);
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
                        value={shippingData.addressLine2}
                        onChange={(e) => handleInputChange("addressLine2", e.target.value)}
                        placeholder="Apartment, suite, etc."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={shippingData.city}
                          onChange={(e) => handleInputChange("city", e.target.value)}
                          className={errors.city ? "border-red-500" : ""}
                          placeholder="San Francisco"
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
                          placeholder="94102"
                        />
                        {errors.postcode && <p className="text-sm text-red-600">{errors.postcode}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country *</Label>
                      <Select value={shippingData.country} onValueChange={(value) => handleInputChange("country", value)}>
                        <SelectTrigger className={errors.country ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GB">United Kingdom</SelectItem>
                          <SelectItem value="US">United States</SelectItem>
                          <SelectItem value="CA">Canada</SelectItem>
                          <SelectItem value="AU">Australia</SelectItem>
                          <SelectItem value="DE">Germany</SelectItem>
                          <SelectItem value="FR">France</SelectItem>
                          <SelectItem value="ES">Spain</SelectItem>
                          <SelectItem value="IT">Italy</SelectItem>
                          <SelectItem value="NL">Netherlands</SelectItem>
                          <SelectItem value="BE">Belgium</SelectItem>
                          <SelectItem value="CH">Switzerland</SelectItem>
                          <SelectItem value="AT">Austria</SelectItem>
                          <SelectItem value="DK">Denmark</SelectItem>
                          <SelectItem value="SE">Sweden</SelectItem>
                          <SelectItem value="NO">Norway</SelectItem>
                          <SelectItem value="IE">Ireland</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.country && <p className="text-sm text-red-600">{errors.country}</p>}
                    </div>

                    <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3">
                      Continue to Payment
                      <ArrowRight className="w-4 h-4 ml-2" />
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

                  {isProcessing ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Processing your order...</h3>
                      <p className="text-gray-600">Please don't close this page</p>
                    </div>
                  ) : (
                    <Button
                      onClick={handlePayment}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 text-lg font-semibold"
                    >
                      Complete Order - £{orderSummary.total.toFixed(2)} + shipping
                    </Button>
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
                  <span className="font-medium text-gray-500">
                    Calculated at checkout
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
                  <span>Subtotal</span>
                  <span>£{orderSummary.total.toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-500 text-right">
                  + shipping (calculated by Gelato)
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}

export default function CheckoutPage() {
  return (
    <CountryProvider>
      <CheckoutPageContent />
    </CountryProvider>
  )
}
