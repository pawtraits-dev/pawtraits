'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, DollarSign, TrendingUp, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

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
  commission_type: string;
  recipient_type: string;
  orders?: {
    customer_email?: string;
  };
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
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);
  const [processingPayment, setProcessingPayment] = useState(false);


  useEffect(() => {
    loadCommissionData();
  }, [timePeriod]);

  useEffect(() => {
    filterCommissions();
  }, [commissions, statusFilter, searchTerm]);

  const loadCommissionData = async () => {
    try {
      setLoading(true);
      
      console.log('🔄 Client: Loading commission data from /api/admin/commissions...');
      
      // Load commission data from client_orders table (the actual commission records)
      const commissionsResponse = await fetch('/api/admin/commissions');
      console.log('📡 Client: API response status:', commissionsResponse.status, commissionsResponse.statusText);
      
      if (!commissionsResponse.ok) {
        const errorText = await commissionsResponse.text();
        console.error('❌ Client: API Error:', errorText);
        throw new Error('Failed to fetch commission data');
      }
      
      const commissionsData = await commissionsResponse.json();
      console.log('📥 Client: Commission data loaded:', commissionsData.length, 'records');
      console.log('📋 Client: Sample commission data:', commissionsData[0] || 'No data');
      
      // Apply date filter if needed
      let filteredCommissions = commissionsData;
      const { start, end } = getDateRange(timePeriod);
      
      if (start && end) {
        filteredCommissions = commissionsData.filter((commission: any) => {
          const commissionDate = new Date(commission.created_at);
          return commissionDate >= new Date(start) && commissionDate <= new Date(end);
        });
      }

      // Process commission data into the format expected by the UI
      const processedCommissions: Commission[] = filteredCommissions.map((commission: any) => ({
        id: commission.id,
        partner_id: commission.partner_id,
        partner_name: commission.partner_name || 'Unknown Partner',
        partner_email: commission.partner_email || '',
        order_id: commission.order_id,
        order_amount: commission.order_amount || 0,
        commission_rate: commission.commission_rate / 100, // Convert percentage to decimal
        commission_amount: commission.commission_amount, // Already in pennies from database
        status: commission.commission_paid ? 'paid' : 'pending',
        created_at: commission.created_at,
        paid_at: commission.commission_paid ? commission.updated_at : undefined,
        referral_code: commission.referral_code || commission.order_id,
        customer_name: commission.client_name || commission.client_email
      }));

      console.log('🔄 Client: Processed commissions:', processedCommissions.length);
      console.log('📋 Client: Sample processed commission:', processedCommissions[0] || 'No processed data');

      setCommissions(processedCommissions);
      const summary = calculateCommissionSummary(processedCommissions);
      console.log('📊 Client: Commission summary:', summary);
      setCommissionSummary(summary);

    } catch (error) {
      console.error('Error loading commission data:', error);
      // Set empty data structure
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

  // Group commissions by partner, then by order
  const groupedCommissions = () => {
    const groups: Record<string, Record<string, Commission[]>> = {};

    filteredCommissions.forEach(commission => {
      const partnerId = commission.partner_id;
      const orderId = commission.order_id;

      if (!groups[partnerId]) {
        groups[partnerId] = {};
      }
      if (!groups[partnerId][orderId]) {
        groups[partnerId][orderId] = [];
      }
      groups[partnerId][orderId].push(commission);
    });

    return groups;
  };

  const updateCommissionStatus = async (commissionId: string, newStatus: Commission['status']) => {
    try {
      if (newStatus === 'paid') {
        // Call the API to mark as paid
        const response = await fetch('/api/admin/commissions', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            commissionIds: [commissionId],
            action: 'markPaid'
          })
        });

        if (!response.ok) {
          throw new Error('Failed to update commission status');
        }
      }

      // Update local state
      const updatedCommissions = commissions.map(c => 
        c.id === commissionId 
          ? { ...c, status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : c.paid_at }
          : c
      );
      
      setCommissions(updatedCommissions);
      setCommissionSummary(calculateCommissionSummary(updatedCommissions));
      
    } catch (error) {
      console.error('Error updating commission status:', error);
      // Reload data to ensure consistency
      loadCommissionData();
    }
  };

  const markSelectedAsPaid = async () => {
    if (selectedCommissions.length === 0) return;

    try {
      setProcessingPayment(true);
      
      const response = await fetch('/api/admin/commissions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commissionIds: selectedCommissions,
          action: 'markPaid'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to mark commissions as paid');
      }

      // Reload data and clear selection
      await loadCommissionData();
      setSelectedCommissions([]);
      
    } catch (error) {
      console.error('Error marking commissions as paid:', error);
    } finally {
      setProcessingPayment(false);
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
        
        <div className="flex space-x-3">
          {selectedCommissions.length > 0 && (
            <Button 
              onClick={markSelectedAsPaid}
              disabled={processingPayment}
              className="bg-green-600 hover:bg-green-700"
            >
              {processingPayment ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Mark {selectedCommissions.length} as Paid
            </Button>
          )}
          <Button onClick={loadCommissionData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Commission Details</CardTitle>
                      <CardDescription>Individual commission records and payouts</CardDescription>
                    </div>
                    {filteredCommissions.some(c => c.status === 'pending') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const pendingCommissions = filteredCommissions
                            .filter(c => c.status === 'pending')
                            .map(c => c.id);
                          setSelectedCommissions(pendingCommissions);
                        }}
                      >
                        Select All Pending
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(groupedCommissions()).map(([partnerId, partnerOrders]) => {
                      const firstCommission = Object.values(partnerOrders)[0][0];
                      const partnerTotalCommissions = Object.values(partnerOrders).flat().reduce((sum, c) => sum + c.commission_amount, 0);

                      return (
                        <div key={partnerId} className="border border-gray-200 rounded-lg bg-white">
                          {/* Partner Header */}
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-medium text-gray-900">{firstCommission.partner_name}</h3>
                                <p className="text-sm text-gray-600">{Object.keys(partnerOrders).length} order{Object.keys(partnerOrders).length !== 1 ? 's' : ''}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">{formatCurrency(partnerTotalCommissions)}</p>
                                <p className="text-sm text-gray-600">Total commissions</p>
                              </div>
                            </div>
                          </div>

                          {/* Orders for this Partner */}
                          <div className="divide-y divide-gray-100">
                            {Object.entries(partnerOrders).map(([orderId, orderCommissions]) => {
                              const firstOrderCommission = orderCommissions[0];
                              const orderTotal = orderCommissions.reduce((sum, c) => sum + c.commission_amount, 0);
                              const customerName = firstOrderCommission.customer_name || 'Unknown Customer';


                              return (
                                <div key={orderId} className="p-4">
                                  {/* Order Header */}
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <a
                                          href={`/admin/orders/${orderId}`}
                                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                        >
                                          Order #{orderId}
                                        </a>
                                        <span className="text-sm text-gray-500">•</span>
                                        <span className="text-sm text-gray-600">{customerName}</span>
                                      </div>
                                      <p className="text-sm text-gray-500 mt-1">
                                        {formatDate(firstOrderCommission.created_at)} • Order Value: {formatCurrency(firstOrderCommission.order_amount)}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-gray-900">{formatCurrency(orderTotal)}</p>
                                      <p className="text-sm text-gray-500">{orderCommissions.length} commission{orderCommissions.length !== 1 ? 's' : ''}</p>
                                    </div>
                                  </div>

                                  {/* Individual Commissions for this Order */}
                                  <div className="space-y-2 ml-4 border-l-2 border-gray-100 pl-4">
                                    {orderCommissions.map((commission) => (
                                      <div key={commission.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-b-0">
                                        <div className="flex items-center space-x-3">
                                          {commission.status === 'pending' && (
                                            <input
                                              type="checkbox"
                                              checked={selectedCommissions.includes(commission.id)}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setSelectedCommissions([...selectedCommissions, commission.id]);
                                                } else {
                                                  setSelectedCommissions(selectedCommissions.filter(id => id !== commission.id));
                                                }
                                              }}
                                              className="rounded"
                                            />
                                          )}
                                          <div>
                                            <div className="flex items-center space-x-2">
                                              <span className="text-sm font-medium text-gray-700">
                                                {commission.commission_type}
                                              </span>
                                              {getStatusBadge(commission.status)}
                                            </div>
                                            <p className="text-xs text-gray-500">
                                              {(commission.commission_rate * 100).toFixed(1)}% rate
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex items-center space-x-3">
                                          <span className="font-semibold text-gray-900">{formatCurrency(commission.commission_amount)}</span>
                                          <div className="flex space-x-1">
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
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    
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