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
  const { continueShoppingRoute } = useUserRouting()

  useEffect(() => {
    if (orderId || orderNumber || paymentIntent) {
      fetchOrderDetails()
    } else {
      setError('Order information not found')
      setLoading(false)
    }
  }, [orderId, orderNumber, paymentIntent])

  const fetchOrderDetails = async () => {
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
        if (response.status === 404) {
          setError('Order not found')
        } else {
          throw new Error('Failed to fetch order details')
        }
        return
      }
      const order = await response.json()
      setOrder(order)
      
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
      setLoading(false)
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
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
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
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
          <p className="text-xl text-gray-600 mb-4">
            Thank you for your purchase! Your beautiful pet portraits are being prepared.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 inline-block">
            <p className="text-green-800 font-medium">Order #{order.order_number}</p>
          </div>
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
                <div key={item.id} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.image_title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Custom Pet Portrait
                      </p>
                      {item.quantity > 1 && <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatPrice(item.total_price)}</p>
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
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span>{order.shipping_amount === 0 ? 'Free' : formatPrice(order.shipping_amount)}</span>
                </div>
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
          <Link href="/support" className="text-purple-600 hover:text-purple-700 font-medium">
            Contact Customer Support
          </Link>
        </div>
      </div>
    </div>
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
