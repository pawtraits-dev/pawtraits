"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Package, Clock, Truck, CheckCircle, Eye, Loader2, Search } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useUserRouting } from "@/hooks/use-user-routing"

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [searchSubmitted, setSearchSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { continueShoppingRoute, userProfile } = useUserRouting()

  const loadOrdersForUser = async (userEmail: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/shop/orders?email=${encodeURIComponent(userEmail)}`)
      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }
      const orderData = await response.json()
      setOrders(orderData)
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('Failed to load orders. Please try again.')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Auto-load orders if user is authenticated
    if (userProfile?.email) {
      setEmail(userProfile.email)
      setSearchSubmitted(true)
      loadOrdersForUser(userProfile.email)
    } else {
      setLoading(false)
    }
  }, [userProfile])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    
    setSearchSubmitted(true)
    await loadOrdersForUser(email)
  }

  const formatPrice = (priceInPence: number) => {
    return `£${(priceInPence / 100).toFixed(2)}`
  }

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
        return <Clock className="w-4 h-4 text-yellow-600" />
      case "processing":
        return <Package className="w-4 h-4 text-blue-600" />
      case "shipped":
        return <Truck className="w-4 h-4 text-purple-600" />
      case "delivered":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      confirmed: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
    }
    return variants[status.toLowerCase()] || "bg-gray-100 text-gray-800"
  }

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  // Show email input if not searched yet AND user is not authenticated
  if (!searchSubmitted && !userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">My Orders</h1>
          
          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Enter your email to view orders</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="mt-1"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={loading || !email.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading...</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" />View My Orders</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">My Orders</h1>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">My Orders</h1>
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package className="w-12 h-12 text-red-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Error Loading Orders</h2>
              <p className="text-gray-600 mb-8">{error}</p>
              <Button 
                onClick={() => {
                  setSearchSubmitted(false)
                  setError(null)
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show empty state if no orders found
  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
            {!userProfile && (
              <Button 
                variant="outline"
                onClick={() => {
                  setSearchSubmitted(false)
                  setEmail('')
                }}
              >
                Search Different Email
              </Button>
            )}
          </div>
          
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">No orders found</h2>
              <p className="text-gray-600 mb-8">No orders found for {email}. When you place an order, it will appear here.</p>
              <Link href={continueShoppingRoute}>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg">
                  Start Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
            <p className="text-gray-600 mt-2">
              {orders.length} order{orders.length !== 1 ? "s" : ""} for {email}
            </p>
          </div>
          {!userProfile && (
            <Button 
              variant="outline"
              onClick={() => {
                setSearchSubmitted(false)
                setEmail('')
              }}
            >
              Search Different Email
            </Button>
          )}
        </div>

        {/* Orders List */}
        <div className="space-y-6">
          {orders.map((order) => (
            <Card key={order.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  {/* Order Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">Order #{order.order_number}</h3>
                      <Badge className={getStatusBadge(order.status)}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(order.status)}
                          <span>{getStatusText(order.status)}</span>
                        </div>
                      </Badge>
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Placed on {formatDate(order.created_at)}</p>
                      <p>
                        Total: <span className="font-medium text-gray-900">{formatPrice(order.total_amount)}</span>
                      </p>
                      <p>Estimated delivery: {formatDate(order.estimated_delivery)}</p>
                    </div>

                    {/* Order Items Preview */}
                    <div className="flex items-center space-x-2 mt-3">
                      {order.order_items.slice(0, 3).map((item) => (
                        <Image
                          key={item.id}
                          src={item.image_url}
                          alt={item.image_title}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-lg object-cover border"
                        />
                      ))}
                      {order.order_items.length > 3 && (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                          +{order.order_items.length - 3}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                    <Link href={`/shop/order-confirmation?orderNumber=${order.order_number}`}>
                      <Button variant="outline" size="sm" className="bg-white">
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Continue Shopping */}
        <div className="mt-12 text-center">
          <Link href={continueShoppingRoute}>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
