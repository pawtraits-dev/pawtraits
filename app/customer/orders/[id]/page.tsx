'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft,
  Package, 
  Clock, 
  Truck, 
  CheckCircle, 
  MapPin,
  Calendar,
  ExternalLink,
  RefreshCw,
  Loader2,
  X,
  AlertCircle,
  Download,
  Share2
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';
import { productDescriptionService } from '@/lib/product-utils';

interface OrderItem {
  id: string;
  product_id: string;
  image_id: string;
  image_url: string;
  image_title: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  original_price?: number; // For discount display
  discount_amount?: number;
  product_data?: any;
}

interface Order {
  id: string;
  order_number: string;
  status: 'confirmed' | 'processing' | 'printing' | 'printed' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled' | 'fulfillment_error';
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
  order_items: OrderItem[];
  // Gelato tracking fields
  gelato_order_id?: string;
  gelato_status?: string;
  tracking_code?: string;
  tracking_url?: string;
  carrier_name?: string;
  shipped_at?: string;
  delivered_at?: string;
  payment_status?: string;
  payment_intent_id?: string;
  metadata?: string;
}

export default function CustomerOrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [productDetails, setProductDetails] = useState<{[key: string]: any}>({});
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadOrder();
  }, [params.id]);

  const loadOrder = async () => {
    try {
      setError(null);
      
      // Get current user
      const { data: { user } } = await supabaseService.getClient().auth.getUser();
      if (!user?.email) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      // Fetch order details
      const response = await fetch(`/api/shop/orders/${params.id}?email=${encodeURIComponent(user.email)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Order not found');
        } else if (response.status === 403) {
          setError('Access denied');
        } else {
          setError('Failed to load order');
        }
        setLoading(false);
        return;
      }
      
      const orderData = await response.json();
      setOrder(orderData);
      
      // Load product details for each order item
      if (orderData.order_items?.length > 0) {
        await loadProductDetails(orderData.order_items);
      }
    } catch (error) {
      console.error('Error loading order:', error);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const loadProductDetails = async (orderItems: OrderItem[]) => {
    try {
      const productDetailsMap: {[key: string]: any} = {};
      
      // Get current user email for API authentication
      const { data: { user } } = await supabaseService.getClient().auth.getUser();
      if (!user?.email) {
        console.error('No user email found for product details API');
        return;
      }
      
      // Fetch product details for each unique product_id using shop products API
      const uniqueProductIds = [...new Set(orderItems.map(item => item.product_id))];
      
      for (const productId of uniqueProductIds) {
        try {
          const response = await fetch(`/api/shop/products/${productId}?email=${encodeURIComponent(user.email)}`);
          
          if (response.ok) {
            const product = await response.json();
            productDetailsMap[productId] = product;
          } else {
            console.error(`Failed to fetch product ${productId}:`, response.status);
          }
        } catch (error) {
          console.error(`Error fetching product ${productId}:`, error);
        }
      }
      
      setProductDetails(productDetailsMap);
    } catch (error) {
      console.error('Error loading product details:', error);
    }
  };

  const refreshOrder = async () => {
    setRefreshing(true);
    await loadOrder();
    setRefreshing(false);
  };

  const formatPrice = (priceInPence: number, currency: string = 'GBP') => {
    return productDescriptionService.formatPrice(priceInPence, currency);
  };

  const getProductDescription = (productId: string) => {
    return productDescriptionService.getProductDescription(productId, productDetails);
  };

  const getItemPricing = (item: any, order: any) => {
    return productDescriptionService.getOrderItemPricing(item, order);
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'printing':
        return 'bg-orange-100 text-orange-800';
      case 'printed':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'in_transit':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'fulfillment_error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="w-5 h-5" />;
      case 'processing':
        return <Clock className="w-5 h-5" />;
      case 'printing':
        return <Package className="w-5 h-5" />;
      case 'printed':
        return <CheckCircle className="w-5 h-5" />;
      case 'shipped':
        return <Truck className="w-5 h-5" />;
      case 'in_transit':
        return <Truck className="w-5 h-5" />;
      case 'delivered':
        return <CheckCircle className="w-5 h-5" />;
      case 'cancelled':
        return <X className="w-5 h-5" />;
      case 'fulfillment_error':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const getStatusDescription = (status: Order['status']) => {
    switch (status) {
      case 'confirmed':
        return 'Your order has been confirmed and is being prepared for printing.';
      case 'processing':
        return 'Your order is being processed and will begin printing soon.';
      case 'printing':
        return 'Your pet portrait is currently being printed.';
      case 'printed':
        return 'Your pet portrait has been printed and is being prepared for shipping.';
      case 'shipped':
        return 'Your order has been shipped and is on its way to you.';
      case 'in_transit':
        return 'Your package is in transit and will be delivered soon.';
      case 'delivered':
        return 'Your order has been delivered! Enjoy your beautiful pet portrait.';
      case 'cancelled':
        return 'This order has been cancelled.';
      case 'fulfillment_error':
        return 'There was an issue with fulfilling your order. Our team is working to resolve it.';
      default:
        return 'We are processing your order.';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
              <p className="text-gray-600">Loading order details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Link href="/customer/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
          
          <Card>
            <CardContent className="text-center py-16">
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Order Not Found</h3>
              <p className="text-gray-600 mb-4">{error || 'The requested order could not be found.'}</p>
              <Button onClick={loadOrder} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/customer/orders">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Order #{order.order_number}</h1>
              <p className="text-gray-600 mt-1">Placed on {new Date(order.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={refreshOrder} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Order Status Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Badge className={`${getStatusColor(order.status)} text-lg px-4 py-2`}>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(order.status)}
                  <span className="capitalize">{order.status.replace('_', ' ')}</span>
                </div>
              </Badge>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(order.total_amount, order.currency)}
                </p>
                <p className="text-sm text-gray-500">{order.currency}</p>
              </div>
            </div>
            
            <p className="text-gray-700 mb-4">{getStatusDescription(order.status)}</p>
            
            {order.tracking_code && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-900">Package Tracking</p>
                    <p className="text-blue-700">Tracking: {order.tracking_code}</p>
                    {order.carrier_name && (
                      <p className="text-blue-700">Carrier: {order.carrier_name}</p>
                    )}
                  </div>
                  {order.tracking_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Track Package
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>Your Items ({order.order_items?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex items-start space-x-4 p-4 bg-white rounded-lg border">
                  <div className="flex-shrink-0">
                    <Image
                      src={item.image_url}
                      alt={item.image_title}
                      width={120}
                      height={120}
                      className="rounded-lg object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-gray-900">{item.image_title}</h3>
                    {getProductDescription(item.product_id) && (
                      <p className="text-sm font-medium text-purple-700">{getProductDescription(item.product_id)}</p>
                    )}
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                    
                    <div className="flex space-x-3">
                      {order.status === 'delivered' && (
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                      <Button variant="outline" size="sm">
                        <Package className="w-4 h-4 mr-2" />
                        Buy Again
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {(() => {
                      const pricing = getItemPricing(item, order);
                      return (
                        <div className="space-y-1">
                          {/* Original price per item */}
                          <div className="text-sm flex justify-between">
                            <span className="text-gray-500">Original Price</span>
                            <span className={pricing.hasDiscount ? "text-gray-400 line-through" : "text-gray-900"}>
                              {pricing.originalPrice || pricing.unitPrice}
                            </span>
                          </div>
                          
                          {/* Discount per item */}
                          {pricing.hasDiscount && (
                            <div className="text-sm flex justify-between">
                              <span className="text-gray-500">Discount ({pricing.discountPercentage}%)</span>
                              <span className="text-green-600 font-medium">
                                -{pricing.discountPerUnitFormatted}
                              </span>
                            </div>
                          )}
                          
                          {/* Unit price per item */}
                          <div className="text-sm flex justify-between">
                            <span className="text-gray-500">Unit Price × {pricing.quantity}</span>
                            <span className="font-medium text-gray-900">
                              {pricing.unitPrice}
                            </span>
                          </div>
                          
                          {/* Total for this item */}
                          <div className="text-sm font-semibold flex justify-between border-t pt-1 mt-1">
                            <span className="text-gray-900">Item Total</span>
                            <span className="text-gray-900">{pricing.totalPrice}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )) || (
                <div className="text-center py-8 text-gray-500">
                  No items found for this order
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shipping Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>Shipping Address</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="font-medium">{order.shipping_first_name} {order.shipping_last_name}</p>
              <p className="text-gray-600">{order.shipping_address}</p>
              <p className="text-gray-600">{order.shipping_city}, {order.shipping_postcode}</p>
              <p className="text-gray-600">{order.shipping_country}</p>
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span>{formatPrice(order.subtotal_amount, order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shipping:</span>
                <span>{formatPrice(order.shipping_amount, order.currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span>{formatPrice(order.total_amount, order.currency)}</span>
              </div>
              
              <Separator />
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Order Date:</span>
                  <span>{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
                {order.estimated_delivery && (
                  <div className="flex justify-between">
                    <span>Estimated Delivery:</span>
                    <span>{new Date(order.estimated_delivery).toLocaleDateString()}</span>
                  </div>
                )}
                {order.delivered_at && (
                  <div className="flex justify-between">
                    <span>Delivered:</span>
                    <span>{new Date(order.delivered_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help & Support */}
        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                If you have any questions about your order, please don't hesitate to contact us.
              </p>
              <div className="flex space-x-3">
                <Button variant="outline" size="sm">
                  Contact Support
                </Button>
                <Button variant="outline" size="sm">
                  Order FAQ
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}