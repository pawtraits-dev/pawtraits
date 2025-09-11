'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ArrowLeft,
  Package, 
  Clock, 
  Truck, 
  CheckCircle, 
  User,
  Users,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  ExternalLink,
  RefreshCw,
  Loader2,
  X,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { AdminSupabaseService } from '@/lib/admin-supabase';
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
  status: string;
  customer_id: string;
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
  error_message?: string;
  metadata?: string;
  // Partner-client order fields
  order_type?: string;
  placed_by_partner_id?: string;
  client_email?: string;
  client_name?: string;
  // Partner information (joined from partners table)
  partners?: {
    id: string;
    first_name: string;
    last_name: string;
    business_name?: string;
    email: string;
  } | null;
}

export default function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [productDetails, setProductDetails] = useState<{[key: string]: any}>({});
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>('');
  const [showImageModal, setShowImageModal] = useState(false);
  const adminService = new AdminSupabaseService();

  useEffect(() => {
    loadOrder();
  }, [params.id]);

  const loadOrder = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/orders/${params.id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch order: ${response.status}`);
      }
      
      const orderData = await response.json();
      setOrder(orderData);
      
      // Load product details for each order item
      if (orderData.order_items?.length > 0) {
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

  const getProductDescription = (productId: string) => {
    return productDescriptionService.getProductDescription(productId, productDetails);
  };

  const refreshOrder = async () => {
    setRefreshing(true);
    await loadOrder();
    setRefreshing(false);
  };

  const formatPrice = (priceInPence: number, currency: string = 'GBP') => {
    return productDescriptionService.formatPrice(priceInPence, currency);
  };

  const getItemPricing = (item: any, order: any) => {
    return productDescriptionService.getOrderItemPricing(item, order);
  };

  const getOrderPricing = (order: any) => {
    return productDescriptionService.getOrderPricing(order);
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'processing':
        return <Package className="w-5 h-5 text-blue-600" />;
      case 'printing':
        return <Package className="w-5 h-5 text-orange-600" />;
      case 'printed':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'shipped':
        return <Truck className="w-5 h-5 text-purple-600" />;
      case 'in_transit':
        return <Truck className="w-5 h-5 text-purple-600" />;
      case 'delivered':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'fulfillment_error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'cancelled':
        return <X className="w-5 h-5 text-gray-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      confirmed: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      printing: "bg-orange-100 text-orange-800",
      printed: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      in_transit: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
      fulfillment_error: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800",
    };
    return variants[status.toLowerCase()] || "bg-gray-100 text-gray-800";
  };

  const handleImageClick = (imageUrl: string, imageTitle: string) => {
    setSelectedImageUrl(imageUrl);
    setSelectedImageTitle(imageTitle);
    setShowImageModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/admin/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
        </div>
        
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
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order #{order.order_number}</h1>
            <p className="text-gray-600 mt-1">Placed on {formatDate(order.created_at)}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={refreshOrder} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge className={`${getStatusBadge(order.status)} text-base px-3 py-2`}>
            <div className="flex items-center space-x-2">
              {getStatusIcon(order.status)}
              <span className="capitalize">{order.status}</span>
            </div>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Status & Tracking */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(order.status)}
                    <div>
                      <p className="font-medium">{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
                      <p className="text-sm text-gray-600">Updated {formatDate(order.updated_at)}</p>
                    </div>
                  </div>
                  {order.gelato_status && order.gelato_status !== order.status && (
                    <div className="text-right">
                      <p className="text-sm font-medium">Print Status:</p>
                      <p className="text-sm text-gray-600 capitalize">{order.gelato_status}</p>
                    </div>
                  )}
                </div>

                {order.tracking_code && (
                  <Separator />
                )}

                {order.tracking_code && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-blue-900">Package Tracking</p>
                        <p className="text-blue-700">Tracking Code: {order.tracking_code}</p>
                        {order.carrier_name && (
                          <p className="text-blue-700">Carrier: {order.carrier_name}</p>
                        )}
                        {order.shipped_at && (
                          <p className="text-sm text-blue-600">Shipped: {formatDate(order.shipped_at)}</p>
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

                {order.error_message && (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-900">Fulfillment Issue</p>
                        <p className="text-red-700 text-sm">{order.error_message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
                  <div key={item.id} className="flex items-start space-x-4">
                    <div className="flex-shrink-0 cursor-pointer" onClick={() => handleImageClick(item.image_url, item.image_title)}>
                      <Image
                        src={item.image_url}
                        alt={item.image_title}
                        width={120}
                        height={120}
                        className="rounded-lg object-cover border hover:opacity-80 transition-opacity"
                      />
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold text-gray-900">{item.image_title}</h3>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p className="font-medium text-blue-900">{getProductDescription(item.product_id)}</p>
                        <p>Quantity: {item.quantity}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {(() => {
                        const pricing = getItemPricing(item, order);
                        return (
                          <div className="space-y-1">
                            {/* Original price */}
                            <div className="text-sm flex justify-between">
                              <span className="text-gray-500">Original Price</span>
                              <span className={pricing.hasDiscount ? "text-gray-400 line-through" : "text-gray-900"}>
                                {pricing.originalPrice || pricing.unitPrice}
                              </span>
                            </div>
                            
                            {/* Discount */}
                            {pricing.hasDiscount && (
                              <div className="text-sm flex justify-between">
                                <span className="text-gray-500">Discount ({pricing.discountPercentage}%)</span>
                                <span className="text-green-600 font-medium">
                                  -{pricing.discountPerUnitFormatted}
                                </span>
                              </div>
                            )}
                            
                            {/* Unit price */}
                            <div className="text-sm flex justify-between">
                              <span className="text-gray-500">Price × {pricing.quantity}</span>
                              <span className="font-medium">
                                {pricing.unitPrice}
                              </span>
                            </div>
                            
                            {/* Total price */}
                            <div className="text-lg font-semibold flex justify-between border-t pt-1 mt-1">
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
        </div>

        {/* Sidebar - Customer & Payment Info */}
        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Customer</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Link href={`/admin/customers/${order.customer_id}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                  {order.shipping_first_name} {order.shipping_last_name}
                </Link>
                <div className="flex items-center space-x-2 text-sm text-gray-600 mt-1">
                  <Mail className="w-4 h-4" />
                  <span>{order.customer_email}</span>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <p className="font-medium mb-2">Shipping Address</p>
                <div className="flex items-start space-x-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mt-0.5" />
                  <div>
                    <p>{order.shipping_address}</p>
                    <p>{order.shipping_city}, {order.shipping_postcode}</p>
                    <p>{order.shipping_country}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Partner Information - for partner-for-client orders */}
          {order.order_type === 'partner_for_client' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Partner & Client</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.client_name && (
                  <div>
                    <p className="font-medium mb-2 text-purple-700">Client Details</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>{order.client_name}</span>
                      </div>
                      {order.client_email && (
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4" />
                          <span>{order.client_email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {order.partners && (
                  <div>
                    <p className="font-medium mb-2 text-green-700">Placing Partner</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>
                          {order.partners.business_name || `${order.partners.first_name} ${order.partners.last_name}`}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4" />
                        <span>{order.partners.email}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5" />
                <span>Payment</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>{formatPrice(order.subtotal_amount, order.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping:</span>
                  <span>{formatPrice(order.shipping_amount, order.currency)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{formatPrice(order.total_amount, order.currency)}</span>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Status:</span>
                  <Badge variant={order.payment_status === 'paid' ? 'default' : 'destructive'}>
                    {order.payment_status || 'unknown'}
                  </Badge>
                </div>
                {order.payment_intent_id && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment ID:</span>
                    <span className="font-mono text-xs">{order.payment_intent_id}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Gelato Integration Info */}
          {order.gelato_order_id && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="w-5 h-5" />
                  <span>Print Fulfillment</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gelato Order ID:</span>
                    <a 
                      href={`https://dashboard.gelato.com/orders/view/${order.gelato_order_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                    >
                      {order.gelato_order_id}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Print Status:</span>
                    <Badge variant="outline" className="capitalize">
                      {order.gelato_status || 'pending'}
                    </Badge>
                  </div>
                  {order.shipped_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipped:</span>
                      <span>{formatDate(order.shipped_at)}</span>
                    </div>
                  )}
                  {order.delivered_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivered:</span>
                      <span>{formatDate(order.delivered_at)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Timeline</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Updated:</span>
                  <span>{formatDate(order.updated_at)}</span>
                </div>
                {order.estimated_delivery && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. Delivery:</span>
                    <span>{formatDate(order.estimated_delivery)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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
  );
}