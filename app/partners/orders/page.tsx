'use client';

import { useState, useEffect } from 'react';
import { PartnerOnly } from '@/components/user-access-control';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Eye, Download, Truck, Clock, CheckCircle, ShoppingBag, Users, Percent, AlertCircle, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { productDescriptionService } from '@/lib/product-utils';

interface OrderItem {
  id: string;
  product_id: string;
  image_url: string;
  image_title: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  original_price?: number;
}

interface Order {
  id: string;
  order_number: string;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'confirmed';
  customer_email: string;
  client_email?: string;
  client_name?: string;
  placed_by_partner_id?: string;
  order_type?: string;
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
  trackingNumber?: string;
}

export default function PartnerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productDetails, setProductDetails] = useState<{[key: string]: any}>({});
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedImageTitle, setSelectedImageTitle] = useState<string>('');
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch orders from API (authentication handled server-side)
      const response = await fetch('/api/partners/orders');

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to view your orders.');
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch orders');
        }
        setLoading(false);
        return;
      }

      const ordersData = await response.json();
      setOrders(ordersData || []);
      
      // Load product details for order items
      if (ordersData && ordersData.length > 0) {
        const productDetailsMap = await productDescriptionService.loadProductDetails(ordersData);
        setProductDetails(productDetailsMap);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      setError(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getProductDescription = (productId: string) => {
    return productDescriptionService.getProductDescription(productId, productDetails);
  };

  const getOrderTypeLabel = (orderType?: string) => {
    switch (orderType) {
      case 'customer':
        return 'Direct Customer';
      case 'partner':
        return 'Partner Order';
      case 'partner_for_client':
        return 'Partner for Client';
      default:
        return 'Partner Order'; // Default for legacy orders
    }
  };

  const getOrderTypeBadge = (orderType?: string) => {
    const variants: Record<string, string> = {
      customer: "bg-blue-100 text-blue-800",
      partner: "bg-green-100 text-green-800", 
      partner_for_client: "bg-purple-100 text-purple-800",
    };
    return variants[orderType || 'partner'] || "bg-green-100 text-green-800";
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

  const formatPrice = (priceInPence: number, currency: string = 'GBP') => {
    return productDescriptionService.formatPrice(priceInPence, currency);
  };

  const getItemPricing = (item: any, order: any) => {
    return productDescriptionService.getOrderItemPricing(item, order);
  };

  const getOrderPricing = (order: any) => {
    return productDescriptionService.getOrderPricing(order);
  };

  const handleImageClick = (imageUrl: string, imageTitle: string) => {
    setSelectedImageUrl(imageUrl);
    setSelectedImageTitle(imageTitle);
    setShowImageModal(true);
  };

  if (loading) {
    return (
      <PartnerOnly>
        <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
            <p className="text-gray-600">Loading your orders...</p>
          </div>
        </div>
      </PartnerOnly>
    );
  }

  if (error) {
    return (
      <PartnerOnly>
        <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Orders</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadOrders}>Try Again</Button>
          </div>
        </div>
      </PartnerOnly>
    );
  }

  return (
    <PartnerOnly>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Your Orders</h1>
            <p className="text-gray-600 mt-2">Track and manage your partner orders</p>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
              <p className="text-gray-600">You haven't placed any orders yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <Card key={order.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="border-b border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-900">
                          Order #{order.order_number}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          Placed on {new Date(order.created_at).toLocaleDateString('en-GB', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge className={`${getStatusColor(order.status)} flex items-center gap-1`}>
                          {getStatusIcon(order.status)}
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </Badge>
                        <Link href={`/partners/orders/${order.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {order.order_items?.map((item) => (
                        <div key={item.id} className="flex items-start space-x-4">
                          <div className="flex-shrink-0 cursor-pointer" onClick={() => item.image_url && handleImageClick(item.image_url, item.image_title)}>
                            {item.image_url ? (
                              <Image
                                src={item.image_url}
                                alt={item.image_title}
                                width={80}
                                height={80}
                                className="rounded-lg object-cover hover:opacity-80 transition-opacity"
                              />
                            ) : (
                              <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                                <Package className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900">{item.image_title}</h3>
                            <p className="text-sm font-medium text-green-700">{getProductDescription(item.product_id)}</p>
                            <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                            <Badge className={getOrderTypeBadge(order.order_type)} >
                              {getOrderTypeLabel(order.order_type)}
                            </Badge>
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
                                  
                                  {/* Partner discount per item */}
                                  {pricing.hasDiscount && (
                                    <div className="text-sm flex justify-between">
                                      <span className="text-gray-500">Partner Discount ({pricing.discountPercentage}%)</span>
                                      <span className="text-green-600 font-medium">
                                        -{pricing.discountPerUnitFormatted}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* Discounted price per item */}
                                  <div className="text-sm flex justify-between">
                                    <span className="text-gray-500">Partner Price × {pricing.quantity}</span>
                                    <span className="font-semibold text-green-600">
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
                      ))}
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      {(() => {
                        const orderPricing = getOrderPricing(order);
                        return (
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>Subtotal (Partner Prices): {orderPricing.subtotal}</p>
                              <p>Shipping: {orderPricing.shipping}</p>
                              {orderPricing.hasOrderDiscount && (
                                <p className="text-green-600 font-medium">
                                  Partner Discount: {orderPricing.totalDiscountFormatted}
                                  <span className="text-xs text-gray-500 block">*Applied to items only</span>
                                </p>
                              )}
                              {order.estimated_delivery && (
                                <p>Est. Delivery: {new Date(order.estimated_delivery).toLocaleDateString('en-GB')}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-gray-900">
                                {orderPricing.total}
                              </p>
                              <p className="text-sm text-green-600 font-medium">Partner Pricing Applied</p>
                              {orderPricing.hasOrderDiscount && (
                                <p className="text-xs text-gray-500 mt-1">
                                  You saved {orderPricing.totalDiscountFormatted} on items
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        {/* Image Modal */}
        <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedImageTitle}</DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-4 top-4"
                onClick={() => setShowImageModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogHeader>
            {selectedImageUrl && (
              <div className="mt-4">
                <Image
                  src={selectedImageUrl}
                  alt={selectedImageTitle}
                  width={800}
                  height={600}
                  className="rounded-lg object-contain mx-auto"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PartnerOnly>
  );
}