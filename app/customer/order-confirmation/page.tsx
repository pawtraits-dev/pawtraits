"use client"

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Package, Truck, Mail, ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

function CustomerOrderConfirmationContent() {
  const [orderData, setOrderData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  const orderNumber = searchParams.get('orderNumber')
  const paymentIntentId = searchParams.get('payment_intent')

  useEffect(() => {
    if (orderId || paymentIntentId) {
      fetchOrderData()
    } else {
      setError("No order ID or payment intent provided")
      setLoading(false)
    }
  }, [orderId, paymentIntentId])

  const fetchOrderData = async () => {
    try {
      let response;
      
      if (paymentIntentId) {
        // Handle Stripe payment confirmation - fetch order by payment intent
        console.log('Fetching order for payment intent:', paymentIntentId);
        
        // First check if order was created by webhook (may take a moment)
        // If not found, show payment success with minimal details
        try {
          response = await fetch(`/api/shop/orders?paymentIntent=${paymentIntentId}`);
        } catch (err) {
          console.log('Order not yet created by webhook, showing payment success');
        }
        
        if (response && response.ok) {
          const orderData = await response.json();
          setOrderData(orderData);
        } else {
          // Payment succeeded but order not yet in database (webhook may be delayed)
          setOrderData({
            id: paymentIntentId,
            orderNumber: `PW-${Date.now()}-${paymentIntentId.slice(-6)}`,
            status: 'confirmed',
            paymentStatus: 'paid',
            total: 0, // Will be updated when webhook processes
            items: [],
            shippingAddress: {},
            estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            isStripeOrder: true,
            processingNote: 'Your payment was successful. Order details will be updated shortly.'
          });
        }
      } else if (orderId) {
        // Handle legacy order confirmation
        console.log('Fetching legacy order:', orderId);
        response = await fetch(`/api/shop/orders?orderId=${orderId}`);
        
        if (response.ok) {
          const orderData = await response.json();
          setOrderData(orderData);
        } else {
          throw new Error('Order not found');
        }
      }
    } catch (error) {
      console.error('Error fetching order data:', error)
      setError("Failed to load order details")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading order confirmation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Order Not Found</h2>
              <p className="text-gray-600 mb-8">{error}</p>
              <Link href="/customer/shop">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                  Continue Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
          <p className="text-lg text-gray-600">Thank you for your purchase</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Order Number</span>
                <span className="font-mono font-medium">{orderData.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Order Date</span>
                <span className="font-medium">{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Confirmed
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estimated Delivery</span>
                <span className="font-medium">{orderData.estimatedDelivery}</span>
              </div>
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card>
            <CardHeader>
              <CardTitle>What's Next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Order Confirmation Email</h3>
                  <p className="text-sm text-gray-600">We've sent a confirmation email with your order details</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Package className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Order Processing</h3>
                  <p className="text-sm text-gray-600">Your portraits are being prepared for printing</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Truck className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Shipping Updates</h3>
                  <p className="text-sm text-gray-600">You'll receive tracking information once shipped</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/customer/orders">
            <Button variant="outline" className="w-full sm:w-auto">
              View Order History
            </Button>
          </Link>
          
          <Link href="/customer/shop">
            <Button className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white">
              Continue Shopping
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {/* Support Info */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Need Help?</h3>
              <p className="text-gray-600 mb-4">
                If you have any questions about your order, please don't hesitate to contact us.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="outline" size="sm">
                  Contact Support
                </Button>
                <Button variant="outline" size="sm">
                  View FAQ
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CustomerOrderConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading order confirmation...</p>
        </div>
      </div>
    }>
      <CustomerOrderConfirmationContent />
    </Suspense>
  )
}