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
import { ArrowLeft, ArrowRight, CreditCard, Shield, Loader2, Users, Percent } from "lucide-react"
import Link from "next/link"
import { useServerCart } from "@/lib/server-cart-context"
import { useRouter } from "next/navigation"
import { SupabaseService } from '@/lib/supabase'
import { Elements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe-client'
import StripePaymentForm from '@/components/StripePaymentForm'

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
  const [shippingOptions, setShippingOptions] = useState<any[]>([])
  const [selectedShippingOption, setSelectedShippingOption] = useState<any>(null)
  const [loadingShipping, setLoadingShipping] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const { cart, clearCart } = useServerCart()
  const router = useRouter()
  const supabaseService = new SupabaseService()
  const stripePromise = getStripe()

  // Load user profile - using same pattern as customer/checkout page
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        console.log('🔧 Loading partner data using SupabaseService...');
        
        // Use EXACT same approach as customer checkout page
        const partnerData = await supabaseService.getCurrentUserProfile();
        console.log('🔧 Partner data received via SupabaseService:', partnerData);
        
        if (partnerData && partnerData.user_type === 'partner') {
          setUserProfile(partnerData);
          
          // Try to get partner details for business info
          let partnerDetails = null;
          try {
            partnerDetails = await supabaseService.getCurrentPartner();
          } catch (error) {
            console.log('Could not fetch partner details:', error);
          }
          
          // Pre-populate shipping data using same pattern
          const profileData = {
            firstName: partnerData.first_name || '',
            lastName: partnerData.last_name || '',
            email: partnerData.email || '',
          };
          
          console.log('Partner checkout: Setting profile data to:', profileData);
          setShippingData(prev => ({
            ...prev,
            email: profileData.email,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            businessName: partnerDetails?.business_name || prev.businessName,
            // Keep address fields empty for user to enter
            address: prev.address,
            city: prev.city,
            postcode: prev.postcode,
            country: "United Kingdom",
          }));
        } else {
          console.log('Partner checkout: No partner data found or user is not a partner');
        }
      } catch (error) {
        console.error('Error loading partner data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  const subtotal = cart.totalPrice / 100;
  const partnerDiscount = subtotal * 0.15; // 15% partner discount
  const discountedSubtotal = subtotal - partnerDiscount;
  const shipping = selectedShippingOption ? (selectedShippingOption.price / 100) : 0;
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
    if (!shippingData.email.trim()) {
      newErrors.email = "Email address is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingData.email.trim())) {
      newErrors.email = "Please enter a valid email address"
    }
    if (!shippingData.address.trim()) newErrors.address = "Address is required"
    if (!shippingData.city.trim()) newErrors.city = "City is required"
    if (!shippingData.postcode.trim()) newErrors.postcode = "Postcode is required"
    
    if (shippingData.isForClient) {
      if (!shippingData.clientName.trim()) newErrors.clientName = "Client name is required"
      if (!shippingData.clientEmail.trim()) {
        newErrors.clientEmail = "Client email is required"
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingData.clientEmail.trim())) {
        newErrors.clientEmail = "Please enter a valid client email address"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Validate cart items for Gelato availability (Step 2 implementation)
  const validateCartForGelato = async () => {
    try {
      const { data: { session } } = await supabaseService.getClient().auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required for validation');
      }

      const response = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mode: 'full' // Full validation including Gelato API calls
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Validation failed: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('🔍 Partner cart validation result:', {
        isValid: data.isValid,
        errors: data.errors?.length || 0,
        warnings: data.warnings?.length || 0
      });

      return data;
    } catch (error) {
      console.error('Error validating partner cart:', error);
      
      // Return a failed validation result
      return {
        isValid: false,
        errors: [{
          itemIndex: -1,
          imageId: 'unknown',
          imageTitle: 'Validation Error',
          error: `Validation service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'API_ERROR'
        }],
        warnings: []
      };
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
      
      // Create shipping address object
      const shippingAddress = {
        firstName: shippingData.firstName,
        lastName: shippingData.lastName,
        address1: shippingData.address,
        city: shippingData.city,
        postalCode: shippingData.postcode,
        country: 'GB' // Partner orders are UK only for now
      };

      // Get auth token for API calls
      const { data: { session } } = await supabaseService.getClient().auth.getSession();
      const token = session?.access_token;
      
      // Call our shipping API endpoint
      const response = await fetch('/api/shipping/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          shippingAddress,
          cartItems: cart.items.map(item => ({
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
      // Step 2: Validate cart items for Gelato availability before payment
      console.log('🔍 Validating partner cart for Gelato availability...');
      const validationResult = await validateCartForGelato();
      
      if (!validationResult.isValid) {
        console.error('❌ Partner cart validation failed:', validationResult.errors);
        
        // Show user-friendly error message
        const errorMessage = validationResult.errors.length > 0 
          ? `Unable to process partner order: ${validationResult.errors[0].error}` 
          : 'Some items in your cart cannot be printed. Please review your cart.';
        
        alert(errorMessage + '\n\nPlease remove or replace the affected items and try again.');
        return;
      }
      
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        console.warn('⚠️ Partner cart validation warnings:', validationResult.warnings);
        // Continue with warnings, but log them
      }
      
      console.log('✅ Partner cart validation passed, proceeding with payment...');
      await createPaymentIntent()
      setCurrentStep(3) // Now step 3 since we added shipping selection
    } finally {
      setIsProcessing(false)
    }
  }

  // Create PaymentIntent when moving to payment step - same pattern as customer checkout
  const createPaymentIntent = async () => {
    try {
      const partnerTotal = Math.round(total * 100); // Partner total with discount in pence
      const customerName = `${shippingData.firstName} ${shippingData.lastName}`.trim();
      
      // Client-side validation
      if (partnerTotal <= 0) {
        throw new Error('Cart is empty - cannot create payment');
      }
      
      if (!shippingData.email || shippingData.email.trim() === '') {
        throw new Error('Partner email is required');
      }
      
      if (!customerName || customerName === '') {
        throw new Error('Partner name is required');
      }
      
      const paymentData = {
        amount: partnerTotal, // Partner discounted total in pence
        currency: 'gbp',
        customerEmail: shippingData.email.trim(),
        customerName: customerName,
        shippingAddress: shippingData,
        cartItems: cart.items.map(item => ({
          productId: item.productId,
          imageId: item.imageId,
          imageTitle: item.imageTitle,
          quantity: item.quantity,
          unitPrice: Math.round(item.pricing.sale_price * 0.85), // Partner discount applied
          // Enhanced Gelato data for order fulfillment
          gelatoProductUid: item.gelatoProductUid,
          printSpecs: item.printSpecs
        })),
        // Partner-specific metadata
        isPartnerOrder: true,
        partnerDiscount: Math.round(partnerDiscount * 100), // in pence
        clientInfo: shippingData.isForClient ? {
          name: shippingData.clientName,
          email: shippingData.clientEmail
        } : undefined,
      };

      // Debug logging
      console.log('Creating Partner PaymentIntent with data:', {
        amount: paymentData.amount,
        customerEmail: paymentData.customerEmail,
        customerName: paymentData.customerName,
        cartItemsCount: paymentData.cartItems.length,
        partnerDiscount: paymentData.partnerDiscount,
        isPartnerOrder: paymentData.isPartnerOrder,
        clientInfo: paymentData.clientInfo
      });

      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Partner PaymentIntent creation error:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to create payment intent');
      }

      const data = await response.json();
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      
      console.log('Partner PaymentIntent created:', {
        id: data.paymentIntentId,
        amount: data.amount,
        currency: data.currency,
      });
    } catch (error) {
      console.error('Error creating Partner PaymentIntent:', error);
      alert('Failed to set up payment. Please try again.');
      setCurrentStep(1); // Go back to shipping step
    }
  };

  // Handle successful payment completion
  const handlePaymentSuccess = async (paymentIntent: any) => {
    try {
      console.log('Partner payment succeeded:', paymentIntent.id);
      
      // Clear cart
      await clearCart();
      
      // Redirect to order confirmation - use partners route
      router.push(`/partners/order-confirmation?payment_intent=${paymentIntent.id}`);
      
    } catch (error) {
      console.error('Error handling partner payment success:', error);
      // Still redirect to confirmation since payment succeeded
      router.push(`/partners/order-confirmation?payment_intent=${paymentIntent.id}`);
    }
  };

  // Handle payment errors
  const handlePaymentError = (error: any) => {
    console.error('Partner payment failed:', error);
    setIsProcessing(false);
    
    // Show user-friendly error message
    let errorMessage = 'Payment failed. Please try again.';
    
    if (error.type === 'card_error' || error.type === 'validation_error') {
      errorMessage = error.message;
    }
    
    alert(errorMessage);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
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
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={shippingData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className={`${errors.email ? "border-red-500" : ""} ${shippingData.email && !errors.email ? "bg-green-50" : ""}`}
                        placeholder="Enter your email address"
                      />
                      {shippingData.email && !errors.email && <p className="text-xs text-green-600">Email address confirmed</p>}
                      {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
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

                    <Button 
                      type="submit" 
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
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
                        {shippingOptions.map((option, index) => (
                          <div
                            key={index}
                            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                              selectedShippingOption?.id === option.id
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 hover:border-green-300'
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
                          className="flex-1 bg-green-600 hover:bg-green-700"
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

                  {/* Stripe Payment Form */}
                  {clientSecret && stripePromise ? (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: 'stripe',
                          variables: {
                            colorPrimary: '#16a34a', // Green theme for partners
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
                              border: '1px solid #16a34a',
                              boxShadow: '0 0 0 2px rgba(22, 163, 74, 0.1)',
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
                            product: `Partner Order - 15% Discount Applied`,
                            price: item.discountedPrice,
                            quantity: item.quantity
                          }))
                        }}
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
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
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