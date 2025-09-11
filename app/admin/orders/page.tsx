'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Package, 
  Clock, 
  Truck, 
  CheckCircle, 
  Eye, 
  Filter,
  Download,
  Calendar,
  User,
  Mail,
  Loader2,
  X
} from 'lucide-react';
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
  // Partner-client order fields
  order_type?: string;
  placed_by_partner_id?: string;
  client_email?: string;
  client_name?: string;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [productDetails, setProductDetails] = useState<{[key: string]: any}>({});

  useEffect(() => {
    loadAllOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchEmail, statusFilter, dateFilter, orderTypeFilter]);

  const loadAllOrders = async () => {
    setLoading(true);
    try {
      // Load all orders by getting unique emails first, then loading all orders
      // For now, we'll use a different approach - load by empty email to get all
      const response = await fetch('/api/admin/orders');
      if (response.ok) {
        const orderData = await response.json();
        setOrders(orderData);
        
        // Load product details for all order items
        if (orderData && orderData.length > 0) {
          const productDetailsMap = await productDescriptionService.loadProductDetails(orderData);
          setProductDetails(productDetailsMap);
        }
      } else {
        console.error('Failed to load orders');
        setOrders([]);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const getProductDescription = (productId: string) => {
    return productDescriptionService.getProductDescription(productId, productDetails);
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

  const filterOrders = () => {
    let filtered = [...orders];

    // Email filter
    if (searchEmail.trim()) {
      const emailQuery = searchEmail.toLowerCase();
      filtered = filtered.filter(order => 
        order.customer_email.toLowerCase().includes(emailQuery) ||
        order.shipping_first_name.toLowerCase().includes(emailQuery) ||
        order.shipping_last_name.toLowerCase().includes(emailQuery) ||
        order.order_number.toLowerCase().includes(emailQuery)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      if (dateFilter !== 'all') {
        filtered = filtered.filter(order => 
          new Date(order.created_at) >= filterDate
        );
      }
    }

    // Order type filter
    if (orderTypeFilter !== 'all') {
      filtered = filtered.filter(order => {
        const orderType = order.order_type || 'customer'; // Default to customer for legacy orders
        return orderType === orderTypeFilter;
      });
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setFilteredOrders(filtered);
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'processing':
        return <Package className="w-4 h-4 text-blue-600" />;
      case 'printing':
        return <Package className="w-4 h-4 text-orange-600" />;
      case 'printed':
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'shipped':
        return <Truck className="w-4 h-4 text-purple-600" />;
      case 'in_transit':
        return <Truck className="w-4 h-4 text-purple-600" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'fulfillment_error':
        return <X className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
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

  const getOrderTypeLabel = (orderType?: string) => {
    switch (orderType) {
      case 'customer':
        return 'Direct Customer';
      case 'partner':
        return 'Partner Order';
      case 'partner_for_client':
        return 'Partner for Client';
      default:
        return 'Direct Customer'; // Legacy orders
    }
  };

  const getOrderTypeBadge = (orderType?: string) => {
    const variants: Record<string, string> = {
      customer: "bg-blue-100 text-blue-800",
      partner: "bg-green-100 text-green-800", 
      partner_for_client: "bg-purple-100 text-purple-800",
    };
    return variants[orderType || 'customer'] || "bg-blue-100 text-blue-800";
  };

  const clearFilters = () => {
    setSearchEmail('');
    setStatusFilter('all');
    setDateFilter('all');
    setOrderTypeFilter('all');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders Management</h1>
          <p className="text-gray-600 mt-2">
            Manage all customer orders - {filteredOrders.length} of {orders.length} orders shown
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Search & Filter Orders</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by email, name, or order number..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="printing">Printing</SelectItem>
                    <SelectItem value="printed">Printed</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="fulfillment_error">Fulfillment Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date Range</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderType">Order Type</Label>
                <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="customer">Direct Customer</SelectItem>
                    <SelectItem value="partner">Partner Order</SelectItem>
                    <SelectItem value="partner_for_client">Partner for Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end space-x-2">
                {(searchEmail || statusFilter !== 'all' || dateFilter !== 'all' || orderTypeFilter !== 'all') && (
                  <Button variant="outline" onClick={clearFilters} size="sm">
                    <X className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-600 mb-4">
              {orders.length === 0 
                ? 'No orders have been placed yet.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
            {(searchEmail || statusFilter !== 'all' || dateFilter !== 'all') && (
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  {/* Order Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center space-x-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        #{order.order_number}
                      </h3>
                      <Badge className={getStatusBadge(order.status)}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(order.status)}
                          <span className="capitalize">{order.status}</span>
                        </div>
                      </Badge>
                      <Badge className={getOrderTypeBadge(order.order_type)}>
                        {getOrderTypeLabel(order.order_type)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4" />
                          <span>{order.shipping_first_name} {order.shipping_last_name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4" />
                          <span>{order.customer_email}</span>
                        </div>
                        {order.order_type === 'partner_for_client' && order.client_name && (
                          <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                            Client: {order.client_name} ({order.client_email})
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(order.created_at)}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Package className="w-4 h-4" />
                          <span>{order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? 's' : ''}</span>
                        </div>
                        {order.tracking_code && (
                          <div className="flex items-center space-x-2">
                            <Truck className="w-4 h-4" />
                            <span className="text-xs">Tracking: {order.tracking_code}</span>
                          </div>
                        )}
                        {order.gelato_status && order.gelato_status !== order.status && (
                          <div className="text-xs text-gray-500">
                            Gelato: {order.gelato_status}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Order Items Preview */}
                    <div className="space-y-2 max-w-md">
                      {order.order_items && order.order_items.slice(0, 2).map((item) => (
                        <div key={item.id} className="flex items-center space-x-2">
                          <img
                            src={item.image_url}
                            alt={item.image_title}
                            className="w-8 h-8 rounded object-cover border"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{item.image_title}</p>
                            <p className="text-xs text-purple-600 truncate">{getProductDescription(item.product_id)}</p>
                            <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                          </div>
                        </div>
                      ))}
                      {order.order_items && order.order_items.length > 2 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{order.order_items.length - 2} more items
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Total & Actions */}
                  <div className="flex flex-col items-end space-y-3">
                    {(() => {
                      const orderPricing = getOrderPricing(order);
                      return (
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">
                            {orderPricing.total}
                          </p>
                          <div className="text-sm text-gray-500 space-y-1">
                            <div className="flex justify-between gap-4">
                              <span>Subtotal:</span>
                              <span>{orderPricing.subtotal}</span>
                            </div>
                            {order.shipping_amount > 0 && (
                              <div className="flex justify-between gap-4">
                                <span>Shipping:</span>
                                <span>{orderPricing.shipping}</span>
                              </div>
                            )}
                            {orderPricing.hasOrderDiscount && (
                              <div className="flex justify-between gap-4 text-green-600">
                                <span>Discount:</span>
                                <span>-{orderPricing.totalDiscountFormatted}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/admin/orders/${order.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}