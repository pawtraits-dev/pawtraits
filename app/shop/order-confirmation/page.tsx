"use client"

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, Package, Mail, ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { useUserRouting } from "@/hooks/use-user-routing"
import UserInteractionsService from '@/lib/user-interactions'
import Image from "next/image"
import { extractDescriptionTitle } from '@/lib/utils'
import UserAwareNavigation from '@/components/UserAwareNavigation'
import { CountryProvider } from '@/lib/country-context'
import { track } from '@/lib/tracking/events'

interface OrderItem {
  id: string
  product_id: string
  image_id: string
  image_url: string
  image_title: string
  quantity: number
  unit_price: number
  total_price: number
}

interface Order {
  id: string
  order_number: string
  status: string
  customer_email: string
  shipping_first_name: string
  shipping_last_name: string
  shipping_address: string
  shipping_city: string
  shipping_postcode: string
  shipping_country: string
  subtotal_amount: number
  shipping_amount: number
  total_amount: number
  currency: string
  estimated_delivery: string
  created_at: string
  order_items: OrderItem[]
}

function OrderConfirmationContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  const orderNumber = searchParams.get('orderNumber')
  const paymentIntent = searchParams.get('payment_intent')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Paid, but the order is still being created (the Stripe webhook can take a few seconds)
  const [payment, setPayment] = useState<{ status: string; amount: number; posted: boolean } | null>(null)
  const [waitingForOrder, setWaitingForOrder] = useState(false)
  const { continueShoppingRoute } = useUserRouting()

  useEffect(() => {
    if (orderId || orderNumber || paymentIntent) {
      fetchOrderDetails()
    } else {
      setError('Order information not found')
      setLoading(false)
    }
  }, [orderId, orderNumber, paymentIntent])

  const fetchOrderDetails = async (attempt = 0): Promise<void> => {
    let retrying = false
    try {
      let apiUrl = '/api/shop/orders?'

      if (paymentIntent) {
        apiUrl += `paymentIntent=${paymentIntent}`
      } else if (orderNumber) {
        apiUrl += `orderNumber=${orderNumber}`
      } else if (orderId) {
        apiUrl += `orderId=${orderId}`
      }

      const response = await fetch(apiUrl)
      if (!response.ok) {
        // Straight after payment the order can take a few seconds to be created by the webhook.
        // Never show "not found" to someone who has paid: show "Payment received" and keep checking.
        if (response.status === 404 && paymentIntent) {
          if (attempt === 0) {
            fetch(`/api/payments/status?payment_intent=${encodeURIComponent(paymentIntent)}`)
              .then(r => (r.ok ? r.json() : null)).then(p => { if (p?.status) setPayment(p) }).catch(() => {})
          }
          setWaitingForOrder(true)
          setLoading(false)
          if (attempt < 60) {
            retrying = true
            setTimeout(() => fetchOrderDetails(attempt + 1), attempt < 10 ? 1500 : 4000)
          }
          return
        }
        if (response.status === 404) {
          setError('Order not found')
        } else {
          throw new Error('Failed to fetch order details')
        }
        return
      }
      const order = await response.json()
      setWaitingForOrder(false)
      setOrder(order)

      // Ads/analytics purchase (once per payment; eventID matches the server-side Meta event)
      try {
        const pi = order?.payment_intent_id
        if (pi && !sessionStorage.getItem(`pt_tracked_${pi}`)) {
          sessionStorage.setItem(`pt_tracked_${pi}`, '1')
          track.purchase(order.order_number, pi, (order.total_amount || 0) / 100,
            (order.order_items || []).map((i: any) => ({ id: i.image_id, name: i.image_title, price: (i.unit_price || 0) / 100, quantity: i.quantity })))
        }
      } catch { /* storage unavailable */ }
      
      // Record purchases in user interactions
      if (order && order.order_items) {
        order.order_items.forEach((item: OrderItem) => {
          UserInteractionsService.recordPurchase(item.image_id, order.order_number, {
            id: item.image_id,
            filename: `${item.image_id}.jpg`,
            public_url: item.image_url,
            prompt_text: item.image_title,
            description: `Purchased portrait: ${item.image_title}`,
            tags: [],
            is_featured: false,
            created_at: order.created_at
          });
        });
      }
    } catch (err) {
      console.error('Error fetching order:', err)
      setError('Failed to load order details')
    } finally {
      if (!retrying) setLoading(false)
    }
  }

  const formatPrice = (priceInPence: number) => {
    return `£${(priceInPence / 100).toFixed(2)}`
  }

  const formatDeliveryDate = (isoDate: string) => {
    const date = new Date(isoDate)
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <CountryProvider>
        <UserAwareNavigation />
        <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
            <p className="text-gray-600">Loading order details...</p>
          </div>
        </div>
      </CountryProvider>
    )
  }

  if (!order && waitingForOrder && !error) {
    const failed = payment && ['requires_payment_method', 'canceled'].includes(payment.status)
    return (
      <CountryProvider>
        <UserAwareNavigation />
        <div className="min-h-screen bg-gray-50 px-4 py-12">
          <div className="mx-auto max-w-md text-center">
            <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${failed ? 'bg-amber-100' : 'bg-green-100'}`}>
              {failed ? <Package className="h-10 w-10 text-amber-700" /> : <CheckCircle className="h-12 w-12 text-green-600" />}
            </div>
            {failed ? (
              <>
                <h1 className="text-2xl font-bold text-gray-900">Your payment didn&apos;t go through</h1>
                <p className="mt-2 text-gray-600">You haven&apos;t been charged. Your basket is still saved, so you can try again.</p>
                <Link href="/shop/cart" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-purple-600 px-6 font-semibold text-white">Back to basket</Link>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900">Payment received, thank you!</h1>
                <p className="mt-2 text-gray-600">
                  {payment ? `We've received your payment of £${(payment.amount / 100).toFixed(2)}. ` : ''}
                  We&apos;re setting up your order now and your receipt is on its way to your inbox.
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Order details will appear here in a moment
                </div>
                <p className="mt-8 text-xs text-gray-500">
                  You can close this page; we&apos;ll email you. Questions? <Link href="/help" className="underline">Get help</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </CountryProvider>
    )
  }

  if (error || !order) {
    return (
      <CountryProvider>
        <UserAwareNavigation />
        <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-12 h-12 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
            <p className="text-gray-600 mb-4">{error || 'We couldn\'t find the order you\'re looking for.'}</p>
            <Link href={continueShoppingRoute}>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">Continue Shopping</Button>
          </Link>
        </div>
      </div>
      </CountryProvider>
    )
  }

  const isDigitalOrder = (order as any).fulfillment_type === 'digital' || (!order.shipping_city && !(order as any).shipping_address_line_1)

  return (
    <CountryProvider>
      <UserAwareNavigation />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Pawfection Achieved! 🎉</h1>
          <p className="text-xl text-gray-600 mb-4">
            {isDigitalOrder
              ? 'Your Pawtrait is ready. Your receipt and download link are on their way to your inbox.'
              : "We're so excited to bring your pet's Pawtrait to life! Your order is confirmed and we're getting started right away."}
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 inline-block">
            <p className="text-green-800 font-medium">Order #{order.order_number}</p>
          </div>
          {(order as any).is_guest_checkout && (
            <div className="mx-auto mt-4 max-w-md rounded-2xl bg-purple-50 border border-purple-100 p-4 text-left text-sm text-purple-900">
              <p className="font-semibold">🎁 Check your inbox</p>
              <p className="mt-1">We’ve emailed your receipt, plus a one-tap link to your new Pawtraits account{(order as any).fulfillment_type === 'digital' ? ' where your download is waiting' : ' — with a bonus digital copy of your Pawtrait inside'}.</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.order_items.map((item) => (
                <div key={item.id} className="flex items-start space-x-3 border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                  {/* Item thumbnail */}
                  <div className="flex-shrink-0">
                    <Image
                      src={item.image_url || "/placeholder.svg"}
                      alt={item.image_title}
                      width={60}
                      height={60}
                      className="rounded-lg object-cover"
                    />
                  </div>

                  {/* Item details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {extractDescriptionTitle(item.image_title) || item.image_title}
                    </h4>
                    <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                      <p>Pawtrait</p>
                      {item.quantity > 1 && <p>Quantity: {item.quantity}</p>}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPrice(item.total_price)}
                    </div>
                  </div>
                </div>
              ))}
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatPrice(order.subtotal_amount)}</span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Referral Discount</span>
                    <span>-{formatPrice(order.discount_amount)}</span>
                  </div>
                )}
                {!isDigitalOrder && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery</span>
                  <span>{order.shipping_amount === 0 ? 'Free' : formatPrice(order.shipping_amount)}</span>
                </div>
                )}
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatPrice(order.total_amount)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                What's Next?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {isDigitalOrder ? (
                <div className="rounded-xl bg-purple-50 p-4">
                  <h3 className="font-semibold text-gray-900">Your download</h3>
                  {(order as any).is_guest_checkout ? (
                    <p className="mt-1 text-sm text-gray-700">We&apos;ve emailed {order.customer_email} a one-tap link to your account, where your full-resolution Pawtrait is waiting.</p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-gray-700">Your full-resolution Pawtrait is in your account.</p>
                      <Link href="/customer/downloads" className="mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-purple-600 px-5 font-semibold text-white">Go to my downloads</Link>
                    </>
                  )}
                </div>
              ) : (
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-purple-600">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Order Confirmation</h3>
                    <p className="text-sm text-gray-600">We've sent a confirmation email to {order.customer_email}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-purple-600">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Processing</h3>
                    <p className="text-sm text-gray-600">Your portraits will be printed and prepared for shipping</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-purple-600">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Shipping</h3>
                    <p className="text-sm text-gray-600">Estimated delivery: {formatDeliveryDate(order.estimated_delivery)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Shipping to: {order.shipping_first_name} {order.shipping_last_name}, {order.shipping_city}
                    </p>
                  </div>
                </div>
              </div>

              )}

              {!isDigitalOrder && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Track Your Order</h4>
                <p className="text-sm text-blue-800 mb-3">You'll receive tracking information once your order ships.</p>
                <Link href="/orders">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    View My Orders
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/orders">
            <Button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3">View My Orders</Button>
          </Link>
          <Link href={continueShoppingRoute}>
            <Button variant="outline" className="px-8 py-3 bg-white">
              Continue Shopping
            </Button>
          </Link>
        </div>

        {/* Support */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-2">Need help with your order?</p>
          <Link href="/help" className="text-purple-600 hover:text-purple-700 font-medium">
            Contact Customer Support
          </Link>
        </div>
        </div>
      </div>
    </CountryProvider>
  )
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading order confirmation...</p>
        </div>
      </div>
    }>
      <OrderConfirmationContent />
    </Suspense>
  )
}
