"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Minus, Plus, Trash2, ShoppingCart, ArrowLeft } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useHybridCart } from "@/lib/hybrid-cart-context"
import { formatPrice } from "@/lib/product-types"
import { useUserRouting } from "@/hooks/use-user-routing"
import { getSupabaseClient } from '@/lib/supabase-client'
import { extractDescriptionTitle } from '@/lib/utils'
import PublicNavigation from '@/components/PublicNavigation'
import { CountryProvider } from '@/lib/country-context'

export default function ShoppingCartPage() {
  const { items, totalItems, totalPrice, updateQuantity, removeFromCart, isGuest } = useHybridCart();
  const { continueShoppingRoute, userProfile } = useUserRouting();
  const [referralCode, setReferralCode] = useState("")
  const [referralValidation, setReferralValidation] = useState<any>(null)
  const [userEmail, setUserEmail] = useState("")
  const supabase = getSupabaseClient()

  // Load user data and referral code
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.email) return

        setUserEmail(user.email)

        // Get customer data to check for referral code
        const response = await fetch(`/api/debug/check-user-no-auth?email=${encodeURIComponent(user.email)}`)
        const result = await response.json()

        if (result.customer?.referral_code) {
          setReferralCode(result.customer.referral_code)
        } else {
          // Check localStorage as fallback
          const storedReferralCode = localStorage.getItem('referralCode')
          if (storedReferralCode) {
            setReferralCode(storedReferralCode)
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error)
      }
    }

    loadUserData()
  }, [])

  // Validate referral code when it changes and user email is available
  useEffect(() => {
    if (referralCode && userEmail && totalPrice > 0) {
      validateReferralCode()
    } else {
      setReferralValidation(null)
    }
  }, [referralCode, userEmail, totalPrice])

  const validateReferralCode = async () => {
    if (!referralCode || !userEmail) return

    try {
      const response = await fetch('/api/referrals/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCode: referralCode,
          customerEmail: userEmail,
          orderTotal: totalPrice / 100 // Convert to pounds
        })
      })

      const data = await response.json()
      setReferralValidation(data)
    } catch (error) {
      console.error('Error validating referral:', error)
      setReferralValidation(null)
    }
  }

  const handleUpdateQuantity = async (id: string, newQuantity: number) => {
    try {
      if (newQuantity === 0) {
        await removeFromCart(id);
        return;
      }
      await updateQuantity(id, newQuantity);
    } catch (error) {
      console.error('Error updating cart:', error);
    }
  };

  // Convert pricing from minor units (pence) to major units (pounds) for display
  const subtotal = totalPrice / 100;
  const discount = referralValidation?.valid && referralValidation?.discount?.eligible
    ? referralValidation.discount.amount / 100
    : 0;
  // Cart total is subtotal minus discount (shipping calculated at checkout)
  const total = subtotal - discount;

  if (items.length === 0) {
    return (
      <>
        <PublicNavigation />
        <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link href={continueShoppingRoute} className="flex items-center text-gray-600 hover:text-purple-600 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Continue Shopping
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          </div>

          {/* Empty State */}
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingCart className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
              <p className="text-gray-600 mb-8">Add some beautiful pet portraits to get started!</p>
              <Link href={continueShoppingRoute}>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg">
                  Browse Portraits
                </Button>
              </Link>
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href={continueShoppingRoute} className="flex items-center text-gray-600 hover:text-purple-600 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Continue Shopping
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          <p className="text-gray-600 mt-2">
            {items.length} item{items.length !== 1 ? "s" : ""} in your cart
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      <Image
                        src={item.imageUrl || "/placeholder.svg"}
                        alt={item.imageTitle}
                        width={120}
                        height={120}
                        className="rounded-lg object-cover"
                      />
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{extractDescriptionTitle(item.imageTitle) || item.imageTitle}</h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>{item.product.format?.name} {item.product.medium?.name}</p>
                        <p>{item.product.size_name} ({item.product.width_cm} x {item.product.height_cm}cm)</p>
                      </div>
                    </div>

                    {/* Price and Controls */}
                    <div className="flex flex-col items-end space-y-4">
                      <p className="text-xl font-bold text-gray-900">
                        {formatPrice(item.pricing.sale_price, item.pricing.currency_code, item.pricing.currency_symbol)}
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 p-0"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 p-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="shadow-sm sticky top-8">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">£{subtotal.toFixed(2)}</span>
                </div>
                
                {/* Referral Discount Section */}
                {referralCode && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-purple-600">
                      <span>Referral Code Applied</span>
                      <span className="font-medium">{referralCode}</span>
                    </div>
                    {referralValidation?.valid && referralValidation?.discount?.eligible && (
                      <div className="flex justify-between text-green-600">
                        <span>Referral Discount (20%)</span>
                        <span className="font-medium">-£{discount.toFixed(2)}</span>
                      </div>
                    )}
                    {referralValidation?.valid && !referralValidation?.discount?.eligible && (
                      <div className="text-xs text-gray-500">
                        {referralValidation.discount.description}
                      </div>
                    )}
                  </div>
                )}
                
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>£{total.toFixed(2)}</span>
                </div>

                <div className="text-sm text-gray-500 text-center">
                  <p>Shipping costs calculated at checkout</p>
                </div>

                <Link href={userProfile?.user_type === 'partner' ? '/partners/checkout' : userProfile?.user_type === 'customer' ? '/customer/checkout' : '/shop/checkout'} className="block">
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 text-lg font-semibold">
                    Proceed to Checkout
                  </Button>
                </Link>

                <div className="text-center text-sm text-gray-500 mt-4">
                  <p>🔒 Secure checkout powered by Stripe</p>
                  <p>30-day money-back guarantee</p>
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
