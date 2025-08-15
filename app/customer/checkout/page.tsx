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
import { useServerCart } from "@/lib/server-cart-context"
import { useCountry } from "@/lib/country-context"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from '@/lib/supabase-client'
import { SupabaseService } from '@/lib/supabase'
import { Elements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe-client'
import { formatPrice } from '@/lib/product-types'
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
    country: "", // Will be set from selectedCountryData
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
  const { cart, clearCart } = useServerCart()
  const { selectedCountry, selectedCountryData, countries, isLoading: countriesLoading } = useCountry()
  const router = useRouter()
  const supabase = getSupabaseClient()
  const supabaseService = new SupabaseService()
  const stripePromise = getStripe()

  // Load user profile and customer data - using same pattern as customer/account page
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        console.log('🔧 Loading customer data using SupabaseService (same as account page)...');
        
        // Use EXACT same approach as customer account page
        const customerData = await supabaseService.getCurrentUserProfile();
        console.log('🔧 Customer data received via SupabaseService:', customerData);
        
        if (customerData) {
          setUserProfile(customerData);
          
          // Pre-populate shipping data using same pattern as account page
          const profileData = {
            firstName: customerData.first_name || '',
            lastName: customerData.last_name || '',
            email: customerData.email || '',
          };
          
          console.log('Checkout: Setting profile data to:', profileData);
          setShippingData(prev => ({
            ...prev,
            email: profileData.email,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            // Keep address fields empty for user to enter
            address: prev.address,
            city: prev.city,
            postcode: prev.postcode,
            country: selectedCountryData?.name || "United Kingdom",
          }));

          // Check for referral code (keeping existing logic)
          const storedReferralCode = localStorage.getItem('referralCode')
          if (storedReferralCode) {
            setReferralCode(storedReferralCode);
          }
        } else {
          console.log('Checkout: No customer data found');
        }
      } catch (error) {
        console.error('Error loading customer data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  // Set default country when countries load or selectedCountryData changes
  useEffect(() => {
    if (selectedCountryData && !shippingData.country) {
      setShippingData(prev => ({
        ...prev,
        country: selectedCountryData.name
      }));
    }
  }, [selectedCountryData, shippingData.country]);

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

  // Calculate order summary for display with country-specific currency
  const subtotal = cart.totalPrice / 100;
  const discount = referralValidation?.valid && referralValidation?.discount?.eligible 
    ? referralValidation.discount.amount / 100 
    : 0;
  const shipping = selectedShippingOption ? selectedShippingOption.price / 100 : 0;
  const total = subtotal - discount + shipping;
  
  // Get currency formatting for selected country
  const currencyCode = selectedCountryData?.currency_code || 'GBP';
  const currencySymbol = selectedCountryData?.currency_symbol || '£';

  const orderSummary = {
    subtotal,
    shipping,
    discount,
    total,
    currencyCode,
    currencySymbol,
    items: cart.items.map(item => ({
      title: item.imageTitle,
      product: `${item.product.format?.name} ${item.product.medium?.name} - ${item.product.size_name}`,
      price: item.pricing.sale_price / 100,
      quantity: item.quantity
    })),
  }


  const validateShipping = () => {
    const newErrors: Record<string, string> = {}

    // Basic field validation
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
    
    // Country validation - ensure it's a supported country
    if (!shippingData.country || !shippingData.country.trim()) {
      newErrors.country = "Country is required"
    } else if (countries && countries.length > 0) {
      // Validate against supported countries from the context (only if countries are loaded)
      const isValidCountry = countries.some(c => c.name === shippingData.country);
      if (!isValidCountry) {
        newErrors.country = "Please select a valid country from the list"
      }
    }
    
    // Postcode format validation based on country
    const postcode = shippingData.postcode.trim();
    if (postcode && shippingData.country && countries && countries.length > 0) {
      // Get country code from country name
      const selectedCountryInfo = countries.find(c => c.name === shippingData.country);
      const countryCode = selectedCountryInfo?.code;
      let postcodeValid = true;
      let postcodeFormat = "";
      
      switch (countryCode) {
        case 'GB': // UK postcode format
          postcodeValid = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i.test(postcode);
          postcodeFormat = "UK postcode format (e.g., SW1A 1AA)";
          break;
        case 'US': // US zip code format
          postcodeValid = /^[0-9]{5}(-[0-9]{4})?$/.test(postcode);
          postcodeFormat = "US zip code format (e.g., 12345 or 12345-6789)";
          break;
        case 'CA': // Canadian postal code format
          postcodeValid = /^[A-Z][0-9][A-Z]\s?[0-9][A-Z][0-9]$/i.test(postcode);
          postcodeFormat = "Canadian postal code format (e.g., K1A 0A6)";
          break;
        case 'DE': // German postcode format
        case 'FR': // French postcode format
          postcodeValid = /^[0-9]{5}$/.test(postcode);
          postcodeFormat = "5-digit postal code (e.g., 12345)";
          break;
        case 'AU': // Australian postcode format
          postcodeValid = /^[0-9]{4}$/.test(postcode);
          postcodeFormat = "4-digit postcode (e.g., 1234)";
          break;
        default:
          // For other countries, just check it's not empty (already validated above)
          postcodeValid = true;
      }
      
      if (!postcodeValid) {
        newErrors.postcode = `Please enter a valid ${postcodeFormat}`;
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Validate cart items for Gelato availability (Step 2 implementation)
  const validateCartForGelato = async () => {
    try {
      console.log('🔍 Getting authentication token for cart validation...');
      
      // Try to get fresh session, with fallback to user token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      if (!session?.access_token) {
        console.error('No access token found in session:', { 
          hasSession: !!session, 
          hasUser: !!session?.user,
          sessionKeys: session ? Object.keys(session) : 'no session'
        });
        
        // Skip cart validation if no auth - this is a non-critical step
        console.warn('⚠️ Skipping cart validation due to auth issues - proceeding with checkout');
        return {
          isValid: true,
          errors: [],
          warnings: [{
            message: 'Cart validation skipped due to authentication issues'
          }]
        };
      }

      console.log('🔍 Auth token obtained, making validation request...');

      const response = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          mode: 'full' // Full validation including Gelato API calls
        })
      });

      console.log('🔍 Validation API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Validation API error:', errorData);
        throw new Error(errorData.error || `Validation failed: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('🔍 Cart validation result:', {
        isValid: data.isValid,
        errors: data.errors?.length || 0,
        warnings: data.warnings?.length || 0
      });

      return data;
    } catch (error) {
      console.error('Error validating cart:', error);
      
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
      // Get country code from selected country name
      const selectedCountryInfo = countries?.find(c => c.name === shippingData.country);
      const countryCode = selectedCountryInfo?.code || selectedCountryData?.code || selectedCountry;
      
      const shippingAddress = {
        firstName: shippingData.firstName,
        lastName: shippingData.lastName,
        address1: shippingData.address,
        city: shippingData.city,
        postalCode: shippingData.postcode,
        country: countryCode
      };

      // Get auth token for API calls
      const token = await supabase.auth.getSession().then(({ data: { session } }) => session?.access_token);
      
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
      setErrors(prev => ({ ...prev, shipping: 'Please select a shipping option' }));
      return;
    }

    setIsProcessing(true);
    try {
      // Step 2: Validate cart items for Gelato availability before payment
      console.log('🔍 Validating cart for Gelato availability...');
      const validationResult = await validateCartForGelato();
      
      if (!validationResult.isValid) {
        console.error('❌ Cart validation failed:', validationResult.errors);
        
        // Show user-friendly error message
        const errorMessage = validationResult.errors.length > 0 
          ? `Unable to process order: ${validationResult.errors[0].error}` 
          : 'Some items in your cart cannot be printed. Please review your cart.';
        
        alert(errorMessage + '\n\nPlease remove or replace the affected items and try again.');
        return;
      }
      
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        console.warn('⚠️ Cart validation warnings:', validationResult.warnings);
        // Continue with warnings, but log them
      }
      
      console.log('✅ Cart validation passed, creating payment with shipping...');
      await createPaymentIntent();
      setCurrentStep(3); // Move to payment step
    } finally {
      setIsProcessing(false);
    }
  }

  // Create PaymentIntent when moving to payment step
  const createPaymentIntent = async () => {
    try {
      // Calculate total with selected shipping
      const totalAmount = Math.round(orderSummary.total * 100); // Convert to minor units
      const customerName = `${shippingData.firstName} ${shippingData.lastName}`.trim();
      
      // Client-side validation
      if (totalAmount <= 0) {
        throw new Error('Cart is empty - cannot create payment');
      }
      
      if (!shippingData.email || shippingData.email.trim() === '') {
        throw new Error('Customer email is required');
      }
      
      if (!customerName || customerName === '') {
        throw new Error('Customer name is required');
      }

      if (!selectedShippingOption) {
        throw new Error('Shipping option is required');
      }
      
      const paymentData = {
        amount: totalAmount, // Total including shipping in minor units
        currency: currencyCode.toLowerCase(),
        customerEmail: shippingData.email.trim(),
        customerName: customerName,
        shippingAddress: shippingData,
        shippingOption: selectedShippingOption,
        cartItems: cart.items.map(item => ({
          productId: item.productId,
          imageId: item.imageId,
          imageTitle: item.imageTitle,
          quantity: item.quantity,
          unitPrice: item.pricing.sale_price,
          // Enhanced Gelato data for order fulfillment
          gelatoProductUid: item.gelatoProductUid,
          printSpecs: item.printSpecs
        })),
        referralCode: referralCode || undefined,
      };

      // Debug logging
      console.log('Creating PaymentIntent with data:', {
        amount: paymentData.amount,
        customerEmail: paymentData.customerEmail,
        customerName: paymentData.customerName,
        cartItemsCount: paymentData.cartItems.length,
        cartTotalPrice: cart.totalPrice,
        shippingCost: selectedShippingOption?.price || 0,
        finalTotal: orderSummary.total,
        shippingData: shippingData
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
        console.error('PaymentIntent creation error:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to create payment intent');
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
    { number: 1, title: "Address", completed: currentStep > 1 },
    { number: 2, title: "Shipping", completed: currentStep > 2 },
    { number: 3, title: "Payment", completed: false },
  ]

  // Show loading state while user profile or countries are loading
  if (loading || countriesLoading) {
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
            {/* Step 1: Address Information */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Address</CardTitle>
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
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={shippingData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className={`${errors.email ? "border-red-500" : ""} ${shippingData.email && !errors.email ? "bg-blue-50" : ""}`}
                        placeholder="Enter your email address"
                      />
                      {shippingData.email && !errors.email && <p className="text-xs text-blue-600">Email address confirmed</p>}
                      {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
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

                    <div className="space-y-2">
                      <Label htmlFor="country">Country *</Label>
                      <Select
                        value={shippingData.country}
                        onValueChange={(value) => handleInputChange("country", value)}
                        disabled={!countries || countries.length === 0}
                      >
                        <SelectTrigger className={errors.country ? "border-red-500" : ""}>
                          <SelectValue placeholder={
                            !countries || countries.length === 0 
                              ? "Loading countries..." 
                              : "Select country"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {countries?.map((country) => (
                            <SelectItem key={country.code} value={country.name}>
                              {country.flag} {country.name}
                            </SelectItem>
                          )) || []}
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
                          Getting shipping options...
                        </>
                      ) : (
                        <>
                          Get Shipping Options
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                    {errors.shipping && (
                      <p className="text-sm text-red-600 mt-2">{errors.shipping}</p>
                    )}
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Shipping Options */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Choose Shipping Option</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Address Summary */}
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
                      Change address
                    </Button>
                  </div>

                  {/* Shipping Options */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900">Select shipping method:</h3>
                    
                    {shippingOptions.map((option) => (
                      <div
                        key={option.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedShippingOption?.id === option.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedShippingOption(option)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <input
                              type="radio"
                              checked={selectedShippingOption?.id === option.id}
                              onChange={() => setSelectedShippingOption(option)}
                              className="mr-3 text-purple-600"
                            />
                            <div>
                              <h4 className="font-medium text-gray-900">{option.name}</h4>
                              <p className="text-sm text-gray-600">{option.description}</p>
                              {option.carrier && (
                                <p className="text-xs text-gray-500">via {option.carrier}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              {formatPrice(option.price, currencyCode, currencySymbol)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {option.estimatedDeliveryDays} days
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {errors.shipping && (
                    <p className="text-sm text-red-600">{errors.shipping}</p>
                  )}

                  <div className="flex space-x-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep(1)}
                      className="flex-1"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Address
                    </Button>
                    <Button
                      onClick={handleShippingOptionSubmit}
                      disabled={!selectedShippingOption || isProcessing}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
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
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-900 font-medium">
                        {item.title} {item.quantity > 1 && `(×${item.quantity})`}
                      </span>
                      <span className="font-medium">{formatPrice(Math.round(item.price * item.quantity * 100), currencyCode, currencySymbol)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.product}
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(Math.round(orderSummary.subtotal * 100), currencyCode, currencySymbol)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">
                    {currentStep === 1 ? (
                      <span className="text-blue-600">To be calculated</span>
                    ) : orderSummary.shipping === 0 ? (
                      "Free"
                    ) : (
                      formatPrice(Math.round(orderSummary.shipping * 100), currencyCode, currencySymbol)
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
                        <span className="font-medium">-{formatPrice(Math.round(orderSummary.discount * 100), currencyCode, currencySymbol)}</span>
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
                  <span>{formatPrice(Math.round(orderSummary.total * 100), currencyCode, currencySymbol)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}