'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  User, 
  Building, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  DollarSign,
  Users,
  TrendingUp,
  Check,
  X,
  Clock,
  ExternalLink,
  Eye,
  UserCheck
} from 'lucide-react';
import type { Partner, Referral } from '@/lib/types';

interface ReferralWithStatus extends Referral {
  client_signup_status?: 'completed' | 'pending' | 'expired';
  client_orders?: Array<{
    id: string;
    order_value: number;
    discount_applied: number;
    order_status: string;
    order_date: string;
  }>;
}

interface CommissionData {
  summary: {
    totalEarned: number;
    totalPaid: number;
    totalPending: number;
    successfulReferrals: number;
    averageCommission: number;
  };
  payments: Array<{
    id: string;
    payment_period_start: string;
    payment_period_end: string;
    total_amount: number;
    referral_count: number;
    status: string;
    payment_method: string;
    paid_at?: string;
    created_at: string;
  }>;
  referralCommissions: Array<{
    id: string;
    referral_code: string;
    client_name: string;
    client_email: string;
    status: string;
    commission_amount: number;
    commission_paid: boolean;
    commission_rate: number;
    purchased_at?: string;
    created_at: string;
  }>;
}

const approvalStatusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-gray-100 text-gray-800'
};

const businessTypeLabels = {
  groomer: '✂️ Groomer',
  vet: '🏥 Veterinarian', 
  breeder: '🐕 Breeder',
  salon: '💅 Pet Salon',
  mobile: '🚐 Mobile Service',
  independent: '⭐ Independent',
  chain: '🏢 Chain/Franchise'
};

export default function PartnerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [referrals, setReferrals] = useState<ReferralWithStatus[]>([]);
  const [commissionData, setCommissionData] = useState<CommissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [referralsLoading, setReferralsLoading] = useState(true);
  const [commissionsLoading, setCommissionsLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadPartnerDetails();
      loadPartnerReferrals();
      loadCommissionData();
    }
  }, [params.id]);

  const loadPartnerDetails = async () => {
    try {
      const response = await fetch(`/api/admin/partners/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setPartner(data);
      } else {
        router.push('/admin/partners');
      }
    } catch (error) {
      console.error('Error loading partner details:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPartnerReferrals = async () => {
    try {
      console.log('Loading referrals for partner:', params.id);
      const response = await fetch(`/api/admin/partners/${params.id}/referrals`);
      console.log('Referrals API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Referrals data received:', data?.length || 0, 'referrals');
        // Add signup status based on referral status and dates
        const referralsWithStatus = data.map((referral: Referral) => ({
          ...referral,
          client_signup_status: getClientSignupStatus(referral)
        }));
        setReferrals(referralsWithStatus);
      } else {
        console.error('Referrals API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading partner referrals:', error);
    } finally {
      setReferralsLoading(false);
    }
  };

  const loadCommissionData = async () => {
    try {
      console.log('Loading commission data for partner:', params.id);
      const response = await fetch(`/api/admin/partners/${params.id}/commissions`);
      console.log('Commission API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Commission data received:', data);
        setCommissionData(data);
      } else {
        console.error('Commission API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading commission data:', error);
    } finally {
      setCommissionsLoading(false);
    }
  };

  const getClientSignupStatus = (referral: Referral): 'completed' | 'pending' | 'expired' => {
    if (referral.status === 'applied') return 'completed';
    if (new Date(referral.expires_at) < new Date()) return 'expired';
    return 'pending';
  };

  const handleStatusChange = async (newStatus: string, reason?: string) => {
    if (!partner) return;
    
    try {
      const response = await fetch(`/api/admin/partners/${partner.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          approval_status: newStatus,
          rejection_reason: reason 
        })
      });

      if (response.ok) {
        loadPartnerDetails();
      }
    } catch (error) {
      console.error('Error updating partner status:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

  if (!partner) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Partner Not Found</h1>
          <Link href="/admin/partners">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Partners
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalCommissions = commissionData?.summary.totalEarned || referrals.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const successfulReferrals = commissionData?.summary.successfulReferrals || referrals.filter(r => r.status === 'applied').length;
  const conversionRate = referrals.length > 0 ? ((successfulReferrals / referrals.length) * 100).toFixed(1) : '0';

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/partners">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {partner.first_name} {partner.last_name}
            </h1>
            <p className="text-gray-600 mt-1">{partner.business_name || 'Partner Details'}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge className={approvalStatusColors[partner.approval_status as keyof typeof approvalStatusColors] || 'bg-gray-100 text-gray-800'}>
            {partner.approval_status ? partner.approval_status.charAt(0).toUpperCase() + partner.approval_status.slice(1) : 'Unknown'}
          </Badge>
          {partner.approval_status === 'pending' && (
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                onClick={() => handleStatusChange('approved')}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  const reason = prompt('Rejection reason:');
                  if (reason) handleStatusChange('rejected', reason);
                }}
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{referrals.length}</p>
                <p className="text-sm text-gray-600">Total Referrals</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{successfulReferrals}</p>
                <p className="text-sm text-gray-600">Successful</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{conversionRate}%</p>
                <p className="text-sm text-gray-600">Conversion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCommissions)}</p>
                <p className="text-sm text-gray-600">Total Commissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="referrals">Referrals ({referrals.length})</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium">{partner.email}</p>
                    <p className="text-sm text-gray-600">Email Address</p>
                  </div>
                </div>
                
                {partner.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="font-medium">{partner.phone}</p>
                      <p className="text-sm text-gray-600">Phone Number</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="font-medium">{formatDate(partner.created_at)}</p>
                    <p className="text-sm text-gray-600">Joined Date</p>
                  </div>
                </div>

                {partner.last_login_at && (
                  <div className="flex items-center space-x-3">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="font-medium">{formatDate(partner.last_login_at)}</p>
                      <p className="text-sm text-gray-600">Last Login</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Business Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="w-5 h-5 mr-2" />
                  Business Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {partner.business_name && (
                  <div>
                    <p className="font-medium">{partner.business_name}</p>
                    <p className="text-sm text-gray-600">Business Name</p>
                  </div>
                )}

                {partner.business_type && (
                  <div>
                    <p className="font-medium">
                      {businessTypeLabels[partner.business_type as keyof typeof businessTypeLabels]}
                    </p>
                    <p className="text-sm text-gray-600">Business Type</p>
                  </div>
                )}

                {partner.business_address && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                    <div>
                      <p className="font-medium">
                        {[
                          partner.business_address.street,
                          partner.business_address.city,
                          partner.business_address.state,
                          partner.business_address.zip
                        ].filter(Boolean).join(', ')}
                      </p>
                      <p className="text-sm text-gray-600">Business Address</p>
                    </div>
                  </div>
                )}

                {partner.business_phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="font-medium">{partner.business_phone}</p>
                      <p className="text-sm text-gray-600">Business Phone</p>
                    </div>
                  </div>
                )}

                {partner.business_website && (
                  <div className="flex items-center space-x-3">
                    <ExternalLink className="w-4 h-4 text-gray-500" />
                    <div>
                      <a 
                        href={partner.business_website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {partner.business_website}
                      </a>
                      <p className="text-sm text-gray-600">Website</p>
                    </div>
                  </div>
                )}

                {partner.bio && (
                  <div>
                    <p className="font-medium mb-2">About</p>
                    <p className="text-gray-700">{partner.bio}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="referrals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Referrals</CardTitle>
              <CardDescription>
                All clients referred by this partner and their signup status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {referralsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {referrals.length > 0 ? (
                    referrals.map((referral) => (
                      <div key={referral.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4">
                              <div>
                                <h3 className="font-medium text-gray-900">{referral.client_name}</h3>
                                <p className="text-sm text-gray-600">{referral.client_email}</p>
                                {referral.pet_name && (
                                  <p className="text-sm text-purple-600">Pet: {referral.pet_name}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <div className="flex items-center space-x-2">
                                <Badge 
                                  className={
                                    referral.client_signup_status === 'completed' 
                                      ? 'bg-green-100 text-green-800'
                                      : referral.client_signup_status === 'expired'
                                      ? 'bg-red-100 text-red-800' 
                                      : 'bg-yellow-100 text-yellow-800'
                                  }
                                >
                                  {referral.client_signup_status === 'completed' && '✓ Signed Up'}
                                  {referral.client_signup_status === 'pending' && '⏳ Pending'}
                                  {referral.client_signup_status === 'expired' && '⏰ Expired'}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                Created: {formatDate(referral.created_at)}
                              </p>
                              {referral.expires_at && (
                                <p className="text-xs text-gray-500">
                                  Expires: {formatDate(referral.expires_at)}
                                </p>
                              )}
                            </div>
                            
                            <div className="text-right">
                              {referral.commission_amount && referral.commission_amount > 0 && (
                                <div className="mb-2">
                                  <p className="font-medium text-green-600">
                                    {formatCurrency(referral.commission_amount)}
                                  </p>
                                  <p className="text-xs text-gray-500">Commission</p>
                                </div>
                              )}
                              {referral.client_orders && referral.client_orders.length > 0 && (
                                <div className="text-xs text-blue-600">
                                  {referral.client_orders.length > 1 ? `${referral.client_orders.length} orders` : '1 order'}
                                  {referral.client_orders[0] && (
                                    <span className="block">
                                      {formatCurrency(referral.client_orders[0].order_value / 100)} • {referral.client_orders[0].order_status}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
                          <div>
                            Referral Code: <code className="bg-gray-100 px-2 py-1 rounded">{referral.referral_code}</code>
                          </div>
                          <div className="flex items-center space-x-4">
                            {referral.qr_scans > 0 && (
                              <span>{referral.qr_scans} QR scans</span>
                            )}
                            {referral.email_opens > 0 && (
                              <span>{referral.email_opens} email opens</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600">No referrals found for this partner</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-6">
          {commissionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Commission Summary */}
              {commissionData && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(commissionData.summary.totalEarned)}
                        </p>
                        <p className="text-sm text-gray-600">Total Earned</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {formatCurrency(commissionData.summary.totalPaid)}
                        </p>
                        <p className="text-sm text-gray-600">Total Paid</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {formatCurrency(commissionData.summary.totalPending)}
                        </p>
                        <p className="text-sm text-gray-600">Pending</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {formatCurrency(commissionData.summary.averageCommission)}
                        </p>
                        <p className="text-sm text-gray-600">Average</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Commission Payments */}
              <Card>
                <CardHeader>
                  <CardTitle>Commission Payments</CardTitle>
                  <CardDescription>Payment history and status</CardDescription>
                </CardHeader>
                <CardContent>
                  {commissionData?.payments && commissionData.payments.length > 0 ? (
                    <div className="space-y-4">
                      {commissionData.payments.map((payment) => (
                        <div key={payment.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium text-gray-900">
                                {formatDate(payment.payment_period_start)} - {formatDate(payment.payment_period_end)}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {payment.referral_count} referrals • {payment.payment_method}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-green-600">
                                {formatCurrency(payment.total_amount)}
                              </p>
                              <Badge className={
                                payment.status === 'paid' 
                                  ? 'bg-green-100 text-green-800'
                                  : payment.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }>
                                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                              </Badge>
                            </div>
                          </div>
                          {payment.paid_at && (
                            <p className="text-xs text-gray-500 mt-2">
                              Paid on {formatDate(payment.paid_at)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600">No commission payments yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Individual Referral Commissions */}
              <Card>
                <CardHeader>
                  <CardTitle>Referral Commissions</CardTitle>
                  <CardDescription>Commission details for each referral</CardDescription>
                </CardHeader>
                <CardContent>
                  {commissionData?.referralCommissions && commissionData.referralCommissions.length > 0 ? (
                    <div className="space-y-3">
                      {commissionData.referralCommissions.map((referral) => (
                        <div key={referral.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{referral.client_name}</h4>
                              <p className="text-sm text-gray-600">{referral.client_email}</p>
                              <p className="text-xs text-gray-500">
                                Code: {referral.referral_code} • {referral.commission_rate}% commission
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-green-600">
                                {formatCurrency(referral.commission_amount)}
                              </p>
                              <Badge className={referral.commission_paid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                {referral.commission_paid ? 'Paid' : 'Pending'}
                              </Badge>
                              <p className="text-xs text-gray-500 mt-1">
                                {referral.purchased_at ? `Purchased ${formatDate(referral.purchased_at)}` : formatDate(referral.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600">No commission earnings yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Partner account and referral activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Account created</p>
                    <p className="text-sm text-gray-600">{formatDate(partner.created_at)}</p>
                  </div>
                </div>

                {partner.approved_at && (
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Account approved</p>
                      <p className="text-sm text-gray-600">{formatDate(partner.approved_at)}</p>
                    </div>
                  </div>
                )}

                {partner.last_login_at && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Clock className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Last login</p>
                      <p className="text-sm text-gray-600">{formatDate(partner.last_login_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}