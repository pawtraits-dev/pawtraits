'use client';

import { useState, useEffect } from 'react';
import { PartnerOnly } from '@/components/user-access-control';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Eye, Download, Truck, Clock, CheckCircle, ShoppingBag, Users, Percent, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';

interface OrderItem {
  id: string;
  imageUrl: string;
  imageTitle: string;
  title: string;
  product: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  originalPrice: number;
  price: number;
}

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'confirmed';
  total: number;
  originalTotal: number;
  partnerDiscount: number;
  subtotal: number;
  shipping: number;
  currency: string;
  estimatedDelivery?: string;
  trackingNumber?: string;
  items: OrderItem[];
  clientInfo: {
    name: string;
    email: string;
  };
  shippingAddress: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    postcode: string;
    country: string;
  };
}

function PartnerOrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user (matching customer pattern that works)
      const { data: { user } } = await supabaseService.getClient().auth.getUser();
      if (!user) {
        setError('Authentication required - please log in');
        setLoading(false);
        return;
      }

      // Get session for API call
      const { data: { session } } = await supabaseService.getClient().auth.getSession();
      if (!session?.access_token) {
        setError('Session expired - please log in again');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/partners/orders', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch orders');
      }

      const ordersData = await response.json();
      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      setError(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'processing':
      case 'confirmed':
        return 'bg-yellow-100 text-yellow-800';
      case 'shipped':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'processing':
      case 'confirmed':
        return <Clock className="w-4 h-4" />;
      case 'shipped':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <Package className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const formatPrice = (price: number, currency: string = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency
    }).format(price);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-red-900 mb-2">Error Loading Orders</h2>
              <p className="text-red-700 mb-4">{error}</p>
              <Button onClick={loadOrders} variant="outline" className="border-red-300 text-red-700">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Partner Orders</h1>
            <div className="flex items-center text-sm text-green-700 bg-green-100 rounded-full px-4 py-2">
              <Users className="w-4 h-4 mr-2" />
              Partner Account
            </div>
          </div>
          
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">No orders yet</h2>
              <p className="text-gray-600 mb-8">When you place an order for your clients, it will appear here.</p>
              <Link href="/partners/shop">
                <Button className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg">
                  Start Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Partner Orders</h1>
            <div className="flex items-center text-sm text-green-700 bg-green-100 rounded-full px-4 py-2 w-fit mt-2">
              <Percent className="w-4 h-4 mr-2" />
              15% Partner Discount Applied to All Orders
            </div>
          </div>
          <Link href="/partners/shop">
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              Continue Shopping
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden border-l-4 border-l-green-500">
              <CardHeader className="bg-green-50 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                  <div>
                    <CardTitle className="text-lg flex items-center">
                      <Users className="w-5 h-5 mr-2 text-green-600" />
                      {order.orderNumber}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Placed on {new Date(order.date).toLocaleDateString()}
                    </p>
                    {order.clientInfo && (
                      <p className="text-sm text-green-700 font-medium">
                        Client: {order.clientInfo.name}
                      </p>
                    )}
                    {order.estimatedDelivery && (
                      <p className="text-sm text-gray-600">
                        Est. delivery: {new Date(order.estimatedDelivery).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge className={`${getStatusColor(order.status)} flex items-center space-x-1`}>
                      {getStatusIcon(order.status)}
                      <span className="capitalize">{order.status}</span>
                    </Badge>
                    <div className="text-right">
                      {order.partnerDiscount > 0 && (
                        <div className="text-xs text-gray-500 line-through">
                          {formatPrice(order.originalTotal, order.currency)}
                        </div>
                      )}
                      <div className="font-semibold text-lg text-green-600">
                        {formatPrice(order.total, order.currency)}
                      </div>
                      {order.partnerDiscount > 0 && (
                        <div className="text-xs text-green-600">
                          Saved {formatPrice(order.partnerDiscount, order.currency)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="space-y-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            width={80}
                            height={80}
                            className="rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900">{item.title}</h3>
                        <p className="text-sm text-gray-600">{item.product}</p>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        <Badge className="bg-green-100 text-green-800 text-xs mt-1">
                          Partner Order
                        </Badge>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-lg font-semibold text-green-600">
                          {formatPrice(item.totalPrice, order.currency)}
                        </p>
                        <p className="text-xs text-gray-600">
                          {formatPrice(item.unitPrice, order.currency)} each
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Summary */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatPrice(order.subtotal, order.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shipping:</span>
                      <span>{formatPrice(order.shipping, order.currency)}</span>
                    </div>
                    {order.partnerDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Partner Discount:</span>
                        <span>-{formatPrice(order.partnerDiscount, order.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>{formatPrice(order.total, order.currency)}</span>
                    </div>
                  </div>
                </div>

                {/* Order Actions */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="space-y-1">
                      {order.trackingNumber && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Tracking:</span> {order.trackingNumber}
                        </div>
                      )}
                      <div className="text-sm text-green-700">
                        <span className="font-medium">Client:</span> {order.clientInfo.email}
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Shipping to:</span> {order.shippingAddress.city}, {order.shippingAddress.postcode}
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      
                      {order.status === 'shipped' && order.trackingNumber && (
                        <Button variant="outline" size="sm">
                          <Truck className="w-4 h-4 mr-2" />
                          Track Package
                        </Button>
                      )}
                      
                      {order.status === 'delivered' && (
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          Download Invoice
                        </Button>
                      )}
                      
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                        Reorder for Client
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Partner Benefits Card */}
        <Card className="mt-8 bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-green-900 mb-4">Partner Benefits</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-green-800">
                <div className="flex items-center justify-center space-x-2">
                  <Percent className="w-4 h-4" />
                  <span>15% Discount on All Orders</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <Truck className="w-4 h-4" />
                  <span>Priority Processing</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span>Dedicated Support</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PartnerOrdersPage() {
  return (
    <PartnerOnly>
      <PartnerOrdersContent />
    </PartnerOnly>
  );
}