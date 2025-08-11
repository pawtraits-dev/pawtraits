'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  Eye, 
  Clock,
  CheckCircle,
  XCircle,
  Users,
  TrendingUp,
  DollarSign,
  Calendar,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface Referral {
  id: string;
  referral_code: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  status: 'pending' | 'viewed' | 'clicked' | 'purchased' | 'expired';
  commission_amount?: number;
  commission_rate: number;
  commission_paid: boolean;
  qr_scans: number;
  email_opens: number;
  expires_at: string;
  created_at: string;
  purchased_at?: string;
  last_viewed_at?: string;
  partner_name: string;
  partner_business: string;
  partner_email: string;
  is_expired: boolean;
  days_until_expiry: number;
}

const statusColors = {
  pending: 'bg-gray-100 text-gray-800',
  viewed: 'bg-blue-100 text-blue-800',
  clicked: 'bg-yellow-100 text-yellow-800',
  purchased: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800'
};

const statusIcons = {
  pending: Clock,
  viewed: Eye,
  clicked: ExternalLink,
  purchased: CheckCircle,
  expired: XCircle
};

export default function AdminReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [filteredReferrals, setFilteredReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadReferrals();
  }, []);

  useEffect(() => {
    filterReferrals();
  }, [referrals, searchTerm, statusFilter]);

  const loadReferrals = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/referrals');
      if (response.ok) {
        const data = await response.json();
        setReferrals(data);
      }
    } catch (error) {
      console.error('Error loading referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterReferrals = () => {
    let filtered = referrals;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(referral => 
        referral.client_name.toLowerCase().includes(term) ||
        referral.client_email.toLowerCase().includes(term) ||
        referral.partner_name.toLowerCase().includes(term) ||
        referral.partner_business.toLowerCase().includes(term) ||
        referral.referral_code.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(referral => referral.status === statusFilter);
    }

    setFilteredReferrals(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    const IconComponent = statusIcons[status as keyof typeof statusIcons];
    return IconComponent ? <IconComponent className="w-4 h-4" /> : <Clock className="w-4 h-4" />;
  };

  const stats = {
    total: referrals.length,
    pending: referrals.filter(r => r.status === 'pending').length,
    purchased: referrals.filter(r => r.status === 'purchased').length,
    expired: referrals.filter(r => r.is_expired).length,
    totalCommissions: referrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0)
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Referral Management</h1>
          <p className="text-gray-600 mt-2">Monitor and manage all partner referrals</p>
        </div>
        <Button onClick={loadReferrals} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Referrals</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.purchased}</p>
                <p className="text-sm text-gray-600">Purchased</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.expired}</p>
                <p className="text-sm text-gray-600">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalCommissions).replace('£', '£')}</p>
                <p className="text-sm text-gray-600">Total Commissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search referrals by client, partner, or referral code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="viewed">Viewed</option>
                <option value="clicked">Clicked</option>
                <option value="purchased">Purchased</option>
                <option value="expired">Expired</option>
              </select>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Showing {filteredReferrals.length} of {referrals.length}
                </span>
                <Button variant="outline" onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }} size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Referrals</CardTitle>
          <CardDescription>All partner referrals and their current status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Referral</th>
                  <th className="text-left p-4 font-medium">Client</th>
                  <th className="text-left p-4 font-medium">Partner</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Commission</th>
                  <th className="text-left p-4 font-medium">Activity</th>
                  <th className="text-left p-4 font-medium">Dates</th>
                </tr>
              </thead>
              <tbody>
                {filteredReferrals.map((referral) => (
                  <tr key={referral.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-gray-900 font-mono text-sm">
                          {referral.referral_code}
                        </div>
                        <div className="text-xs text-gray-500">
                          {referral.days_until_expiry > 0 
                            ? `Expires in ${referral.days_until_expiry} days`
                            : referral.is_expired 
                            ? 'Expired' 
                            : 'Expires today'
                          }
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-gray-900">{referral.client_name}</div>
                        <div className="text-sm text-gray-600">{referral.client_email}</div>
                        {referral.client_phone && (
                          <div className="text-xs text-gray-500">{referral.client_phone}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium text-gray-900">{referral.partner_name}</div>
                        <div className="text-sm text-gray-600">{referral.partner_business}</div>
                        <div className="text-xs text-gray-500">{referral.partner_email}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge className={statusColors[referral.status]}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(referral.status)}
                          <span className="capitalize">{referral.status}</span>
                        </div>
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        {referral.commission_amount ? (
                          <div className="font-medium text-green-600">
                            {formatCurrency(referral.commission_amount)}
                          </div>
                        ) : (
                          <div className="text-gray-500">No commission</div>
                        )}
                        <div className="text-xs text-gray-500">
                          {referral.commission_rate}% rate
                        </div>
                        {referral.commission_paid && (
                          <Badge className="bg-green-100 text-green-800 text-xs mt-1">
                            Paid
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div>{referral.qr_scans} QR scans</div>
                        <div>{referral.email_opens} email opens</div>
                        {referral.last_viewed_at && (
                          <div className="text-xs text-gray-500">
                            Last viewed: {formatDate(referral.last_viewed_at)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="text-gray-600">
                          Created: {formatDate(referral.created_at)}
                        </div>
                        <div className="text-gray-600">
                          Expires: {formatDate(referral.expires_at)}
                        </div>
                        {referral.purchased_at && (
                          <div className="text-green-600">
                            Purchased: {formatDate(referral.purchased_at)}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredReferrals.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No referrals found matching your criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}