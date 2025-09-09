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
  DollarSign,
  Users
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { productDescriptionService } from '@/lib/product-utils';
import { createClient } from '@supabase/supabase-js';

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
  status: string;
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

export default function PartnerOrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [productDetails, setProductDetails] = useState<{[key: string]: any}>({});

  useEffect(() => {
    loadOrder();
  }, [params.id]);

  const loadOrder = async () => {
    try {
      setError(null);
      
      // Get auth session for API calls
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Session expired - please log in again');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`/api/partners/orders/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
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
      
      // Load product details if order has items
      if (orderData && orderData.order_items && orderData.order_items.length > 0) {
        const productDetailsMap = await productDescriptionService.loadProductDetails([orderData]);
        setProductDetails(productDetailsMap);
      }
    } catch (error) {
      console.error('Error loading order:', error);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
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

  const getStatusColor = (status: string) => {
    const variants: Record<string, string> = {
      confirmed: "bg-blue-100 text-blue-800",
      processing: "bg-yellow-100 text-yellow-800",
      printing: "bg-orange-100 text-orange-800",
      printed: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      in_transit: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
      fulfillment_error: "bg-red-100 text-red-800",
    };
    return variants[status.toLowerCase()] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return <Clock className="w-5 h-5" />;
      case 'processing':
        return <Package className="w-5 h-5" />;
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
      case 'fulfillment_error':
        return <AlertCircle className="w-5 h-5" />;
      case 'cancelled':
        return <X className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const calculateCommission = (orderTotal: number) => {
    // Assume 10% commission rate for partners
    return Math.round(orderTotal * 0.10);
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
          <Link href="/partners/orders">
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

  const commissionAmount = calculateCommission(order.total_amount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/partners/orders">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Order #{order.order_number}</h1>
              <p className="text-gray-600 mt-1">Referred order placed on {new Date(order.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={refreshOrder} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Status */}
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
                    <p className="text-sm text-gray-500">Order Value</p>
                  </div>
                </div>
                
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
                            Track
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
                <CardTitle>Order Items ({order.order_items?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex items-start space-x-4 p-4 bg-white rounded-lg border">
                      <div className="flex-shrink-0">
                        <Image
                          src={item.image_url}
                          alt={item.image_title}
                          width={100}
                          height={100}
                          className="rounded-lg object-cover"
                        />
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <h3 className="font-semibold text-gray-900">{item.image_title}</h3>
                        <p className="text-sm font-medium text-green-700">{getProductDescription(item.product_id)}</p>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">
                          {formatPrice(item.total_price, order.currency)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatPrice(item.unit_price, order.currency)} × {item.quantity}
                        </p>
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Commission Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5" />
                  <span>Commission</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">
                      {formatPrice(commissionAmount, order.currency)}
                    </p>
                    <p className="text-sm text-green-600">Estimated Commission</p>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order Value:</span>
                      <span>{formatPrice(order.total_amount, order.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Commission Rate:</span>
                      <span>10%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <Badge variant="outline">
                        {order.status === 'delivered' ? 'Earned' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Customer</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium">{order.shipping_first_name} {order.shipping_last_name}</p>
                    <p className="text-sm text-gray-600">{order.customer_email}</p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <p className="font-medium mb-2">Shipping To:</p>
                    <div className="flex items-start space-x-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5" />
                      <div>
                        <p>{order.shipping_address}</p>
                        <p>{order.shipping_city}, {order.shipping_postcode}</p>
                        <p>{order.shipping_country}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Timeline</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ordered:</span>
                    <span>{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                  {order.shipped_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipped:</span>
                      <span>{new Date(order.shipped_at).toLocaleDateString()}</span>
                    </div>
                  )}
                  {order.estimated_delivery && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Est. Delivery:</span>
                      <span>{new Date(order.estimated_delivery).toLocaleDateString()}</span>
                    </div>
                  )}
                  {order.delivered_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivered:</span>
                      <span>{new Date(order.delivered_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}