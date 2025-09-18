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
import { ArrowLeft, ArrowRight, CreditCard, Shield, Loader2, Truck } from "lucide-react"
import Link from "next/link"
import { useHybridCart } from "@/lib/hybrid-cart-context"
import { useRouter } from "next/navigation"
import { useUserRouting } from "@/hooks/use-user-routing"
import UserAwareNavigation from '@/components/UserAwareNavigation'
import { CountryProvider, useCountryPricing } from '@/lib/country-context'
import { Elements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe-client'
import StripePaymentForm from '@/components/StripePaymentForm'
import { checkoutValidation } from '@/lib/checkout-validation'

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
  const [shippingOptions, setShippingOptions] = useState<any[]>([])
  const [selectedShippingOption, setSelectedShippingOption] = useState<any>(null)
  const [loadingShipping, setLoadingShipping] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const { items, totalItems, totalPrice, clearCart } = useHybridCart()
  const router = useRouter()
  const { userProfile, loading: userLoading } = useUserRouting()
  const stripePromise = getStripe()

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

  const subtotal = totalPrice / 100; // Convert from pence to pounds
  const shipping = selectedShippingOption ? (selectedShippingOption.price / 100) : 0;
  const discount = referralValidation?.valid && referralValidation?.discount?.eligible
    ? referralValidation.discount.amount / 100
    : 0;
  const total = subtotal - discount + shipping;

  const orderSummary = {
    subtotal: subtotal,
    shipping: shipping,
    discount: discount,
    total: total,
    items: items.map(item => ({
      title: item.imageTitle,
      price: item.pricing.sale_price / 100, // Convert from pence to pounds
      quantity: item.quantity
    })),
  }

  const validateShipping = () => {
    // Use the shared checkout validation service
    const addressValidation = checkoutValidation.validateAddress(shippingData, []);

    if (addressValidation.isValid) {
      setErrors({});
      return true;
    } else {
      const newErrors: Record<string, string> = {};
      if (addressValidation.error) {
        newErrors.general = addressValidation.error;
      }
      setErrors(newErrors);
      return false;
    }
  }

  // Fetch shipping options from Gelato after address validation
  const fetchShippingOptions = async () => {
    if (!validateShipping()) {
      return;
    }

    setLoadingShipping(true);
    setErrors(prev => ({ ...prev, shipping: '' }));

    try {
      console.log('🚚 Fetching shipping options from Gelato...');

      // Create shipping address object using the new address lines
      const addressLines = checkoutValidation.getAddressLinesForGelato(shippingData);
      const shippingAddress = {
        firstName: shippingData.firstName,
        lastName: shippingData.lastName,
        address1: addressLines.address1,
        address2: addressLines.address2,
        city: shippingData.city,
        postalCode: shippingData.postcode,
        country: shippingData.country === 'GB' ? 'GB' : shippingData.country
      };

      // Call our shipping API endpoint
      const response = await fetch('/api/shipping/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          shippingAddress,
          cartItems: items.map(item => ({
            gelatoProductUid: item.gelatoProductUid,
            quantity: item.quantity,
            printSpecs: item.printSpecs
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch shipping options');
      }

      const { shippingOptions: options } = await response.json();

      console.log('🚚 Received shipping options:', options);

      if (!options || options.length === 0) {
        throw new Error('No shipping options available for this address');
      }

      setShippingOptions(options);

      // Auto-select the first option
      setSelectedShippingOption(options[0]);

      // Move to step 2 (shipping selection)
      setCurrentStep(2);

    } catch (error) {
      console.error('Error fetching shipping options:', error);
      setErrors(prev => ({
        ...prev,
        shipping: error instanceof Error ? error.message : 'Failed to fetch shipping options'
      }));
    } finally {
      setLoadingShipping(false);
    }
  };

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Step 1: Validate shipping address and fetch shipping options
    await fetchShippingOptions();
  }

  // Handle shipping option selection and move to payment
  const handleShippingOptionSubmit = async () => {
    if (!selectedShippingOption) {
      setErrors({ shipping: 'Please select a shipping option' });
      return;
    }

    setIsProcessing(true);
    try {
      console.log('✅ Shipping option selected, proceeding with payment setup...');
      await createPaymentIntent()
      setCurrentStep(3) // Now step 3 since we added shipping selection
    } finally {
      setIsProcessing(false)
    }
  }

  // Create PaymentIntent when moving to payment step
  const createPaymentIntent = async () => {
    try {
      const totalAmount = Math.round(total * 100); // Total including shipping in pence
      const customerName = `${shippingData.firstName} ${shippingData.lastName}`.trim();

      // Client-side validation
      if (totalAmount <= 0) {
        throw new Error('Cart is empty - cannot create payment');
      }

      if (!shippingData.email || shippingData.email.trim() === '') {
        throw new Error('Email is required');
      }

      if (!customerName || customerName === '') {
        throw new Error('Name is required');
      }

      const paymentData = {
        amount: totalAmount, // Total including shipping in pence
        currency: 'gbp',
        customerEmail: shippingData.email.trim(),
        customerName: customerName,
        userType: 'customer',
        shippingAddress: shippingData,
        shippingOption: selectedShippingOption,
        cartItems: items.map(item => ({
          productId: item.productId,
          imageId: item.imageId,
          imageTitle: item.imageTitle,
          quantity: item.quantity,
          unitPrice: item.pricing.sale_price, // in pence
          totalPrice: item.pricing.sale_price * item.quantity, // in pence
          // Enhanced Gelato data for order fulfillment
          gelatoProductUid: item.gelatoProductUid,
          printSpecs: item.printSpecs
        })),
        // Customer-specific metadata
        referralCode: referralCode || undefined
      };

      console.log('Creating Customer PaymentIntent with data:', {
        amount: paymentData.amount,
        customerEmail: paymentData.customerEmail,
        customerName: paymentData.customerName,
        cartItemsCount: paymentData.cartItems.length,
      });

      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Customer PaymentIntent creation error:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to create payment intent');
      }

      const data = await response.json();
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);

      console.log('Customer PaymentIntent created:', {
        id: data.paymentIntentId,
        amount: data.amount,
        currency: data.currency,
      });
    } catch (error) {
      console.error('Error creating Customer PaymentIntent:', error);
      alert('Failed to set up payment. Please try again.');
      setCurrentStep(1); // Go back to shipping step
    }
  };

  // Handle successful payment completion
  const handlePaymentSuccess = async (paymentIntent: any) => {
    try {
      console.log('Customer payment succeeded:', paymentIntent.id);

      // Clear cart
      await clearCart();

      // Redirect to order confirmation
      router.push(`/shop/order-confirmation?payment_intent=${paymentIntent.id}`);

    } catch (error) {
      console.error('Error handling customer payment success:', error);
      // Still redirect to confirmation since payment succeeded
      router.push(`/shop/order-confirmation?payment_intent=${paymentIntent.id}`);
    }
  };

  // Handle payment errors
  const handlePaymentError = (error: any) => {
    console.error('Customer payment failed:', error);
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
    { number: 1, title: "Address", completed: currentStep > 1 },
    { number: 2, title: "Shipping", completed: currentStep > 2 },
    { number: 3, title: "Payment", completed: false },
  ]

  // Show loading state while user profile is loading
  if (userLoading) {
    console.log('🔄 CHECKOUT - User loading, showing loading spinner');
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
  console.log('🔍 CHECKOUT - Auth check:', {
    userLoading,
    userProfile: userProfile ? {
      id: userProfile.id,
      email: userProfile.email,
      user_type: userProfile.user_type
    } : null
  });

  if (!userLoading && !userProfile) {
    console.log('❌ CHECKOUT - User not authenticated, showing sign-in prompt');
    const returnUrl = encodeURIComponent('/shop/checkout')
    return (
      <>
        <UserAwareNavigation />
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
      <UserAwareNavigation />
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
                    {/* General validation errors */}
                    {errors.general && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-red-600 text-sm">{errors.general}</p>
                      </div>
                    )}

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

                    <Button
                      type="submit"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3"
                      disabled={loadingShipping}
                    >
                      {loadingShipping ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Finding shipping options...
                        </>
                      ) : (
                        <>
                          Continue to Shipping Options
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Shipping Options */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Truck className="w-5 h-5 mr-2" />
                    Select Shipping Option
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loadingShipping ? (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
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
                        {shippingOptions.map((option, index) => (
                          <div
                            key={index}
                            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                              selectedShippingOption?.id === option.id
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-200 hover:border-purple-300'
                            }`}
                            onClick={() => setSelectedShippingOption(option)}
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
                                {selectedShippingOption?.id === option.id && (
                                  <p className="text-purple-600 text-sm">Selected</p>
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
                          onClick={() => setCurrentStep(1)}
                          className="flex-1"
                        >
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Back to Address
                        </Button>
                        <Button
                          type="button"
                          onClick={handleShippingOptionSubmit}
                          disabled={!selectedShippingOption || isProcessing}
                          className="flex-1 bg-purple-600 hover:bg-purple-700"
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
            )}

            {/* Step 3: Payment */}
            {currentStep === 3 && (
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
                      {shippingData.addressLine1 || shippingData.address}
                      <br />
                      {shippingData.city}, {shippingData.postcode}
                    </p>
                    {selectedShippingOption && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-900">Shipping: {selectedShippingOption.name}</p>
                        <p className="text-sm text-gray-600">
                          {selectedShippingOption.price === 0 ? 'Free' : `£${(selectedShippingOption.price / 100).toFixed(2)}`}
                        </p>
                      </div>
                    )}
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
                            colorPrimary: '#9333ea', // Purple theme for customers
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
                              border: '1px solid #9333ea',
                              boxShadow: '0 0 0 2px rgba(147, 51, 234, 0.1)',
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
                            line1: shippingData.addressLine1 || shippingData.address,
                            line2: shippingData.addressLine2,
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
                    {selectedShippingOption ? (
                      selectedShippingOption.price === 0 ? 'Free' : `£${orderSummary.shipping.toFixed(2)}`
                    ) : (
                      <span className="text-gray-500">Select shipping option</span>
                    )}
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
                {!selectedShippingOption && (
                  <div className="text-xs text-gray-500 text-center">
                    Shipping will be added after selecting delivery option
                  </div>
                )}
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
