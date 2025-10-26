'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Clock, Truck, CheckCircle, MapPin, Calendar, CreditCard } from 'lucide-react';
import Image from 'next/image';
import { productDescriptionService } from '@/lib/product-utils';
import { extractDescriptionTitle } from '@/lib/utils';

// 🏗️ ORDER DETAIL PAGE
// User-type aware order detail view

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
  total_amount: number;
  currency: string;
  created_at: string;
  payment_status?: string;
  shipping_address?: any;
  order_items: OrderItem[];
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [productDetails, setProductDetails] = useState<{[key: string]: any}>({});

  useEffect(() => {
    const loadOrder = async () => {
      try {
        // Get auth
        const authResponse = await fetch('/api/auth/check');
        if (!authResponse.ok) {
          router.push('/auth/login');
          return;
        }

        const authData = await authResponse.json();
        if (!authData.isAuthenticated || !authData.user) {
          router.push('/auth/login');
          return;
        }

        setUserEmail(authData.user.email);

        // Fetch order
        const orderResponse = await fetch(`/api/shop/orders/${orderId}?email=${authData.user.email}`);

        if (!orderResponse.ok) {
          throw new Error('Order not found');
        }

        const orderData = await orderResponse.json();
        setOrder(orderData);

        // Load product descriptions
        if (orderData.order_items) {
          const details = await productDescriptionService.loadProductDetails([orderData]);
          setProductDetails(details);
        }
      } catch (err) {
        console.error('Error loading order:', err);
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId, router]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'processing': return <Package className="w-5 h-5 text-blue-600" />;
      case 'shipped': return <Truck className="w-5 h-5 text-purple-600" />;
      case 'delivered': return <CheckCircle className="w-5 h-5 text-green-600" />;
      default: return <Package className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-red-600 mb-4">{error || 'Order not found'}</p>
              <Button onClick={() => router.push('/orders')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Orders
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => router.push('/orders')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Button>
        </div>

        {/* Order Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Order {order.order_number}</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {new Date(order.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {getStatusIcon(order.status)}
                <Badge className={getStatusColor(order.status)}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Shipping Address */}
              {order.shipping_address && (
                <div>
                  <h3 className="font-semibold flex items-center mb-2">
                    <MapPin className="w-4 h-4 mr-2" />
                    Shipping Address
                  </h3>
                  <p className="text-sm text-gray-600">
                    {order.shipping_address.name}<br />
                    {order.shipping_address.street}<br />
                    {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}<br />
                    {order.shipping_address.country}
                  </p>
                </div>
              )}

              {/* Payment Info */}
              <div>
                <h3 className="font-semibold flex items-center mb-2">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Payment
                </h3>
                <p className="text-sm text-gray-600">
                  Status: {order.payment_status || 'Paid'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items Card */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex items-start space-x-4 pb-4 border-b last:border-b-0">
                  <div className="flex-shrink-0">
                    <Image
                      src={item.image_url}
                      alt={item.image_title}
                      width={80}
                      height={80}
                      className="rounded-lg object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900">
                      {extractDescriptionTitle(item.image_title) || item.image_title}
                    </h3>
                    <p className="text-sm font-medium text-purple-700">
                      {productDescriptionService.getProductDescription(item.product_id, productDetails)}
                    </p>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {order.currency} {(item.unit_price * item.quantity).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {order.currency} {item.unit_price.toFixed(2)} each
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Total */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-purple-700">
                  {order.currency} {order.total_amount.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
