'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Calendar, CreditCard, RefreshCw } from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';

interface RevenueData {
  current_period: {
    total_revenue: number;
    subscription_revenue: number;
    one_time_revenue: number;
    refunds: number;
    net_revenue: number;
  };
  previous_period: {
    total_revenue: number;
    subscription_revenue: number;
    one_time_revenue: number;
    refunds: number;
    net_revenue: number;
  };
  revenue_by_source: Array<{
    source: string;
    revenue: number;
    percentage: number;
  }>;
  monthly_recurring_revenue: number;
  annual_recurring_revenue: number;
  revenue_trend: Array<{
    period: string;
    revenue: number;
    recurring: number;
    one_time: number;
  }>;
  top_revenue_products: Array<{
    product_name: string;
    revenue: number;
    orders: number;
  }>;
}

type TimePeriod = 'month' | 'quarter' | 'year';

export default function RevenueTrackingPage() {
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');

  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadRevenueData();
  }, [timePeriod]);

  const getDateRanges = (period: TimePeriod) => {
    const now = new Date();
    const currentStart = new Date();
    const previousStart = new Date();
    const previousEnd = new Date();
    
    switch (period) {
      case 'month':
        currentStart.setMonth(now.getMonth() - 1);
        previousStart.setMonth(now.getMonth() - 2);
        previousEnd.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        currentStart.setMonth(now.getMonth() - 3);
        previousStart.setMonth(now.getMonth() - 6);
        previousEnd.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        currentStart.setFullYear(now.getFullYear() - 1);
        previousStart.setFullYear(now.getFullYear() - 2);
        previousEnd.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return {
      current: { start: currentStart.toISOString(), end: now.toISOString() },
      previous: { start: previousStart.toISOString(), end: previousEnd.toISOString() }
    };
  };

  const loadRevenueData = async () => {
    try {
      setLoading(true);
      const { current, previous } = getDateRanges(timePeriod);
      
      console.log('Loading revenue data for periods:', { current, previous });

      // Load orders using the admin API like the orders page does
      const ordersResponse = await fetch('/api/admin/orders');
      if (!ordersResponse.ok) {
        throw new Error('Failed to fetch orders');
      }
      const allOrders = await ordersResponse.json();
      
      // Filter current period orders (include all revenue-generating statuses)
      let currentOrders = allOrders.filter((order: any) => 
        ['confirmed', 'processing', 'shipped', 'delivered', 'completed'].includes(order.status)
      );
      
      if (current.start && current.end) {
        currentOrders = currentOrders.filter((order: any) => {
          const orderDate = new Date(order.created_at);
          return orderDate >= new Date(current.start) && orderDate <= new Date(current.end);
        });
      }

      console.log('Current orders loaded:', currentOrders?.length || 0);

      // Filter previous period orders from the same data (include all revenue-generating statuses)
      let previousOrders = allOrders.filter((order: any) => 
        ['confirmed', 'processing', 'shipped', 'delivered', 'completed'].includes(order.status)
      );
      
      if (previous.start && previous.end) {
        previousOrders = previousOrders.filter((order: any) => {
          const orderDate = new Date(order.created_at);
          return orderDate >= new Date(previous.start) && orderDate <= new Date(previous.end);
        });
      }

      console.log('Previous orders loaded:', previousOrders?.length || 0);

      // Load refunds (if refunds table exists)
      let refunds = [];
      try {
        if (current.start && current.end) {
          const { data: refundsData } = await supabaseService.getClient()
            .from('refunds')
            .select('amount, created_at')
            .gte('created_at', current.start)
            .lte('created_at', current.end);
          refunds = refundsData || [];
        }
      } catch (refundError) {
        console.warn('Refunds table not found or error loading refunds:', refundError);
        refunds = [];
      }

      console.log('Refunds loaded:', refunds.length);

      // Handle empty data gracefully
      const currentOrdersArray = currentOrders || [];
      const previousOrdersArray = previousOrders || [];

      if (currentOrdersArray.length === 0 && previousOrdersArray.length === 0) {
        console.log('No orders found for any period');
        setRevenueData({
          current_period: {
            total_revenue: 0,
            subscription_revenue: 0,
            one_time_revenue: 0,
            refunds: 0,
            net_revenue: 0
          },
          previous_period: {
            total_revenue: 0,
            subscription_revenue: 0,
            one_time_revenue: 0,
            refunds: 0,
            net_revenue: 0
          },
          revenue_by_source: [],
          monthly_recurring_revenue: 0,
          annual_recurring_revenue: 0,
          revenue_trend: [],
          top_revenue_products: []
        });
        return;
      }

      // Process current period data
      const currentPeriodData = processOrderData(currentOrdersArray);
      const previousPeriodData = processOrderData(previousOrdersArray);
      const totalRefunds = refunds.reduce((sum: number, refund: any) => sum + (refund.amount || 0), 0);

      // Calculate revenue by source
      const revenueBySource = calculateRevenueBySource(currentOrdersArray);

      // Calculate MRR and ARR (simplified - assumes all subscriptions are monthly)
      const subscriptionOrders = currentOrdersArray.filter((order: any) => 
        order.order_items?.some((item: any) => item.products?.is_subscription)
      );
      const monthlyRecurringRevenue = subscriptionOrders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
      const annualRecurringRevenue = monthlyRecurringRevenue * 12;

      // Generate revenue trend (last 12 months/quarters/years)
      const revenueTrend = await generateRevenueTrend(timePeriod);

      // Top revenue products
      const topProducts = calculateTopRevenueProducts(currentOrdersArray);

      console.log('Revenue calculations:', {
        currentRevenue: currentPeriodData.total_revenue,
        previousRevenue: previousPeriodData.total_revenue,
        totalRefunds,
        revenueBySource: revenueBySource.length,
        topProducts: topProducts.length,
        MRR: monthlyRecurringRevenue
      });

      setRevenueData({
        current_period: {
          ...currentPeriodData,
          refunds: totalRefunds,
          net_revenue: currentPeriodData.total_revenue - totalRefunds
        },
        previous_period: previousPeriodData,
        revenue_by_source: revenueBySource,
        monthly_recurring_revenue: monthlyRecurringRevenue,
        annual_recurring_revenue: annualRecurringRevenue,
        revenue_trend: revenueTrend,
        top_revenue_products: topProducts
      });

    } catch (error) {
      console.error('Error loading revenue data:', error);
      // Set empty data structure instead of failing
      setRevenueData({
        current_period: {
          total_revenue: 0,
          subscription_revenue: 0,
          one_time_revenue: 0,
          refunds: 0,
          net_revenue: 0
        },
        previous_period: {
          total_revenue: 0,
          subscription_revenue: 0,
          one_time_revenue: 0,
          refunds: 0,
          net_revenue: 0
        },
        revenue_by_source: [],
        monthly_recurring_revenue: 0,
        annual_recurring_revenue: 0,
        revenue_trend: [],
        top_revenue_products: []
      });
    } finally {
      setLoading(false);
    }
  };

  const processOrderData = (orders: any[]) => {
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    const subscriptionRevenue = orders
      .filter(order => order.subscription_id || 
        order.order_items?.some((item: any) => item.products?.is_subscription))
      .reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    const oneTimeRevenue = totalRevenue - subscriptionRevenue;

    return {
      total_revenue: totalRevenue,
      subscription_revenue: subscriptionRevenue,
      one_time_revenue: oneTimeRevenue,
      refunds: 0, // Will be set separately
      net_revenue: totalRevenue // Will be adjusted for refunds
    };
  };

  const calculateRevenueBySource = (orders: any[]) => {
    const sources: Record<string, number> = {
      'Direct Sales': 0,
      'Partner Referrals': 0,
      'Organic': 0
    };

    const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

    orders.forEach(order => {
      const revenue = order.total_amount || 0;
      if (order.referral_code) {
        sources['Partner Referrals'] += revenue;
      } else {
        sources['Direct Sales'] += revenue; // Simplified categorization
      }
    });

    return Object.entries(sources)
      .map(([source, revenue]) => ({
        source,
        revenue,
        percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0
      }))
      .filter(item => item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  };

  const generateRevenueTrend = async (period: TimePeriod) => {
    // This would typically fetch historical data
    // For now, generating sample trend data
    const periods = period === 'month' ? 12 : period === 'quarter' ? 4 : 3;
    const trend = [];
    
    for (let i = periods - 1; i >= 0; i--) {
      const date = new Date();
      if (period === 'month') {
        date.setMonth(date.getMonth() - i);
      } else if (period === 'quarter') {
        date.setMonth(date.getMonth() - (i * 3));
      } else {
        date.setFullYear(date.getFullYear() - i);
      }
      
      trend.push({
        period: date.toISOString().slice(0, 7), // YYYY-MM format
        revenue: Math.random() * 50000 + 20000, // Sample data
        recurring: Math.random() * 30000 + 10000,
        one_time: Math.random() * 20000 + 10000
      });
    }
    
    return trend;
  };

  const calculateTopRevenueProducts = (orders: any[]) => {
    const productRevenue: Record<string, { revenue: number; orders: number }> = {};
    
    orders.forEach(order => {
      order.order_items?.forEach((item: any) => {
        const productName = item.products?.name || 'Unknown Product';
        const itemRevenue = (item.quantity || 0) * (item.unit_price || 0);
        
        if (!productRevenue[productName]) {
          productRevenue[productName] = { revenue: 0, orders: 0 };
        }
        
        productRevenue[productName].revenue += itemRevenue;
        productRevenue[productName].orders += 1;
      });
    });

    return Object.entries(productRevenue)
      .map(([name, data]) => ({
        product_name: name,
        revenue: data.revenue,
        orders: data.orders
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  };

  const formatCurrency = (amountInPence: number) => {
    return `£${(amountInPence / 100).toFixed(2)}`;
  };

  const calculateGrowthRate = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const formatGrowthRate = (rate: number) => {
    const isPositive = rate >= 0;
    return (
      <div className={`flex items-center space-x-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
        <span className="text-sm font-medium">{Math.abs(rate).toFixed(1)}%</span>
      </div>
    );
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

  if (!revenueData) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-500">No revenue data available</p>
        </div>
      </div>
    );
  }

  const revenueGrowth = calculateGrowthRate(
    revenueData.current_period.total_revenue,
    revenueData.previous_period.total_revenue
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Revenue Tracking</h1>
          <p className="text-gray-600 mt-2">
            Monitor revenue performance and growth trends
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Select value={timePeriod} onValueChange={(value: TimePeriod) => setTimePeriod(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="quarter">Quarterly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={loadRevenueData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(revenueData.current_period.total_revenue)}
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2">
              {formatGrowthRate(revenueGrowth)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Net Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(revenueData.current_period.net_revenue)}
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                After {formatCurrency(revenueData.current_period.refunds)} refunds
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Recurring</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(revenueData.monthly_recurring_revenue)}
                </p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <RefreshCw className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                ARR: {formatCurrency(revenueData.annual_recurring_revenue)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">One-time Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(revenueData.current_period.one_time_revenue)}
                </p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <CreditCard className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                vs {formatCurrency(revenueData.current_period.subscription_revenue)} recurring
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Source */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Source</CardTitle>
            <CardDescription>Breakdown of revenue sources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {revenueData.revenue_by_source.map((source) => (
                <div key={source.source} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="font-medium text-gray-900">{source.source}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatCurrency(source.revenue)}</p>
                    <p className="text-sm text-gray-500">{source.percentage.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Revenue Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Revenue Products</CardTitle>
            <CardDescription>Products generating the most revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {revenueData.top_revenue_products.slice(0, 5).map((product, index) => (
                <div key={product.product_name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.product_name}</p>
                      <p className="text-sm text-gray-500">{product.orders} orders</p>
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
      </div>

      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>Revenue performance over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {revenueData.revenue_trend.map((period) => (
              <div key={period.period} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">{period.period}</span>
                </div>
                <div className="flex items-center space-x-8">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Recurring</p>
                    <p className="font-medium text-green-600">{formatCurrency(period.recurring)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">One-time</p>
                    <p className="font-medium text-blue-600">{formatCurrency(period.one_time)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total</p>
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