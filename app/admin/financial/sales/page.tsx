'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package } from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';

interface SalesData {
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  unique_customers: number;
  top_products: Array<{
    product_name: string;
    quantity_sold: number;
    revenue: number;
  }>;
  sales_by_period: Array<{
    period: string;
    orders: number;
    revenue: number;
  }>;
  partner_sales: Array<{
    partner_name: string;
    orders: number;
    revenue: number;
    commission: number;
  }>;
}

type TimePeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export default function SalesAnalyticsPage() {
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [previousData, setPreviousData] = useState<SalesData | null>(null);

  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadSalesData();
  }, [timePeriod]);

  const getDateRange = (period: TimePeriod) => {
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        return { start: null, end: null };
    }
    
    return { start: startDate.toISOString(), end: now.toISOString() };
  };

  const loadSalesData = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange(timePeriod);
      
      console.log('Loading sales data for period:', timePeriod, { start, end });

      // Load orders using the admin API like the orders page does
      const ordersResponse = await fetch('/api/admin/orders');
      if (!ordersResponse.ok) {
        throw new Error('Failed to fetch orders');
      }
      const allOrders = await ordersResponse.json();
      
      // Filter orders by date and status (include all revenue-generating statuses)
      let orders = allOrders.filter((order: any) => 
        ['confirmed', 'processing', 'shipped', 'delivered', 'completed'].includes(order.status)
      );
      
      if (start && end) {
        orders = orders.filter((order: any) => {
          const orderDate = new Date(order.created_at);
          return orderDate >= new Date(start) && orderDate <= new Date(end);
        });
      }
      
      const ordersError = null;
      
      console.log('Orders loaded:', orders?.length || 0, 'Error:', ordersError);
      
      if (ordersError) {
        console.error('Orders query error:', ordersError);
        throw ordersError;
      }

      // If no orders found, still process empty data
      if (!orders || orders.length === 0) {
        console.log('No orders found for the specified period');
        setSalesData({
          total_orders: 0,
          total_revenue: 0,
          avg_order_value: 0,
          unique_customers: 0,
          top_products: [],
          sales_by_period: [],
          partner_sales: []
        });
        return;
      }

      // Process sales data
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const uniqueCustomers = new Set(orders?.map((order: any) => order.customer_email)).size;

      // Calculate top products (using product_id since we don't have product names)
      const productSales: Record<string, { quantity: number; revenue: number }> = {};
      orders?.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          const productId = item.product_id || 'Unknown Product';
          if (!productSales[productId]) {
            productSales[productId] = { quantity: 0, revenue: 0 };
          }
          productSales[productId].quantity += item.quantity || 0;
          productSales[productId].revenue += (item.quantity || 0) * (item.unit_price || 0);
        });
      });

      const topProducts = Object.entries(productSales)
        .map(([name, data]) => ({
          product_name: name,
          quantity_sold: data.quantity,
          revenue: data.revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Calculate sales by period (daily for this month)
      const salesByPeriod: Array<{ period: string; orders: number; revenue: number }> = [];
      if (orders) {
        const periodMap: Record<string, { orders: number; revenue: number }> = {};
        
        orders.forEach((order: any) => {
          const date = new Date(order.created_at).toISOString().split('T')[0];
          if (!periodMap[date]) {
            periodMap[date] = { orders: 0, revenue: 0 };
          }
          periodMap[date].orders += 1;
          periodMap[date].revenue += order.total_amount || 0;
        });

        Object.entries(periodMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([date, data]) => {
            salesByPeriod.push({
              period: date,
              orders: data.orders,
              revenue: data.revenue
            });
          });
      }

      // Load referrals using the admin API to get properly formatted data
      const referralsResponse = await fetch('/api/admin/referrals');
      if (!referralsResponse.ok) {
        throw new Error('Failed to fetch referrals');
      }
      const referrals = await referralsResponse.json();
      
      // Filter to only referrals with orders
      const referralsWithOrders = referrals.filter((referral: any) => referral.order_id);

      console.log('Referrals loaded:', referralsWithOrders?.length || 0);

      const partnerSales: Record<string, { orders: number; revenue: number; commission: number }> = {};
      
      // Process partner sales from referrals that have orders
      referralsWithOrders?.forEach((referral: any) => {
        if (referral.partner_business && referral.partner_business !== 'N/A') {
          const partnerName = referral.partner_business;
          if (!partnerSales[partnerName]) {
            partnerSales[partnerName] = { orders: 0, revenue: 0, commission: 0 };
          }
          
          partnerSales[partnerName].orders += 1;
          partnerSales[partnerName].revenue += (referral.order_value || 0);
          // commission_amount is already converted to pounds by the API
          partnerSales[partnerName].commission += (referral.commission_amount || 0) * 100; // Convert back to pence for consistent formatting
        }
      });

      const partnerSalesArray = Object.entries(partnerSales)
        .map(([name, data]) => ({
          partner_name: name,
          orders: data.orders,
          revenue: data.revenue,
          commission: data.commission
        }))
        .sort((a, b) => b.revenue - a.revenue);

      console.log('Partner sales calculated:', partnerSalesArray.length, 'partners');

      const finalSalesData = {
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        avg_order_value: avgOrderValue,
        unique_customers: uniqueCustomers,
        top_products: topProducts,
        sales_by_period: salesByPeriod,
        partner_sales: partnerSalesArray
      };

      console.log('Final sales data:', finalSalesData);
      setSalesData(finalSalesData);

    } catch (error) {
      console.error('Error loading sales data:', error);
      // Set empty data structure instead of failing
      setSalesData({
        total_orders: 0,
        total_revenue: 0,
        avg_order_value: 0,
        unique_customers: 0,
        top_products: [],
        sales_by_period: [],
        partner_sales: []
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amountInPence: number) => {
    return `£${(amountInPence / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (!salesData) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-500">No sales data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Analytics</h1>
          <p className="text-gray-600 mt-2">
            Track sales performance and revenue metrics
          </p>
        </div>
        
        <Select value={timePeriod} onValueChange={(value: TimePeriod) => setTimePeriod(value)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
            <SelectItem value="quarter">Last 3 Months</SelectItem>
            <SelectItem value="year">Last Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{salesData.total_orders.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesData.total_revenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesData.avg_order_value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Unique Customers</p>
                <p className="text-2xl font-bold text-gray-900">{salesData.unique_customers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Best selling products by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {salesData.top_products.slice(0, 5).map((product, index) => (
                <div key={product.product_name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.product_name}</p>
                      <p className="text-sm text-gray-500">{product.quantity_sold} sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Partner Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Partner Sales</CardTitle>
            <CardDescription>Revenue generated through partner referrals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {salesData.partner_sales.slice(0, 5).map((partner, index) => (
                <div key={partner.partner_name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-purple-600">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{partner.partner_name}</p>
                      <p className="text-sm text-gray-500">{partner.orders} orders</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatCurrency(partner.revenue)}</p>
                    <p className="text-sm text-gray-500">Comm: {formatCurrency(partner.commission)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Trend</CardTitle>
          <CardDescription>Daily sales performance over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {salesData.sales_by_period.slice(-14).map((period) => (
              <div key={period.period} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{formatDate(period.period)}</span>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{period.orders} orders</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatCurrency(period.revenue)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}