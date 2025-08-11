'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, DollarSign, TrendingUp, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';

interface Commission {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_email: string;
  order_id: string;
  order_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'disputed';
  created_at: string;
  paid_at?: string;
  referral_code: string;
  customer_name?: string;
}

interface CommissionSummary {
  total_commissions: number;
  pending_amount: number;
  approved_amount: number;
  paid_amount: number;
  disputed_amount: number;
  total_partners: number;
  avg_commission_rate: number;
  top_earners: Array<{
    partner_name: string;
    total_earned: number;
    orders_count: number;
    avg_rate: number;
  }>;
  monthly_trend: Array<{
    month: string;
    commissions: number;
    paid: number;
  }>;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'paid' | 'disputed';
type TimePeriod = 'month' | 'quarter' | 'year' | 'all';

export default function CommissionTrackingPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [filteredCommissions, setFilteredCommissions] = useState<Commission[]>([]);
  const [commissionSummary, setCommissionSummary] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [searchTerm, setSearchTerm] = useState('');

  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadCommissionData();
  }, [timePeriod]);

  useEffect(() => {
    filterCommissions();
  }, [commissions, statusFilter, searchTerm]);

  const loadCommissionData = async () => {
    try {
      setLoading(true);
      
      // Get date range
      const { start, end } = getDateRange(timePeriod);
      
      console.log('Loading commission data for period:', timePeriod, { start, end });
      
      // Load referrals using the admin API to get properly formatted data
      const referralsResponse = await fetch('/api/admin/referrals');
      if (!referralsResponse.ok) {
        throw new Error('Failed to fetch referrals');
      }
      const allReferrals = await referralsResponse.json();
      
      // Filter to only referrals with orders and apply date filter
      let referralsWithOrders = allReferrals.filter((referral: any) => referral.order_id);
      
      if (start && end) {
        referralsWithOrders = referralsWithOrders.filter((referral: any) => {
          const purchaseDate = referral.purchased_at ? new Date(referral.purchased_at) : new Date(referral.created_at);
          return purchaseDate >= new Date(start) && purchaseDate <= new Date(end);
        });
      }
      
      const referralsError = null;
      
      console.log('Referrals with orders loaded:', referralsWithOrders?.length || 0, 'Error:', referralsError);
      
      if (referralsError) {
        console.error('Referrals query error:', referralsError);
        throw referralsError;
      }

      // Load existing commission records (if table exists)
      let existingCommissions = [];
      try {
        const { data: commissionsData } = await supabaseService.getClient()
          .from('commissions')
          .select('*');
        existingCommissions = commissionsData || [];
      } catch (commissionsError) {
        console.warn('Commissions table not found, using calculated commissions:', commissionsError);
      }

      console.log('Existing commissions loaded:', existingCommissions.length);

      // Handle empty data case
      if (!referralsWithOrders || referralsWithOrders.length === 0) {
        console.log('No referrals with orders found');
        setCommissions([]);
        setCommissionSummary({
          total_commissions: 0,
          pending_amount: 0,
          approved_amount: 0,
          paid_amount: 0,
          disputed_amount: 0,
          total_partners: 0,
          avg_commission_rate: 0,
          top_earners: [],
          monthly_trend: []
        });
        return;
      }

      // Process commission data from referrals
      const processedCommissions: Commission[] = [];
      
      referralsWithOrders.forEach((referral: any) => {
        if (referral.partner_business && referral.partner_business !== 'N/A') {
          const commissionRate = referral.commission_rate || 0.1; // Default 10%
          // commission_amount from API is already in pounds, convert to pence for consistent formatting
          const commissionAmount = referral.commission_amount ? (referral.commission_amount * 100) : ((referral.order_value || 0) * commissionRate);
          
          // Check if commission already exists
          const existingCommission = existingCommissions.find((c: any) => c.order_id === referral.order_id);
          
          processedCommissions.push({
            id: existingCommission?.id || `${referral.order_id}-${referral.id}`,
            partner_id: referral.id,
            partner_name: referral.partner_business,
            partner_email: referral.partner_email,
            order_id: referral.order_id,
            order_amount: referral.order_value || 0,
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
            status: referral.commission_paid ? 'paid' : (existingCommission?.status || 'pending'),
            created_at: referral.created_at,
            paid_at: referral.commission_paid ? referral.purchased_at : existingCommission?.paid_at,
            referral_code: referral.id,
            customer_name: referral.client_email
          });
        } else {
          console.warn('No partner found for referral:', referral.id);
        }
      });

      console.log('Processed commissions:', processedCommissions.length);

      setCommissions(processedCommissions);
      setCommissionSummary(calculateCommissionSummary(processedCommissions));

    } catch (error) {
      console.error('Error loading commission data:', error);
      // Set empty data structure instead of using sample data
      setCommissions([]);
      setCommissionSummary({
        total_commissions: 0,
        pending_amount: 0,
        approved_amount: 0,
        paid_amount: 0,
        disputed_amount: 0,
        total_partners: 0,
        avg_commission_rate: 0,
        top_earners: [],
        monthly_trend: []
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSampleCommissions = (): Commission[] => {
    return [
      {
        id: '1',
        partner_id: 'partner-1',
        partner_name: 'Happy Paws Grooming',
        partner_email: 'contact@happypaws.com',
        order_id: 'order-1',
        order_amount: 149.99,
        commission_rate: 0.15,
        commission_amount: 22.50,
        status: 'paid',
        created_at: '2024-01-15T10:00:00Z',
        paid_at: '2024-01-30T10:00:00Z',
        referral_code: 'HAPPY2024',
        customer_name: 'John Smith'
      },
      {
        id: '2',
        partner_id: 'partner-2',
        partner_name: 'Pawsome Veterinary',
        partner_email: 'admin@pawsomevet.com',
        order_id: 'order-2',
        order_amount: 89.99,
        commission_rate: 0.12,
        commission_amount: 10.80,
        status: 'approved',
        created_at: '2024-01-20T14:30:00Z',
        referral_code: 'PAWSOME2024',
        customer_name: 'Sarah Johnson'
      },
      {
        id: '3',
        partner_id: 'partner-1',
        partner_name: 'Happy Paws Grooming',
        partner_email: 'contact@happypaws.com',
        order_id: 'order-3',
        order_amount: 199.99,
        commission_rate: 0.15,
        commission_amount: 30.00,
        status: 'pending',
        created_at: '2024-01-25T09:15:00Z',
        referral_code: 'HAPPY2024',
        customer_name: 'Mike Davis'
      }
    ];
  };

  const getDateRange = (period: TimePeriod) => {
    if (period === 'all') return { start: null, end: null };
    
    const now = new Date();
    const start = new Date();
    
    switch (period) {
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return { start: start.toISOString(), end: now.toISOString() };
  };

  const calculateCommissionSummary = (commissionsData: Commission[]): CommissionSummary => {
    const totalCommissions = commissionsData.reduce((sum, c) => sum + c.commission_amount, 0);
    const pendingAmount = commissionsData.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commission_amount, 0);
    const approvedAmount = commissionsData.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.commission_amount, 0);
    const paidAmount = commissionsData.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0);
    const disputedAmount = commissionsData.filter(c => c.status === 'disputed').reduce((sum, c) => sum + c.commission_amount, 0);

    const uniquePartners = new Set(commissionsData.map(c => c.partner_id)).size;
    const avgCommissionRate = commissionsData.length > 0 ? 
      commissionsData.reduce((sum, c) => sum + c.commission_rate, 0) / commissionsData.length : 0;

    // Top earners
    const partnerEarnings: Record<string, { earned: number; orders: number; rates: number[] }> = {};
    commissionsData.forEach(c => {
      if (!partnerEarnings[c.partner_id]) {
        partnerEarnings[c.partner_id] = { earned: 0, orders: 0, rates: [] };
      }
      partnerEarnings[c.partner_id].earned += c.commission_amount;
      partnerEarnings[c.partner_id].orders += 1;
      partnerEarnings[c.partner_id].rates.push(c.commission_rate);
    });

    const topEarners = Object.entries(partnerEarnings)
      .map(([partnerId, data]) => {
        const commission = commissionsData.find(c => c.partner_id === partnerId);
        return {
          partner_name: commission?.partner_name || 'Unknown',
          total_earned: data.earned,
          orders_count: data.orders,
          avg_rate: data.rates.reduce((sum, rate) => sum + rate, 0) / data.rates.length
        };
      })
      .sort((a, b) => b.total_earned - a.total_earned);

    // Monthly trend (sample data)
    const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      const monthCommissions = commissionsData.filter(c => {
        const commissionDate = new Date(c.created_at);
        return commissionDate.getMonth() === date.getMonth() && 
               commissionDate.getFullYear() === date.getFullYear();
      });
      
      return {
        month: date.toISOString().slice(0, 7),
        commissions: monthCommissions.reduce((sum, c) => sum + c.commission_amount, 0),
        paid: monthCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0)
      };
    });

    return {
      total_commissions: totalCommissions,
      pending_amount: pendingAmount,
      approved_amount: approvedAmount,
      paid_amount: paidAmount,
      disputed_amount: disputedAmount,
      total_partners: uniquePartners,
      avg_commission_rate: avgCommissionRate,
      top_earners: topEarners,
      monthly_trend: monthlyTrend
    };
  };

  const filterCommissions = () => {
    let filtered = [...commissions];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.partner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.referral_code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredCommissions(filtered);
  };

  const updateCommissionStatus = async (commissionId: string, newStatus: Commission['status']) => {
    try {
      const updatedCommissions = commissions.map(c => 
        c.id === commissionId 
          ? { ...c, status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : c.paid_at }
          : c
      );
      
      setCommissions(updatedCommissions);
      setCommissionSummary(calculateCommissionSummary(updatedCommissions));
      
      // In a real application, you would update the database here
      
    } catch (error) {
      console.error('Error updating commission status:', error);
    }
  };

  const formatCurrency = (amountInPence: number) => {
    return `£${(amountInPence / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: Commission['status']) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      disputed: { color: 'bg-red-100 text-red-800', icon: AlertCircle }
    };

    const config = statusConfig[status];
    const IconComponent = config.icon;

    return (
      <Badge className={config.color}>
        <IconComponent className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Commission Tracking</h1>
          <p className="text-gray-600 mt-2">
            Monitor partner commissions and payouts
          </p>
        </div>
        
        <Button onClick={loadCommissionData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {commissionSummary && (
        <>
          {/* Commission Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Commissions</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(commissionSummary.total_commissions)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(commissionSummary.pending_amount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Paid Out</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(commissionSummary.paid_amount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Active Partners</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {commissionSummary.total_partners}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <Input
                    placeholder="Partner, customer, or code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="disputed">Disputed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Period</label>
                  <Select value={timePeriod} onValueChange={(value: TimePeriod) => setTimePeriod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Last Month</SelectItem>
                      <SelectItem value="quarter">Last Quarter</SelectItem>
                      <SelectItem value="year">Last Year</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Results</label>
                  <div className="text-sm text-gray-600 py-2">
                    {filteredCommissions.length} commission{filteredCommissions.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Commission List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Commission Details</CardTitle>
                  <CardDescription>Individual commission records and payouts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredCommissions.map((commission) => (
                      <div key={commission.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <span className="font-medium text-gray-900">{commission.partner_name}</span>
                              {getStatusBadge(commission.status)}
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>Customer: {commission.customer_name || 'Unknown'}</p>
                              <p>Code: {commission.referral_code}</p>
                              <p>Order: {formatCurrency(commission.order_amount)} × {(commission.commission_rate * 100).toFixed(1)}%</p>
                              <p>Date: {formatDate(commission.created_at)}</p>
                            </div>
                          </div>
                          
                          <div className="text-right space-y-2">
                            <p className="text-xl font-bold text-gray-900">
                              {formatCurrency(commission.commission_amount)}
                            </p>
                            <div className="flex space-x-2">
                              {commission.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateCommissionStatus(commission.id, 'approved')}
                                >
                                  Approve
                                </Button>
                              )}
                              {commission.status === 'approved' && (
                                <Button
                                  size="sm"
                                  onClick={() => updateCommissionStatus(commission.id, 'paid')}
                                >
                                  Mark Paid
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {filteredCommissions.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No commissions match your current filters</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Earners */}
            <Card>
              <CardHeader>
                <CardTitle>Top Earners</CardTitle>
                <CardDescription>Partners with highest commission earnings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {commissionSummary.top_earners.slice(0, 5).map((earner, index) => (
                    <div key={earner.partner_name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-medium text-purple-600">#{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{earner.partner_name}</p>
                          <p className="text-sm text-gray-500">
                            {earner.orders_count} orders • {(earner.avg_rate * 100).toFixed(1)}% avg
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(earner.total_earned)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}