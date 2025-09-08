"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Package, Eye, Download, Truck, Clock, CheckCircle, ShoppingBag, Loader2, X } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { SupabaseService } from '@/lib/supabase'

interface OrderItem {
  id: string;
  product_id: string;
  image_id: string;
  image_url: string;
  image_title: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  status: 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  customer_email: string;
  shipping_first_name: string;
  shipping_last_name: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postcode: string;
  shipping_country: string;
  subtotal_amount: number;
  shipping_amount: number;
  total_amount: number;
  currency: string;
  estimated_delivery: string;
  created_at: string;
  updated_at: string;
  metadata: string;
  order_items: OrderItem[];
  tracking_number?: string;
}

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productDetails, setProductDetails] = useState<{[key: string]: any}>({})
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>('')
  const [showImageModal, setShowImageModal] = useState(false)
  const supabaseService = new SupabaseService()

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      setError(null)
      
      // Get current user
      const { data: { user } } = await supabaseService.getClient().auth.getUser()
      if (!user?.email) {
        setError('No user found. Please log in.')
        setLoading(false)
        return
      }

      // Fetch orders from the shop orders API
      console.log('Fetching orders for user email:', user.email)
      const response = await fetch(`/api/shop/orders?email=${encodeURIComponent(user.email)}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`)
      }
      
      const ordersData = await response.json()
      console.log('Loaded orders:', ordersData)
      
      setOrders(ordersData || [])
      
      // Load product details for order items
      if (ordersData && ordersData.length > 0) {
        await loadProductDetails(ordersData)
      }
    } catch (error) {
      console.error('Error loading orders:', error)
      setError('Failed to load orders. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadProductDetails = async (orders: Order[]) => {
    try {
      const productDetailsMap: {[key: string]: any} = {}
      
      // Get current user email for API authentication
      const { data: { user } } = await supabaseService.getClient().auth.getUser()
      if (!user?.email) {
        console.warn('No user email found for product details loading')
        return
      }
      
      // Collect all unique product IDs from all orders
      const allOrderItems = orders.flatMap(order => order.order_items || [])
      const uniqueProductIds = [...new Set(allOrderItems.map(item => item.product_id))]
      console.log('Customer loading product details for IDs:', uniqueProductIds)
      
      // Fetch product details via API with proper URL encoding
      for (const productId of uniqueProductIds) {
        try {
          const encodedProductId = encodeURIComponent(productId)
          const url = `/api/shop/products/${encodedProductId}?email=${encodeURIComponent(user.email)}`
          console.log(`Customer fetching URL: ${url}`)
          
          const response = await fetch(url)
          
          if (response.ok) {
            const product = await response.json()
            console.log(`Customer product details for ${productId}:`, product)
            productDetailsMap[productId] = product
          } else {
            console.warn(`Failed to fetch product details for ${productId}, status:`, response.status)
            const errorText = await response.text()
            console.warn('Error response:', errorText)
          }
        } catch (error) {
          console.error(`Error fetching product details for ${productId}:`, error)
        }
      }
      
      console.log('Customer final product details map:', productDetailsMap)
      setProductDetails(productDetailsMap)
    } catch (error) {
      console.error('Error loading product details:', error)
    }
  }

  const getProductDescription = (productId: string) => {
    const product = productDetails[productId]
    console.log(`Customer getting description for product ${productId}:`, product)
    
    if (product) {
      // Use the product name if available, otherwise construct it
      if (product.name) {
        return product.name
      }
      // Fallback: construct description similar to generateDescription function
      const sizeName = product.size_name || ''
      const formatName = product.formats?.name || product.format?.name || ''
      const mediumName = product.media?.name || product.medium?.name || ''
      const description = `${sizeName} ${formatName} ${mediumName}`.trim()
      if (description) {
        return description
      }
      // Final fallback with dimensions
      return `${product.width_cm || 'Unknown'} x ${product.height_cm || 'Unknown'}cm ${formatName} ${mediumName}`.trim()
    }
    
    // Show the current state for debugging
    const hasProductDetails = Object.keys(productDetails).length > 0
    return hasProductDetails ? `No product found for ID: ${productId}` : 'Product details loading...'
  }

  const handleImageClick = (imageUrl: string, imageTitle: string) => {
    setSelectedImageUrl(imageUrl)
    setSelectedImageTitle(imageTitle)
    setShowImageModal(true)
  }

  const formatPrice = (priceInPence: number, currency: string = 'GBP') => {
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€'
    return `${symbol}${(priceInPence / 100).toFixed(2)}`
  }

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'shipped':
        return 'bg-purple-100 text-purple-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />
      case 'processing':
        return <Clock className="w-4 h-4" />
      case 'shipped':
        return <Truck className="w-4 h-4" />
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />
      case 'cancelled':
        return <Package className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">My Orders</h1>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
              <p className="text-gray-600">Loading your orders...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">My Orders</h1>
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package className="w-12 h-12 text-red-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Error Loading Orders</h2>
              <p className="text-gray-600 mb-8">{error}</p>
              <Button 
                onClick={loadOrders}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">My Orders</h1>
          
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">No orders yet</h2>
              <p className="text-gray-600 mb-8">When you place an order, it will appear here.</p>
              <Link href="/customer/shop">
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={loadOrders}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Refresh
            </Button>
            <Link href="/customer/shop">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardHeader className="bg-gray-50 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                  <div>
                    <CardTitle className="text-lg">{order.order_number}</CardTitle>
                    <p className="text-sm text-gray-600">
                      Placed on {new Date(order.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      Shipping to: {order.shipping_first_name} {order.shipping_last_name}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge className={`${getStatusColor(order.status)} flex items-center space-x-1`}>
                      {getStatusIcon(order.status)}
                      <span className="capitalize">{order.status}</span>
                    </Badge>
                    <span className="font-semibold text-lg">£{(order.total_amount / 100).toFixed(2)}</span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="space-y-4">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex items-start space-x-4">
                      <div className="flex-shrink-0 cursor-pointer" onClick={() => handleImageClick(item.image_url, item.image_title)}>
                        <Image
                          src={item.image_url}
                          alt={item.image_title}
                          width={80}
                          height={80}
                          className="rounded-lg object-cover hover:opacity-80 transition-opacity"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900">{item.image_title}</h3>
                        <p className="text-sm font-medium text-purple-700">{getProductDescription(item.product_id)}</p>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                      </div>
                      
                      <div className="text-right">
                        <div className="space-y-1">
                          {/* Original Price (if there's a discount) */}
                          {item.original_price && item.original_price !== item.unit_price && (
                            <div className="text-xs">
                              <span className="text-gray-500">Was: </span>
                              <span className="text-gray-400 line-through">
                                {formatPrice(item.original_price, order.currency)}
                              </span>
                            </div>
                          )}
                          
                          {/* Current Price */}
                          <div className="text-sm">
                            <span className="font-medium">
                              {formatPrice(item.unit_price, order.currency)}
                            </span>
                            <span className="text-gray-500"> × {item.quantity}</span>
                          </div>
                          
                          {/* Discount Amount */}
                          {((item.original_price && item.original_price !== item.unit_price) || (item.discount_amount && item.discount_amount > 0)) && (
                            <div className="text-xs text-green-600">
                              <span>Saved: </span>
                              <span className="font-medium">
                                {item.discount_amount && item.discount_amount > 0 
                                  ? formatPrice(item.discount_amount * item.quantity, order.currency)
                                  : formatPrice((item.original_price! - item.unit_price) * item.quantity, order.currency)
                                }
                              </span>
                            </div>
                          )}
                          
                          {/* Total Price */}
                          <div className="text-lg font-semibold text-gray-900">
                            {formatPrice(item.total_price, order.currency)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-4 text-gray-500">
                      No items found for this order
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>£{(order.subtotal_amount / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping:</span>
                      <span>£{(order.shipping_amount / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-base border-t border-gray-200 pt-2">
                      <span>Total:</span>
                      <span>£{(order.total_amount / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Order Actions */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="space-y-1">
                      {(order.tracking_code || order.tracking_number) && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Tracking:</span> {order.tracking_code || order.tracking_number}
                        </div>
                      )}
                      {order.carrier_name && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Carrier:</span> {order.carrier_name}
                        </div>
                      )}
                      {order.estimated_delivery && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Estimated Delivery:</span> {new Date(order.estimated_delivery).toLocaleDateString()}
                        </div>
                      )}
                      {order.gelato_status && order.gelato_status !== order.status && (
                        <div className="text-sm text-gray-500">
                          <span className="font-medium">Print Status:</span> {order.gelato_status}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-3">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/customer/orders/${order.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </a>
                      </Button>
                      
                      {(order.status === 'shipped' && (order.tracking_code || order.tracking_number)) && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={order.tracking_url || `#`} target="_blank" rel="noopener noreferrer">
                            <Truck className="w-4 h-4 mr-2" />
                            Track Package
                          </a>
                        </Button>
                      )}
                      
                      {order.status === 'delivered' && (
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          Download Invoice
                        </Button>
                      )}
                      
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
                        Buy Again
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Show count of orders */}
        {orders.length > 0 && (
          <div className="text-center mt-8">
            <p className="text-sm text-gray-600">
              Showing {orders.length} order{orders.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Image Detail Modal */}
        <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Image Details</span>
                <Button variant="ghost" size="sm" onClick={() => setShowImageModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex items-center justify-center p-4">
              {selectedImageUrl && (
                <div className="max-w-full max-h-[70vh] overflow-hidden">
                  <Image
                    src={selectedImageUrl}
                    alt={selectedImageTitle}
                    width={800}
                    height={600}
                    className="w-full h-full object-contain rounded-lg"
                    priority
                  />
                </div>
              )}
            </div>
            
            {selectedImageTitle && (
              <div className="px-6 pb-6">
                <h3 className="text-lg font-semibold text-gray-900">{selectedImageTitle}</h3>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}