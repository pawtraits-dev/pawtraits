"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, ArrowRight, CreditCard, Shield, Loader2, Users, Percent } from "lucide-react"
import Link from "next/link"
import { useServerCart } from "@/lib/server-cart-context"
import { useRouter } from "next/navigation"

export default function PartnerCheckoutPage() {
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
    businessName: "",
    isForClient: false,
    clientName: "",
    clientEmail: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { cart, getShippingCost, getCartTotal, clearCart } = useServerCart()
  const router = useRouter()

  // Load user profile
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        // Use the supabaseService to get partner profile
        const supabaseService = new (await import('@/lib/supabase')).SupabaseService();
        const profile = await supabaseService.getCurrentUserProfile();
        
        if (profile && profile.user_type === 'partner') {
          setUserProfile(profile);
          
          // Try to get partner details for business info
          let partnerDetails = null;
          try {
            partnerDetails = await supabaseService.getCurrentPartner();
          } catch (error) {
            console.log('Could not fetch partner details:', error);
          }
          
          setShippingData(prev => ({
            ...prev,
            email: profile.email || '',
            firstName: profile.first_name || prev.firstName,
            lastName: profile.last_name || prev.lastName,
            businessName: partnerDetails?.business_name || prev.businessName,
            // Address would come from partner record if stored
            address: prev.address, // User will need to enter
            city: prev.city,
            postcode: prev.postcode,
            country: "United Kingdom",
          }));
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  const subtotal = cart.totalPrice / 100;
  const partnerDiscount = subtotal * 0.15; // 15% partner discount
  const discountedSubtotal = subtotal - partnerDiscount;
  const shipping = getShippingCost() / 100;
  const total = discountedSubtotal + shipping;

  const orderSummary = {
    subtotal: subtotal,
    discount: partnerDiscount,
    discountedSubtotal: discountedSubtotal,
    shipping: shipping,
    total: total,
    items: cart.items.map(item => ({
      title: item.imageTitle,
      price: item.pricing.sale_price / 100, // Convert from pence to pounds
      discountedPrice: (item.pricing.sale_price * 0.85) / 100, // Partner discount applied
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
    
    if (shippingData.isForClient) {
      if (!shippingData.clientName.trim()) newErrors.clientName = "Client name is required"
      if (!shippingData.clientEmail.trim()) newErrors.clientEmail = "Client email is required"
    }

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
      // Create order data with partner discount
      const orderData = {
        items: cart.items.map(item => ({
          productId: item.productId,
          imageId: item.imageId,
          imageUrl: item.imageUrl,
          imageTitle: item.imageTitle,
          quantity: item.quantity,
          unitPrice: Math.round(item.pricing.sale_price * 0.85), // Partner discount applied, in pence
          totalPrice: Math.round(item.pricing.sale_price * 0.85) * item.quantity // in pence
        })),
        shippingAddress: shippingData,
        totalAmount: Math.round(total * 100), // in pence
        shippingCost: getShippingCost(), // in pence
        currency: 'GBP',
        isPartnerOrder: true,
        partnerDiscount: Math.round(partnerDiscount * 100), // in pence
        clientInfo: shippingData.isForClient ? {
          name: shippingData.clientName,
          email: shippingData.clientEmail
        } : null
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
      router.push(`/partners/order-confirmation?orderId=${result.order.id}&orderNumber=${result.order.orderNumber}`)
      
    } catch (error) {
      console.error('Error creating order:', error)
      alert('There was an error processing your order. Please try again.')
      setIsProcessing(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
          <p className="text-gray-600">Loading your account information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/partners/cart" className="flex items-center text-gray-600 hover:text-green-600 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cart
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Partner Checkout</h1>
            <div className="flex items-center text-sm text-green-700 bg-green-100 rounded-full px-4 py-2">
              <Percent className="w-4 h-4 mr-2" />
              15% Partner Discount Applied
            </div>
          </div>
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
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {step.completed ? "✓" : step.number}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    currentStep === step.number ? "text-green-600" : "text-gray-600"
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
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Shipping Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleShippingSubmit} className="space-y-6">
                    {/* Client Toggle */}
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="isForClient"
                          checked={shippingData.isForClient}
                          onChange={(e) => handleInputChange("isForClient", e.target.checked)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <label htmlFor="isForClient" className="text-sm font-medium text-green-800">
                          This order is for a client
                        </label>
                      </div>
                      {shippingData.isForClient && (
                        <p className="text-xs text-green-700 mt-1">
                          Client information will be included in the order confirmation
                        </p>
                      )}
                    </div>

                    {/* Client Information (if applicable) */}
                    {shippingData.isForClient && (
                      <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                        <h3 className="font-medium text-blue-900">Client Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="clientName">Client Name *</Label>
                            <Input
                              id="clientName"
                              value={shippingData.clientName}
                              onChange={(e) => handleInputChange("clientName", e.target.value)}
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
                              value={shippingData.clientEmail}
                              onChange={(e) => handleInputChange("clientEmail", e.target.value)}
                              className={errors.clientEmail ? "border-red-500" : ""}
                              placeholder="client@example.com"
                            />
                            {errors.clientEmail && <p className="text-sm text-red-600">{errors.clientEmail}</p>}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          value={shippingData.firstName}
                          onChange={(e) => handleInputChange("firstName", e.target.value)}
                          className={`${errors.firstName ? "border-red-500" : ""} ${shippingData.firstName ? "bg-green-50" : ""}`}
                          placeholder="John"
                        />
                        {shippingData.firstName && <p className="text-xs text-green-600">Pre-filled from your profile</p>}
                        {errors.firstName && <p className="text-sm text-red-600">{errors.firstName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          value={shippingData.lastName}
                          onChange={(e) => handleInputChange("lastName", e.target.value)}
                          className={`${errors.lastName ? "border-red-500" : ""} ${shippingData.lastName ? "bg-green-50" : ""}`}
                          placeholder="Doe"
                        />
                        {shippingData.lastName && <p className="text-xs text-green-600">Pre-filled from your profile</p>}
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
                      <p className="text-xs text-gray-500">Using email from your partner account</p>
                    </div>

                    {shippingData.businessName && (
                      <div className="space-y-2">
                        <Label htmlFor="businessName">Business Name</Label>
                        <Input
                          id="businessName"
                          value={shippingData.businessName}
                          readOnly
                          className="bg-gray-50 text-gray-700 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500">From your partner profile</p>
                      </div>
                    )}

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

                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-3">
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
                    {shippingData.isForClient && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm font-medium text-blue-800">Client: {shippingData.clientName}</p>
                        <p className="text-sm text-blue-600">{shippingData.clientEmail}</p>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentStep(1)}
                      className="mt-2 text-green-600 hover:text-green-700 p-0 h-auto"
                    >
                      Edit shipping information
                    </Button>
                  </div>

                  {isProcessing ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Processing your order...</h3>
                      <p className="text-gray-600">Please don't close this page</p>
                    </div>
                  ) : (
                    <Button
                      onClick={handlePayment}
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-semibold"
                    >
                      Complete Order - £{orderSummary.total.toFixed(2)}
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
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Partner Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderSummary.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.title} {item.quantity > 1 && `(×${item.quantity})`}
                    </span>
                    <div className="text-right">
                      <div className="text-xs text-gray-400 line-through">£{(item.price * item.quantity).toFixed(2)}</div>
                      <div className="font-medium text-green-600">£{(item.discountedPrice * item.quantity).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">£{orderSummary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center">
                    <Percent className="w-4 h-4 mr-1" />
                    Partner Discount (15%)
                  </span>
                  <span className="font-medium">-£{orderSummary.discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discounted Subtotal</span>
                  <span className="font-medium">£{orderSummary.discountedSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">
                    {orderSummary.shipping === 0 ? "Free" : `£${orderSummary.shipping.toFixed(2)}`}
                  </span>
                </div>
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