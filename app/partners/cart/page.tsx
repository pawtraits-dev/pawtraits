"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Minus, Plus, Trash2, ShoppingCart, ArrowLeft, Users, Percent } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useServerCart } from "@/lib/server-cart-context"
import { formatPrice } from "@/lib/product-types"
import { extractDescriptionTitle } from '@/lib/utils'

export default function PartnerCartPage() {
  const { cart, updateQuantity, removeFromCart, getShippingCost, getCartTotal } = useServerCart();

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
  const subtotal = cart.totalPrice / 100;
  const partnerDiscount = subtotal * 0.15; // 15% partner discount
  const discountedSubtotal = subtotal - partnerDiscount;
  const shipping = getShippingCost() / 100;
  const total = discountedSubtotal + shipping;

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/partners/shop" className="flex items-center text-gray-600 hover:text-green-600 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Continue Shopping
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Partner Cart</h1>
            <div className="mt-2 flex items-center text-sm text-green-700 bg-green-100 rounded-full px-4 py-2 w-fit">
              <Users className="w-4 h-4 mr-2" />
              Partner Account - 15% discount applied
            </div>
          </div>

          {/* Empty State */}
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingCart className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
              <p className="text-gray-600 mb-8">Add some beautiful pet portraits for your clients!</p>
              <Link href="/partners/shop">
                <Button className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg">
                  Browse Portraits
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/partners/shop" className="flex items-center text-gray-600 hover:text-green-600 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Continue Shopping
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Partner Cart</h1>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-gray-600">
              {cart.items.length} item{cart.items.length !== 1 ? "s" : ""} in your cart
            </p>
            <div className="flex items-center text-sm text-green-700 bg-green-100 rounded-full px-4 py-2">
              <Percent className="w-4 h-4 mr-2" />
              15% Partner Discount Applied
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => (
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
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{extractDescriptionTitle(item.imageTitle) || item.imageTitle}</h3>
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          Partner Order
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>{item.product.format?.name} {item.product.medium?.name}</p>
                        <p>{item.product.size_name} ({item.product.width_cm} x {item.product.height_cm}cm)</p>
                      </div>
                    </div>

                    {/* Price and Controls */}
                    <div className="flex flex-col items-end space-y-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500 line-through">
                          {formatPrice(item.pricing.sale_price, item.pricing.currency_code, item.pricing.currency_symbol)}
                        </p>
                        <p className="text-xl font-bold text-green-600">
                          {formatPrice(Math.round(item.pricing.sale_price * 0.85), item.pricing.currency_code, item.pricing.currency_symbol)}
                        </p>
                        <p className="text-xs text-green-600">15% discount</p>
                      </div>

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
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Partner Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">£{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center">
                    <Percent className="w-4 h-4 mr-1" />
                    Partner Discount (15%)
                  </span>
                  <span className="font-medium">-£{partnerDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discounted Subtotal</span>
                  <span className="font-medium">£{discountedSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">{shipping === 0 ? "Free" : `£${shipping.toFixed(2)}`}</span>
                </div>
                {shipping > 0 && <p className="text-sm text-gray-500">Free shipping on orders over £75</p>}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>£{total.toFixed(2)}</span>
                </div>

                <Link href="/partners/checkout" className="block">
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-semibold">
                    Proceed to Checkout
                  </Button>
                </Link>

                <div className="text-center text-sm text-gray-500 mt-4">
                  <p>🔒 Secure checkout powered by Stripe</p>
                  <p>✨ Partner pricing automatically applied</p>
                  <p>30-day money-back guarantee</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}