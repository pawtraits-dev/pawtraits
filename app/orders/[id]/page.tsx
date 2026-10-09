'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Clock, Truck, CheckCircle, MapPin, Calendar, CreditCard } from 'lucide-react';
import { productDescriptionService } from '@/lib/product-utils';
import { extractDescriptionTitle } from '@/lib/utils';
import ItemDownload from '@/components/orders/ItemDownload';

// 🏗️ ORDER DETAIL PAGE — data via /api/shop/orders/[id] (signed-in owner, partner or admin)

interface OrderDownload { id: string; imageId: string | null; source: string; status: string; url: string }
interface OrderItem {
  id: string;
  product_id: string;
  image_id: string;
  image_url: string;
  image_title: string;
  quantity: number;
  unit_price: number;   // pence
  total_price: number;  // pence
  product_data?: any;
  download?: OrderDownload | null;
}
interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  subtotal_amount?: number;
  shipping_amount?: number;
  discount_amount?: number;
  credit_applied?: number;
  currency: string;
  created_at: string;
  payment_status?: string;
  estimated_delivery?: string | null;
  shipping_first_name?: string;
  shipping_last_name?: string;
  shipping_address_line_1?: string | null;
  shipping_address_line_2?: string | null;
  shipping_address?: string | null;
  shipping_city?: string;
  shipping_postcode?: string;
  shipping_country?: string;
  fulfillment_type?: string | null;
  carrier?: string | null;
  tracking_code?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  order_items: OrderItem[];
  downloads?: OrderDownload[];
}

const money = (pence: number | undefined, currency = 'GBP') => productDescriptionService.formatPrice(pence ?? 0, currency);

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productDetails, setProductDetails] = useState<{ [key: string]: any }>({});

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const res = await fetch(`/api/shop/orders/${orderId}`, { credentials: 'include', cache: 'no-store' });
        if (res.status === 401) {
          router.push(`/auth/login?returnTo=${encodeURIComponent(`/orders/${orderId}`)}`);
          return;
        }
        if (!res.ok) throw new Error('Order not found');
        const data: Order = await res.json();
        setOrder(data);
        if (data.order_items?.length) setProductDetails(await productDescriptionService.loadProductDetails([data]));
      } catch (err) {
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
      default: return <CheckCircle className="w-5 h-5 text-blue-600" />;
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full" /></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-red-600 mb-4">{error || 'Order not found'}</p>
              <Button onClick={() => router.push('/orders')}><ArrowLeft className="w-4 h-4 mr-2" />Back to Orders</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const cur = order.currency || 'GBP';
  const addressLines = [
    [order.shipping_first_name, order.shipping_last_name].filter(Boolean).join(' '),
    order.shipping_address_line_1 || order.shipping_address,
    order.shipping_address_line_2,
    [order.shipping_city, order.shipping_postcode].filter(Boolean).join(' '),
    order.shipping_country,
  ].filter(Boolean) as string[];
  const hasPhysical = order.order_items?.some((i) => (i.product_data?.product_type ?? 'physical_print') !== 'digital_download');
  const tracking = order.tracking_code || order.tracking_number;
  const statusLabel = order.status.charAt(0).toUpperCase() + order.status.slice(1);

  return (
    <div className="min-h-screen bg-gray-50 py-8 pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        <Button variant="outline" onClick={() => router.push('/orders')}><ArrowLeft className="w-4 h-4 mr-2" />Back to Orders</Button>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-xl sm:text-2xl break-all">Order {order.order_number}</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {new Date(order.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(order.status)}
                <Badge className={getStatusColor(order.status)}>{statusLabel}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-6 text-sm">
              {hasPhysical && addressLines.length > 0 && (
                <div>
                  <h3 className="font-semibold flex items-center mb-2"><MapPin className="w-4 h-4 mr-2" />Delivery address</h3>
                  <p className="text-gray-600">{addressLines.map((l, i) => <span key={i}>{l}<br /></span>)}</p>
                </div>
              )}
              <div className="space-y-1">
                <h3 className="font-semibold flex items-center mb-2"><CreditCard className="w-4 h-4 mr-2" />Payment and delivery</h3>
                <p className="text-gray-600">Payment: {order.payment_status === 'paid' ? 'Paid' : order.payment_status || 'Paid'}</p>
                {hasPhysical && order.estimated_delivery && <p className="text-gray-600">Estimated delivery: {new Date(order.estimated_delivery).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</p>}
                {tracking && (
                  <p className="text-gray-600">
                    Tracking: {order.tracking_url ? <a className="text-purple-700 underline" href={order.tracking_url} target="_blank" rel="noopener noreferrer">{tracking}</a> : tracking}
                    {order.carrier ? ` (${order.carrier})` : ''}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex items-start gap-4 pb-4 border-b last:border-b-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image_url} alt={item.image_title} className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900">{extractDescriptionTitle(item.image_title) || item.image_title}</h3>
                    <p className="text-sm font-medium text-purple-700">{productDescriptionService.getProductDescription(item.product_id, productDetails)}</p>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                    <ItemDownload download={item.download} />
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-gray-900">{money(item.total_price, cur)}</p>
                    {item.quantity > 1 && <p className="text-xs text-gray-500">{money(item.unit_price, cur)} each</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t space-y-2 text-sm">
              {order.subtotal_amount != null && <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{money(order.subtotal_amount, cur)}</span></div>}
              {!!order.discount_amount && <div className="flex justify-between text-green-700"><span>Discount</span><span>−{money(order.discount_amount, cur)}</span></div>}
              {!!order.credit_applied && <div className="flex justify-between text-green-700"><span>Credit</span><span>−{money(order.credit_applied, cur)}</span></div>}
              {order.shipping_amount != null && <div className="flex justify-between"><span className="text-gray-600">Delivery</span><span>{order.shipping_amount ? money(order.shipping_amount, cur) : 'Free'}</span></div>}
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-2xl font-bold text-purple-700">{money(order.total_amount, cur)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
