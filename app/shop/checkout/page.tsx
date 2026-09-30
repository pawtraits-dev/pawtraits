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
import Image from "next/image"
import { useHybridCart } from "@/lib/hybrid-cart-context"
import { useRouter } from "next/navigation"
import { useUserRouting } from "@/hooks/use-user-routing"
import UserAwareNavigation from '@/components/UserAwareNavigation'
import { CountryProvider, useCountryPricing } from '@/lib/country-context'
import { Elements } from '@stripe/react-stripe-js'
import { track } from '@/lib/tracking/events'
import { describeCartItem, itemNeedsShipping, isStallProductId, includesFreeDigital } from '@/lib/cart/items'
import { getStripe } from '@/lib/stripe-client'
import StripePaymentForm from '@/components/StripePaymentForm'
import ExpressCheckout, { type ExpressPayer, type ShippingQuote } from '@/components/checkout/ExpressCheckout'
import { checkoutValidation } from '@/lib/checkout-validation'
import { extractDescriptionTitle } from '@/lib/utils'
// Countries we deliver to (card form dropdown and Apple Pay / Google Pay address sheet)
import { DELIVERY_COUNTRIES } from '@/lib/shipping/rates'

const countryName = (code: string) => {
  try { return new Intl.DisplayNames(['en-GB'], { type: 'region' }).of(code) || code } catch { return code }
}


function CheckoutPageContent() {
  const [currentStep, setCurrentStep] = useState(1)
  // Guest checkout (no account needed — one is created after payment)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [beganCheckoutTracked, setBeganCheckoutTracked] = useState(false)
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
  const [availableRewards, setAvailableRewards] = useState(0) // in pence
  const [applyRewards, setApplyRewards] = useState(false)
  const [loadingRewards, setLoadingRewards] = useState(false)
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null)
  // Add ?debugwallet to the checkout URL to see why Apple Pay / Google Pay isn't showing (phones have no console)
  const [walletInfo, setWalletInfo] = useState<string | null>(null)
  const [debugWallet, setDebugWallet] = useState(false)
  const [blocked, setBlocked] = useState<string[]>([])
  useEffect(() => {
    let on = false
    try { on = new URLSearchParams(window.location.search).has('debugwallet') } catch {}
    setDebugWallet(on)
    if (!on) return
    // Show anything the security policy blocks (e.g. a Stripe frame)
    const onViolation = (e: SecurityPolicyViolationEvent) =>
      setBlocked(b => [...b, `${e.effectiveDirective}: ${e.blockedURI || '(inline)'}`].slice(-8))
    document.addEventListener('securitypolicyviolation', onViolation)
    const t = setTimeout(() => setWalletInfo(w => w ?? 'No reply from Stripe after 10s — its frame was probably blocked (security policy or a content blocker)'), 10000)
    return () => { document.removeEventListener('securitypolicyviolation', onViolation); clearTimeout(t) }
  }, [])
  // When Apple Pay / Google Pay is available it's the main path; the card form opens on request
  const [cardFormOpen, setCardFormOpen] = useState(false)
  const { items, totalItems, totalPrice, clearCart } = useHybridCart()
  const router = useRouter()
  const { userProfile, loading: userLoading } = useUserRouting()
  const isGuest = !userLoading && !userProfile
  // Nothing to post (downloads and/or prints taken home from the stall): no address or shipping step
  const isDigitalOnly = items.length > 0 && !items.some((item: any) => itemNeedsShipping(item))
  const hasTakeHomeItems = items.some((item: any) => isStallProductId(item.productId))

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

  // Fetch customer's available reward balance
  useEffect(() => {
    const fetchRewardBalance = async () => {
      if (!shippingData.email || userProfile?.user_type !== 'customer') {
        console.log('[CHECKOUT] Skipping reward balance fetch:', {
          hasEmail: !!shippingData.email,
          userType: userProfile?.user_type
        });
        return
      }

      setLoadingRewards(true)
      try {
        const response = await fetch(`/api/customers/balance?email=${encodeURIComponent(shippingData.email)}`)
        if (response.ok) {
          const data = await response.json()
          console.log('[CHECKOUT] Reward balance fetched:', {
            email: shippingData.email,
            balancePence: data.available_balance,
            balancePounds: (data.available_balance || 0) / 100
          });
          setAvailableRewards(data.available_balance || 0) // in pence
        } else {
          console.error('[CHECKOUT] Failed to fetch reward balance:', response.status);
        }
      } catch (error) {
        console.error('[CHECKOUT] Error fetching reward balance:', error)
      } finally {
        setLoadingRewards(false)
      }
    }

    fetchRewardBalance()
  }, [shippingData.email, userProfile?.user_type])

  // Update country when selectedCountry changes
  useEffect(() => {
    if (selectedCountry) {
      setShippingData(prev => ({
        ...prev,
        country: selectedCountry,
      }))
    }
  }, [selectedCountry])

  // Check for referral code in URL, localStorage, or database (for referred customers)
  useEffect(() => {
    const fetchReferralCode = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const urlReferralCode = urlParams.get('ref') || urlParams.get('referral')
      const storedReferralCode = localStorage.getItem('referralCode')

      console.log('[CHECKOUT] Checking for referral code:', {
        urlReferralCode,
        storedReferralCode,
        windowLocation: window.location.href,
        hasUserProfile: !!userProfile
      });

      if (urlReferralCode) {
        console.log('[CHECKOUT] Setting referral code from URL:', urlReferralCode.toUpperCase());
        setReferralCode(urlReferralCode.toUpperCase())
        localStorage.setItem('referralCode', urlReferralCode.toUpperCase())
      } else if (storedReferralCode) {
        console.log('[CHECKOUT] Setting referral code from localStorage:', storedReferralCode);
        setReferralCode(storedReferralCode)
      } else if (userProfile?.email && userProfile.user_type === 'customer') {
        // Fallback: Check if customer has a referral_code_used stored in database
        console.log('[CHECKOUT] No code in URL/localStorage, checking customer record...');
        try {
          const response = await fetch(`/api/customers/referral-code?email=${encodeURIComponent(userProfile.email)}`);
          if (response.ok) {
            const data = await response.json();
            // Use referral_code_used for checkout (the code THEY used to sign up, for discount eligibility)
            if (data.referral_code_used) {
              console.log('[CHECKOUT] Found referral code in database:', data.referral_code_used);
              setReferralCode(data.referral_code_used);
              // Optionally store in localStorage for future sessions
              localStorage.setItem('referralCode', data.referral_code_used);
            } else {
              console.log('[CHECKOUT] No referral code found in customer record');
            }
          }
        } catch (error) {
          console.error('[CHECKOUT] Error fetching customer referral code:', error);
        }
      } else {
        console.log('[CHECKOUT] No referral code found in URL or localStorage');
      }
    };

    fetchReferralCode();
  }, [userProfile])

  // Validate referral code when it changes and user email is available
  useEffect(() => {
    console.log('[CHECKOUT] Referral validation trigger check:', {
      hasReferralCode: !!referralCode,
      referralCode: referralCode,
      hasEmail: !!shippingData.email,
      email: shippingData.email,
      totalPrice: totalPrice,
      willValidate: !!(referralCode && shippingData.email && totalPrice > 0)
    });

    if (referralCode && shippingData.email && totalPrice > 0) {
      console.log('[CHECKOUT] Triggering referral validation...');
      validateReferralCode()
    } else {
      console.log('[CHECKOUT] Not validating referral - missing requirements');
      setReferralValidation(null)
    }
  }, [referralCode, shippingData.email, totalPrice])

  const validateReferralCode = async () => {
    if (!referralCode || !shippingData.email) return

    setValidatingReferral(true)
    try {
      const subtotalInPounds = totalPrice / 100; // Convert subtotal from pence to pounds
      const response = await fetch('/api/referrals/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCode: referralCode,
          customerEmail: shippingData.email,
          orderTotal: subtotalInPounds // Send subtotal (before shipping) in pounds
        })
      })

      const data = await response.json()
      console.log('[CHECKOUT] Referral validation response:', {
        valid: data.valid,
        discountEligible: data.discount?.eligible,
        discountAmount: data.discount?.amount,
        error: data.error,
        referralType: data.referral?.type
      });
      setReferralValidation(data)

      if (!data.valid) {
        // Don't show error for invalid referral codes, just clear the validation
        setReferralValidation(data)
        setErrors(prev => ({ ...prev, referral: '' }))

        // If the error is about using own code, clear the referral code and localStorage
        if (data.error === 'You cannot use your own referral code') {
          setReferralCode('')
          localStorage.removeItem('referralCode')
        }
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

  // Calculate discounts based on simplified commission rules
  let discount = 0;
  let discountType = '';

  if (userProfile?.user_type === 'partner') {
    // Partner orders get 20% discount, no commission
    discount = subtotal * 0.20;
    discountType = 'Partner discount (20%)';
  } else if (referralValidation?.valid && referralValidation?.discount?.eligible) {
    // Customer using referral code gets 10% discount (first order only)
    discount = referralValidation.discount.amount / 100;
    discountType = 'First Order Discount (10%)';
    console.log('✅ Referral discount applied:', { discount, discountType, referralCode });
  } else if (referralCode && referralValidation?.valid && !referralValidation?.discount?.eligible) {
    console.log('⚠️ Referral code valid but discount not eligible:', {
      referralCode,
      reason: referralValidation?.discount?.description
    });
  }

  // Calculate reward redemption (only for customers, not partners)
  let rewardRedemption = 0;
  if (applyRewards && availableRewards > 0 && userProfile?.user_type === 'customer') {
    const maxRedeemable = Math.min(availableRewards, totalPrice); // Can't redeem more than order total
    rewardRedemption = maxRedeemable / 100; // Convert pence to pounds
    console.log('✅ Reward redemption applied:', {
      rewardRedemption,
      availableRewards: availableRewards / 100,
      maxRedeemable: maxRedeemable / 100
    });
  } else if (availableRewards > 0) {
    console.log('⚠️ Rewards available but not applied:', {
      applyRewards,
      availableRewards: availableRewards / 100,
      userType: userProfile?.user_type
    });
  }

  const total = subtotal - discount - rewardRedemption + shipping;

  console.log('💰 Order total calculation:', {
    subtotal,
    discount,
    rewardRedemption,
    shipping,
    total,
    totalPrice,
    availableRewards: availableRewards / 100
  });

  const orderSummary = {
    subtotal: subtotal,
    shipping: shipping,
    discount: discount,
    rewardRedemption: rewardRedemption,
    total: total,
    items: items.map(item => ({
      title: item.imageTitle,
      price: item.pricing.sale_price / 100, // Convert from pence to pounds
      quantity: item.quantity
    })),
  }

  const validateShipping = () => {
    if (isDigitalOnly) {
      const newErrors: Record<string, string> = {}
      if (!shippingData.firstName?.trim()) newErrors.firstName = 'First name is required'
      if (!shippingData.lastName?.trim()) newErrors.lastName = 'Last name is required'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(shippingData.email?.trim() || '')) newErrors.email = 'Please enter a valid email address'
      setErrors(newErrors)
      return Object.keys(newErrors).length === 0
    }
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
          // Only items we post: take-home prints and downloads don't affect shipping
          cartItems: items.filter((item: any) => itemNeedsShipping(item)).map(item => ({
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

      if (options.length === 1) {
        // Only one way to deliver: nothing to choose, go straight to payment
        if (await createPaymentIntent(options[0])) setCurrentStep(3);
        return;
      }

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

  const startCheckoutTracking = () => {
    if (beganCheckoutTracked) return
    track.beginCheckout(items.map((item: any) => ({ id: item.imageId, name: item.imageTitle, variant: item.product?.size_code || item.product?.product_type, price: item.pricing.sale_price / 100, quantity: item.quantity })))
    setBeganCheckoutTracked(true)
  }

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    startCheckoutTracking()
    if (isDigitalOnly) {
      if (!validateShipping()) return
      setSelectedShippingOption(null)
      setIsProcessing(true)
      try {
        if (await createPaymentIntent(null)) setCurrentStep(3)
      } finally {
        setIsProcessing(false)
      }
      return
    }
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
      if (await createPaymentIntent()) setCurrentStep(3)
    } finally {
      setIsProcessing(false)
    }
  }

  // Delivery options for a country (flat Royal Mail Tracked charge by destination — lib/shipping/rates.ts)
  const getShippingQuotes = async (country: string): Promise<ShippingQuote[]> => {
    const response = await fetch('/api/shipping/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        shippingAddress: { country },
        cartItems: items.filter((item: any) => itemNeedsShipping(item)).map(item => ({
          gelatoProductUid: item.gelatoProductUid,
          quantity: item.quantity,
          printSpecs: item.printSpecs
        }))
      })
    })
    if (!response.ok) throw new Error('Delivery is not available to this country')
    const { shippingOptions: options } = await response.json()
    return options || []
  }

  // Goods total after discounts/rewards, before delivery (pence)
  const goodsTotalPence = Math.round((subtotal - discount - rewardRedemption) * 100)
  // Express is always offered. A guest's referral discount needs their email checking first, so until
  // it's confirmed the wallet charges full price and we point them to the form to claim the discount.
  const showExpress = items.length > 0 && goodsTotalPence >= 50
  const referralDiscountPending = isGuest && !!referralCode && !(referralValidation as any)?.discount?.eligible
  const expressFirst = currentStep === 1 && showExpress && walletAvailable === true && !cardFormOpen

  // Shared by the card form and Apple Pay / Google Pay / Link
  const requestPaymentIntent = async (payer: ExpressPayer & { digitalOnly: boolean }) => {
    const option = payer.digitalOnly ? null : (payer.shippingOption || null)
    const totalAmount = goodsTotalPence + (option?.price || 0)
    const customerName = `${payer.firstName} ${payer.lastName}`.trim()

    if (totalAmount <= 0) throw new Error('Cart is empty - cannot create payment')
    if (!payer.email?.trim()) throw new Error('Email is required')
    if (!customerName) throw new Error('Name is required')

    const paymentData = {
      amount: totalAmount, // pence, including delivery
      currency: 'gbp',
      customerEmail: payer.email.trim(),
      customerName,
      customerPhone: payer.phone || undefined,
      userType: userProfile?.user_type || 'customer',
      shippingAddress: {
        firstName: payer.firstName,
        lastName: payer.lastName,
        email: payer.email.trim(),
        address: payer.address?.addressLine1 || '',
        addressLine1: payer.address?.addressLine1 || '',
        addressLine2: payer.address?.addressLine2 || '',
        city: payer.address?.city || '',
        postcode: payer.address?.postcode || '',
        country: payer.address?.country || shippingData.country,
      },
      marketingOptIn: isGuest ? marketingOptIn : undefined,
      digitalOnly: payer.digitalOnly || undefined,
      shippingOption: option,
      cartItems: items.map(item => ({
        productId: item.productId,
        imageId: item.imageId,
        imageTitle: item.imageTitle,
        quantity: item.quantity,
        unitPrice: item.pricing.sale_price, // in pence
        totalPrice: item.pricing.sale_price * item.quantity, // in pence
        gelatoProductUid: item.gelatoProductUid,
        printSpecs: item.printSpecs
      })),
      referralCode: referralCode || undefined,
      discountAmount: discount > 0 ? Math.round(discount * 100) : undefined,
      discountType: discountType || undefined,
      referralDiscount: referralValidation?.valid && referralValidation?.discount?.eligible
        ? Math.round(discount * 100)
        : undefined,
      referralType: referralValidation?.referral?.type || undefined,
      rewardRedemption: applyRewards && rewardRedemption > 0
        ? Math.round(rewardRedemption * 100)
        : undefined
    };

    const response = await fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(paymentData),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('PaymentIntent creation error:', errorData);
      throw new Error(errorData.error || errorData.details || 'Failed to create payment intent');
    }
    return response.json() as Promise<{ clientSecret: string; paymentIntentId: string }>
  }

  // Card path: create the PaymentIntent when moving to the payment step
  const createPaymentIntent = async (optionOverride?: any) => {
    try {
      const data = await requestPaymentIntent({
        email: shippingData.email,
        firstName: shippingData.firstName,
        lastName: shippingData.lastName,
        address: {
          addressLine1: shippingData.addressLine1 || shippingData.address,
          addressLine2: shippingData.addressLine2,
          city: shippingData.city,
          postcode: shippingData.postcode,
          country: shippingData.country,
        },
        shippingOption: optionOverride !== undefined ? optionOverride : selectedShippingOption,
        digitalOnly: isDigitalOnly,
      })
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      return true
    } catch (error) {
      console.error('Error creating Customer PaymentIntent:', error);
      alert(error instanceof Error && error.message ? error.message : 'Failed to set up payment. Please try again.');
      setCurrentStep(1); // Go back to shipping step
      return false
    }
  };

  // Handle successful payment completion
  const handlePaymentSuccess = async (paymentIntent: any) => {
    // Bought take-home prints at the stall? Show the big PAID screen for the stallholder
    const destination = hasTakeHomeItems
      ? `/stall/paid?payment_intent=${paymentIntent.id}`
      : `/shop/order-confirmation?payment_intent=${paymentIntent.id}`
    try {
      console.log('Customer payment succeeded:', paymentIntent.id);

      // Clear cart
      await clearCart();

      router.push(destination);

    } catch (error) {
      console.error('Error handling customer payment success:', error);
      // Still redirect to confirmation since payment succeeded
      router.push(destination);
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

  // Nothing to post → just "Your details" then "Payment"
  const steps = isDigitalOnly
    ? [
        { number: 1, title: "Your details", completed: currentStep > 1 },
        { number: 3, title: "Payment", completed: false },
      ]
    : [
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


  return (
    <>
      <UserAwareNavigation />
      <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {isGuest && (
          <div className="mb-4 rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-900">
            Checking out as a guest — no account needed. <Link href={`/auth/login?returnTo=${encodeURIComponent('/shop/checkout')}`} className="font-medium underline">Already have one? Sign in</Link>
          </div>
        )}
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <Link href="/shop/cart" className="flex items-center text-gray-600 hover:text-purple-600 mb-2 sm:mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cart
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Checkout</h1>
          {/* Compact progress on phones — the full stepper doesn't fit */}
          <p className={`sm:hidden mt-1 text-sm text-gray-600 ${expressFirst ? 'hidden' : ''}`}>
            Step {steps.findIndex(st => st.number === currentStep) + 1} of {steps.length} · {steps.find(st => st.number === currentStep)?.title}
          </p>
        </div>

        {/* Progress Steps (not needed while Apple Pay / Google Pay is the path) */}
        <div className={`mb-8 hidden ${expressFirst ? '' : 'sm:block'}`}>
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
                  {step.completed ? "✓" : index + 1}
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
            {debugWallet && (
              <pre className="mb-4 whitespace-pre-wrap rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
{`Express checkout debug
step: ${currentStep}  items: ${items.length}  goods: ${goodsTotalPence}p
guest: ${isGuest}  referral code: ${referralCode || 'none'}${referralDiscountPending ? '  → express at full price; discount via the form' : ''}
shown: ${showExpress}  wallet available: ${String(walletAvailable)}
${walletInfo || 'Stripe has not reported yet'}
blocked: ${blocked.length ? blocked.join(' | ') : 'nothing'}
basket: ${items.map((i: any) => `${i.product?.sku || i.productId?.slice(0, 8)} type=${i.product?.product_type ?? '?'} ship=${itemNeedsShipping(i)}`).join(' | ')}  digital only: ${isDigitalOnly}
page: ${typeof window !== 'undefined' ? window.location.host : ''}`}
              </pre>
            )}
            {/* Express: Apple Pay / Google Pay / Link — collects email, name, address and delivery in the wallet sheet */}
            {currentStep === 1 && showExpress && (
              <div className={walletAvailable ? 'mb-6' : 'invisible h-0 overflow-hidden'} aria-hidden={!walletAvailable}>
                <Card className="border-purple-200">
                  <CardContent className="pt-6 space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Express checkout</h2>
                      <p className="text-sm text-gray-600">
                        {isDigitalOnly ? 'Pay in one tap — your receipt and download link go to the email in your wallet.' : 'Pay in one tap — your address and delivery are picked in your wallet.'}
                      </p>
                    </div>
                    <ExpressCheckout
                      // Wallet options (address, delivery) are fixed when it mounts, so remount if the basket changes between posted and digital-only
                      key={isDigitalOnly ? 'digital' : 'posted'}
                      goodsTotalPence={goodsTotalPence}
                      needsShipping={!isDigitalOnly}
                      allowedCountries={DELIVERY_COUNTRIES}
                      defaultCountry={DELIVERY_COUNTRIES.includes(shippingData.country) ? shippingData.country : 'GB'}
                      getShippingQuotes={getShippingQuotes}
                      createIntent={(payer) => requestPaymentIntent({ ...payer, email: userProfile?.email || payer.email, digitalOnly: isDigitalOnly })}
                      onStart={startCheckoutTracking}
                      onSuccess={handlePaymentSuccess}
                      onAvailability={(ok, info) => { setWalletAvailable(ok); setWalletInfo(info || null) }}
                    />
                    {referralDiscountPending && (
                      <p className="text-xs text-gray-600">
                        Have a referral discount?{' '}
                        {expressFirst
                          ? <button type="button" onClick={() => setCardFormOpen(true)} className="font-medium text-purple-700 underline">Enter your email to apply it</button>
                          : 'Enter your email in the form below to apply it before paying.'}
                      </p>
                    )}
                    {isGuest && (
                      <label className="flex items-start gap-3 pt-1 text-sm text-gray-700">
                        <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-0.5 h-5 w-5 accent-purple-600" />
                        <span>Send me the occasional new design and offer (unsubscribe any time)</span>
                      </label>
                    )}
                  </CardContent>
                </Card>
                {expressFirst ? (
                  <button type="button" onClick={() => setCardFormOpen(true)}
                    className="mt-4 w-full rounded-xl border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 hover:border-purple-400">
                    Pay by card instead
                  </button>
                ) : (
                  <div className="flex items-center gap-3 my-6 text-sm text-gray-500">
                    <div className="h-px flex-1 bg-gray-200" />
                    or pay by card
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Shipping Information */}
            {currentStep === 1 && !expressFirst && (
              <Card>
                <CardHeader>
                  <CardTitle>{isDigitalOnly ? 'Your details' : 'Delivery address'}</CardTitle>
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
                          autoComplete="given-name"
                          value={shippingData.firstName}
                          onChange={(e) => handleInputChange("firstName", e.target.value)}
                          className={errors.firstName ? "border-red-500" : ""}
                          placeholder="Jane"
                        />
                        {errors.firstName && <p className="text-sm text-red-600">{errors.firstName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          autoComplete="family-name"
                          value={shippingData.lastName}
                          onChange={(e) => handleInputChange("lastName", e.target.value)}
                          className={errors.lastName ? "border-red-500" : ""}
                          placeholder="Smith"
                        />
                        {errors.lastName && <p className="text-sm text-red-600">{errors.lastName}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address{isGuest ? ' *' : ''}</Label>
                      {isGuest ? (
                        <>
                          <Input
                            id="email"
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            value={shippingData.email}
                            onChange={(e) => handleInputChange("email", e.target.value)}
                            className={`h-12 text-base ${errors.email ? "border-red-500" : ""}`}
                            placeholder="you@example.com"
                          />
                          {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
                          <p className="text-xs text-gray-500">For your receipt{hasTakeHomeItems ? '' : isDigitalOnly ? ' and download link' : ' and delivery updates'}. We’ll set up a free account with it so you can find your order later — no password needed.</p>
                          <label className="flex items-start gap-3 pt-1 text-sm text-gray-700">
                            <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-0.5 h-5 w-5 accent-purple-600" />
                            <span>Send me the occasional new design and offer (unsubscribe any time)</span>
                          </label>
                        </>
                      ) : (
                        <>
                          <Input
                            id="email"
                            type="email"
                            value={shippingData.email}
                            readOnly
                            className="bg-gray-50 text-gray-700 cursor-not-allowed"
                            placeholder="Loading from your account..."
                          />
                          <p className="text-xs text-gray-500">Using email from your account</p>
                        </>
                      )}
                    </div>

                    {!isDigitalOnly && (<>

                    <div className="space-y-2">
                      <Label htmlFor="addressLine1">Address Line 1 *</Label>
                      <Input
                        id="addressLine1"
                        autoComplete="address-line1"
                        value={shippingData.addressLine1}
                        onChange={(e) => {
                          handleInputChange("addressLine1", e.target.value);
                          // Update the old address field for backward compatibility
                          handleInputChange("address", e.target.value);
                        }}
                        className={errors.addressLine1 ? "border-red-500" : ""}
                        placeholder="12 Mill Lane"
                      />
                      {errors.addressLine1 && <p className="text-sm text-red-600">{errors.addressLine1}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
                      <Input
                        id="addressLine2"
                        autoComplete="address-line2"
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
                          autoComplete="address-level2"
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
                          autoComplete="postal-code"
                          value={shippingData.postcode}
                          onChange={(e) => handleInputChange("postcode", e.target.value)}
                          className={errors.postcode ? "border-red-500" : ""}
                          placeholder="NW6 1AA"
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
                          {DELIVERY_COUNTRIES.map(code => (
                            <SelectItem key={code} value={code}>{countryName(code)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.country && <p className="text-sm text-red-600">{errors.country}</p>}
                    </div>
                    </>)}

                    <Button
                      type="submit"
                      className="w-full h-14 text-lg bg-purple-600 hover:bg-purple-700 text-white"
                      disabled={loadingShipping || isProcessing}
                    >
                      {loadingShipping ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Finding shipping options...
                        </>
                      ) : (
                        <>
                          {isDigitalOnly ? 'Continue to Payment' : 'Continue to Shipping Options'}
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
                {items.map((item) => (
                  <div key={item.id} className="flex items-start space-x-3">
                    {/* Item thumbnail */}
                    <div className="flex-shrink-0">
                      <Image
                        src={item.imageUrl || "/placeholder.svg"}
                        alt={item.imageTitle}
                        width={60}
                        height={60}
                        className="rounded-lg object-cover"
                      />
                    </div>

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {extractDescriptionTitle(item.imageTitle) || item.imageTitle}
                      </h4>
                      <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                        <p>{describeCartItem(item as any)}</p>
                        {includesFreeDigital(item as any) && <p className="text-green-700 font-medium">🎁 + free digital copy</p>}
                      </div>
                    </div>

                    {/* Price and quantity */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-medium text-gray-900">
                        £{(item.pricing.sale_price / 100).toFixed(2)}
                      </div>
                      {item.quantity > 1 && (
                        <div className="text-xs text-gray-600">Qty: {item.quantity}</div>
                      )}
                    </div>
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
                {/* Show partner discount */}
                {userProfile?.user_type === 'partner' && discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{discountType}</span>
                    <span className="font-medium">-£{discount.toFixed(2)}</span>
                  </div>
                )}

                {/* Show referral code section only for customer users with valid AND eligible discounts */}
                {userProfile?.user_type === 'customer' && referralCode && referralValidation?.valid && referralValidation?.discount?.eligible && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-purple-600">
                      <span>Referral Code Applied</span>
                      <span className="font-medium">{referralCode}</span>
                    </div>
                    {validatingReferral && (
                      <div className="text-xs text-gray-500">Validating referral code...</div>
                    )}
                    <div className="flex justify-between text-green-600">
                      <span>{discountType}</span>
                      <span className="font-medium">-£{discount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Show reward redemption option for customers with available balance */}
                {userProfile?.user_type === 'customer' && availableRewards > 0 && (
                  <div className="space-y-2 bg-purple-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <label htmlFor="apply-rewards" className="flex items-center cursor-pointer text-sm">
                        <input
                          id="apply-rewards"
                          type="checkbox"
                          checked={applyRewards}
                          onChange={(e) => setApplyRewards(e.target.checked)}
                          className="mr-2 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <span className="font-medium text-purple-900">
                          Use Reward Balance
                        </span>
                      </label>
                      <span className="text-sm text-purple-700 font-medium">
                        £{(availableRewards / 100).toFixed(2)} available
                      </span>
                    </div>
                    {applyRewards && rewardRedemption > 0 && (
                      <div className="flex justify-between text-green-600 text-sm pt-1">
                        <span>Rewards Applied</span>
                        <span className="font-medium">-£{rewardRedemption.toFixed(2)}</span>
                      </div>
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

                {/* Navigation buttons for step 2 */}
                {currentStep === 2 && (
                  <>
                    <Separator />
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentStep(1)}
                        className="flex-1"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
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
                            Continue
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </>
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
