'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
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
  UserCheck,
  Share2,
  Copy,
  QrCode,
  Upload,
  Trash2,
  Loader2,
  Image,
  EyeOff,
  Edit,
  Save,
  XCircle
} from 'lucide-react';
import type { Partner, Referral } from '@/lib/types';
import { qrCodeService } from '@/lib/qr-code';

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
  const [partnerReferralCode, setPartnerReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [referralsLoading, setReferralsLoading] = useState(true);
  const [commissionsLoading, setCommissionsLoading] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadSuccess, setLogoUploadSuccess] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [editingCommissionRates, setEditingCommissionRates] = useState(false);
  const [commissionRates, setCommissionRates] = useState({
    commission_rate: 0,
    lifetime_commission_rate: 0
  });
  const [savingCommissionRates, setSavingCommissionRates] = useState(false);
  const [attributionData, setAttributionData] = useState<{
    total_attributed_customers: number;
    total_attributed_orders: number;
    total_attributed_revenue: number;
    by_level: Array<{ level: number; customers: number; orders: number; revenue: number }>;
    customers: Array<any>;
  } | null>(null);
  const [attributionLoading, setAttributionLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadPartnerDetails();
      loadPartnerReferrals();
      loadCommissionData();
      loadAttributionData();
    }
  }, [params.id]);

  useEffect(() => {
    if (partner) {
      loadPartnerReferralCode();
      setCommissionRates({
        commission_rate: partner.commission_rate || 20.00,
        lifetime_commission_rate: partner.lifetime_commission_rate || 5.00
      });
    }
  }, [partner]);

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

  /**
   * Sort customers in tree order for display
   * Tree order: C1, C1->C2, C1->C2->C3, C1->C4, C5, C5->C6
   * This is a depth-first traversal where we show all descendants before siblings
   */
  const sortCustomersInTreeOrder = (customers: any[]) => {
    if (!customers || customers.length === 0) return [];

    // Build a map of customer_id -> customer for quick lookups
    const customerMap = new Map(customers.map(c => [c.customer_id, c]));

    // Build parent -> children mapping based on referral path
    const childrenMap = new Map<string, any[]>();
    const rootCustomers: any[] = [];

    customers.forEach(customer => {
      // Parse referral path to find parent
      // Path format: "CODE1" or "CODE1 → CODE2" or "CODE1 → CODE2 → CODE3"
      const pathParts = customer.referral_path?.split(' → ') || [];

      if (pathParts.length === 1) {
        // Direct partner referral (level 1) - only has their own code
        rootCustomers.push(customer);
      } else if (pathParts.length > 1) {
        // Multi-level: find parent by looking at second-to-last code in path
        const parentCode = pathParts[pathParts.length - 2];

        // Find parent customer by their personal referral code
        const parent = customers.find(c => c.referral_path?.endsWith(parentCode) && c.customer_id !== customer.customer_id);
        if (parent) {
          if (!childrenMap.has(parent.customer_id)) {
            childrenMap.set(parent.customer_id, []);
          }
          childrenMap.get(parent.customer_id)!.push(customer);
        } else {
          // If parent not found, treat as root
          rootCustomers.push(customer);
        }
      } else {
        // No path or malformed, treat as root
        rootCustomers.push(customer);
      }
    });

    // Depth-first traversal to build sorted list
    const result: any[] = [];
    const traverse = (customer: any) => {
      result.push(customer);
      const children = childrenMap.get(customer.customer_id) || [];
      // Sort children by created date to maintain consistent order
      children.sort((a, b) => {
        const dateA = new Date(a.customer_created_at || 0).getTime();
        const dateB = new Date(b.customer_created_at || 0).getTime();
        return dateA - dateB;
      });
      children.forEach(traverse);
    };

    // Sort root customers by created date
    rootCustomers.sort((a, b) => {
      const dateA = new Date(a.customer_created_at || 0).getTime();
      const dateB = new Date(b.customer_created_at || 0).getTime();
      return dateA - dateB;
    });

    rootCustomers.forEach(traverse);
    return result;
  };

  const loadAttributionData = async () => {
    try {
      console.log('Loading attribution data for partner:', params.id);
      const response = await fetch(`/api/admin/partners/${params.id}/attribution`);
      console.log('Attribution API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Attribution data received:', data);

        // Sort customers in tree order for display
        if (data.customers && data.customers.length > 0) {
          data.customers = sortCustomersInTreeOrder(data.customers);
        }

        setAttributionData(data);
      } else {
        console.error('Attribution API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading attribution data:', error);
    } finally {
      setAttributionLoading(false);
    }
  };

  const loadPartnerReferralCode = async () => {
    try {
      // Use the actual personal_referral_code from the database
      if (partner?.personal_referral_code) {
        setPartnerReferralCode(partner.personal_referral_code);
      } else {
        console.warn('Partner does not have a personal_referral_code:', partner?.id);
        setPartnerReferralCode(null);
      }
    } catch (error) {
      console.error('Error loading partner referral code:', error);
    }
  };

  const copyReferralCode = async () => {
    if (partnerReferralCode) {
      try {
        await navigator.clipboard.writeText(partnerReferralCode);
        // You could add a toast notification here
      } catch (error) {
        console.error('Failed to copy referral code:', error);
      }
    }
  };

  const generateQRCode = async () => {
    if (!partnerReferralCode) return;

    try {
      setGeneratingQr(true);
      const qrDataURL = await qrCodeService.generateReferralQRDataURL(partnerReferralCode);
      setQrCodeDataUrl(qrDataURL);
      setShowQrCode(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code');
    } finally {
      setGeneratingQr(false);
    }
  };

  const toggleQRCode = async () => {
    if (showQrCode) {
      setShowQrCode(false);
    } else {
      if (!qrCodeDataUrl) {
        await generateQRCode();
      } else {
        setShowQrCode(true);
      }
    }
  };

  const copyReferralURL = () => {
    if (!partnerReferralCode) return;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pawtraits.pics';
    const referralUrl = `${baseUrl}/p/${partnerReferralCode}`;

    navigator.clipboard.writeText(referralUrl).then(() => {
      const originalTitle = document.title;
      document.title = '✓ URL Copied!';
      setTimeout(() => {
        document.title = originalTitle;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy URL:', err);
      alert('Failed to copy URL to clipboard');
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !partner) return;

    try {
      setIsUploadingLogo(true);
      console.log('🔄 Admin uploading partner logo via API');

      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch(`/api/admin/partners/${partner.id}/logo`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload logo');
      }

      const result = await response.json();

      // Update local partner state with new logo URL
      setPartner(prev => prev ? { ...prev, logo_url: result.logo_url } : null);

      setLogoUploadSuccess(true);
      setTimeout(() => setLogoUploadSuccess(false), 2000);

    } catch (error) {
      console.error('Error uploading partner logo:', error);
      // TODO: Show error toast notification
    } finally {
      setIsUploadingLogo(false);
      // Clear the file input
      event.target.value = '';
    }
  };

  const handleLogoDelete = async () => {
    if (!partner) return;

    try {
      setIsUploadingLogo(true);
      console.log('🗑️ Admin deleting partner logo via API');

      const response = await fetch(`/api/admin/partners/${partner.id}/logo`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete logo');
      }

      // Update local partner state to remove logo URL
      setPartner(prev => prev ? { ...prev, logo_url: null } : null);

      setLogoUploadSuccess(true);
      setTimeout(() => setLogoUploadSuccess(false), 2000);

    } catch (error) {
      console.error('Error deleting partner logo:', error);
      // TODO: Show error toast notification
    } finally {
      setIsUploadingLogo(false);
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

  const handleCommissionRatesSave = async () => {
    if (!partner) return;

    try {
      setSavingCommissionRates(true);
      const response = await fetch(`/api/admin/partners/${partner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commission_rate: commissionRates.commission_rate,
          lifetime_commission_rate: commissionRates.lifetime_commission_rate
        })
      });

      if (response.ok) {
        setEditingCommissionRates(false);
        loadPartnerDetails();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update commission rates');
      }
    } catch (error) {
      console.error('Error updating commission rates:', error);
      alert('Failed to update commission rates. Please try again.');
    } finally {
      setSavingCommissionRates(false);
    }
  };

  const handleCommissionRatesCancel = () => {
    setEditingCommissionRates(false);
    if (partner) {
      setCommissionRates({
        commission_rate: partner.commission_rate || 20.00,
        lifetime_commission_rate: partner.lifetime_commission_rate || 5.00
      });
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

  const totalCommissions = commissionData?.summary.totalEarned || (partner.total_commissions ? partner.total_commissions / 100 : 0);
  const successfulReferrals = commissionData?.summary.successfulReferrals || partner.successful_referrals || 0;
  const totalOrders = partner.total_orders || 0;
  const totalOrderValue = partner.total_order_value ? partner.total_order_value / 100 : 0;
  const conversionRate = (partner.total_referrals || referrals.length) > 0 ? ((successfulReferrals / (partner.total_referrals || referrals.length)) * 100).toFixed(1) : '0';

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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{partner.total_referrals || referrals.length}</p>
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
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                <p className="text-sm text-gray-600">Orders</p>
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
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalOrderValue)}</p>
                <p className="text-sm text-gray-600">Order Value</p>
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
                <p className="text-sm text-gray-600">Commissions</p>
                <p className="text-xs text-gray-500">{conversionRate}% conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{attributionData?.total_attributed_customers || 0}</p>
                <p className="text-sm text-gray-600" title="Includes all customers through multi-level referral chains">Attributed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-teal-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(attributionData?.total_attributed_revenue ? attributionData.total_attributed_revenue / 100 : 0)}</p>
                <p className="text-sm text-gray-600" title="Total revenue from all attributed customers">Attr. Revenue</p>
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
          <TabsTrigger value="attribution">Attribution ({attributionData?.total_attributed_customers || 0})</TabsTrigger>
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

                {/* Business Logo Management */}
                <div>
                  <p className="font-medium mb-3 flex items-center">
                    <Image className="w-4 h-4 mr-2" />
                    Business Logo
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center">
                      {partner.logo_url ? (
                        <img
                          src={partner.logo_url}
                          alt="Business Logo"
                          className="w-full h-full object-contain rounded-lg"
                        />
                      ) : (
                        <Upload className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="file"
                          id="admin-logo-upload"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <label htmlFor="admin-logo-upload">
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            asChild
                          >
                            <span>
                              {isUploadingLogo ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 mr-2" />
                                  {partner.logo_url ? 'Change Logo' : 'Upload Logo'}
                                </>
                              )}
                            </span>
                          </Button>
                        </label>
                        {partner.logo_url && !isUploadingLogo && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleLogoDelete}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </Button>
                        )}
                        {logoUploadSuccess && (
                          <span className="text-sm text-green-600 flex items-center">
                            <Check className="w-4 h-4 mr-1" />
                            Updated!
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Upload logo for display on referral invitations. JPEG, PNG, WebP. Max 5MB.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Referral Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Share2 className="w-5 h-5 mr-2" />
                  Referral Information
                </CardTitle>
                <CardDescription>
                  Partner's main referral code for customer acquisition
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {partnerReferralCode && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-lg border">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <QrCode className="w-5 h-5 text-purple-600" />
                          <p className="font-semibold text-gray-900">Partner Referral Code</p>
                        </div>
                        <div className="bg-white p-3 rounded-md border shadow-sm">
                          <code className="text-xl font-mono font-bold text-purple-600">
                            {partnerReferralCode}
                          </code>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={copyReferralCode}
                          title="Copy referral code"
                          className="flex items-center space-x-1"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Copy Code</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={copyReferralURL}
                          title="Copy referral URL"
                          className="flex items-center space-x-1"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Copy URL</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={toggleQRCode}
                          disabled={generatingQr}
                          className="flex items-center space-x-1"
                        >
                          {generatingQr ? (
                            <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-purple-600"></div>
                          ) : showQrCode ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                          <span>{showQrCode ? 'Hide QR' : 'Show QR'}</span>
                        </Button>
                      </div>
                    </div>

                    {/* Referral URL Display */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Referral URL:</p>
                      <div className="bg-white p-3 rounded-md border font-mono text-sm text-gray-700 break-all">
                        {typeof window !== 'undefined'
                          ? `${window.location.origin}/p/${partnerReferralCode}`
                          : `https://pawtraits.pics/p/${partnerReferralCode}`
                        }
                      </div>
                    </div>

                    {/* QR Code Display */}
                    {showQrCode && qrCodeDataUrl && (
                      <div className="text-center">
                        <div className="inline-block p-4 bg-white rounded-lg shadow-sm border">
                          <img
                            src={qrCodeDataUrl}
                            alt={`QR Code for ${partnerReferralCode}`}
                            className="w-48 h-48 mx-auto"
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            Scan to access referral link
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Usage Information */}
                    <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                      <p className="mb-2"><strong>Usage:</strong> Share this code or URL with customers for direct referrals</p>
                      <p><strong>Commission:</strong> {partner?.commission_rate ? `${partner.commission_rate}%` : '20%'} on first order, {partner?.lifetime_commission_rate ? `${partner.lifetime_commission_rate}%` : '5%'} lifetime</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Commission Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DollarSign className="w-5 h-5 mr-2" />
                    Commission Settings
                  </div>
                  {!editingCommissionRates && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingCommissionRates(true)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Rates
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  Commission rates for this partner's referrals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {editingCommissionRates ? (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={commissionRates.commission_rate}
                              onChange={(e) => setCommissionRates(prev => ({
                                ...prev,
                                commission_rate: parseFloat(e.target.value) || 0
                              }))}
                              className="w-20"
                            />
                            <span>%</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Initial Commission Rate</p>
                          <p className="text-xs text-gray-500">Applied to first-time customer orders</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={commissionRates.lifetime_commission_rate}
                              onChange={(e) => setCommissionRates(prev => ({
                                ...prev,
                                lifetime_commission_rate: parseFloat(e.target.value) || 0
                              }))}
                              className="w-20"
                            />
                            <span>%</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Subsequent Commission Rate</p>
                          <p className="text-xs text-gray-500">Applied to repeat customer orders</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-4 border-t">
                      <Button
                        size="sm"
                        onClick={handleCommissionRatesSave}
                        disabled={savingCommissionRates}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {savingCommissionRates ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCommissionRatesCancel}
                        disabled={savingCommissionRates}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <div>
                        <p className="font-medium">{partner.commission_rate || 20.00}%</p>
                        <p className="text-sm text-gray-600">Initial Commission Rate</p>
                        <p className="text-xs text-gray-500">Applied to first-time customer orders</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="font-medium">{partner.lifetime_commission_rate || 5.00}%</p>
                        <p className="text-sm text-gray-600">Subsequent Commission Rate</p>
                        <p className="text-xs text-gray-500">Applied to repeat customer orders</p>
                      </div>
                    </div>

                    <div className="pt-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      <p><strong>How it works:</strong> Partners earn the initial rate on a customer's first purchase, then the subsequent rate for all future orders from that customer.</p>
                    </div>
                  </>
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

        <TabsContent value="attribution" className="space-y-6">
          {attributionLoading ? (
            <Card>
              <CardContent className="p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Attribution Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Multi-Level Attribution Overview</CardTitle>
                  <CardDescription>
                    Total customers and revenue attributable to this partner through referral chains
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total Attributed Customers</p>
                      <p className="text-3xl font-bold text-indigo-600">{attributionData?.total_attributed_customers || 0}</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total Attributed Orders</p>
                      <p className="text-3xl font-bold text-orange-600">{attributionData?.total_attributed_orders || 0}</p>
                    </div>
                    <div className="p-4 bg-teal-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total Attributed Revenue</p>
                      <p className="text-3xl font-bold text-teal-600">
                        {formatCurrency(attributionData?.total_attributed_revenue ? attributionData.total_attributed_revenue / 100 : 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Attribution by Level */}
              {attributionData?.by_level && attributionData.by_level.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Breakdown by Referral Level</CardTitle>
                    <CardDescription>
                      Level 1 = Direct referrals, Level 2 = Customers referred by Level 1, etc.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium text-gray-700">Level</th>
                            <th className="text-left p-3 font-medium text-gray-700">Customers</th>
                            <th className="text-left p-3 font-medium text-gray-700">Orders</th>
                            <th className="text-left p-3 font-medium text-gray-700">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attributionData.by_level.map((level) => (
                            <tr key={level.level} className="border-b hover:bg-gray-50">
                              <td className="p-3">
                                <Badge className="bg-indigo-100 text-indigo-800">
                                  Level {level.level}
                                </Badge>
                              </td>
                              <td className="p-3 font-medium">{level.customers.toLocaleString()}</td>
                              <td className="p-3 font-medium">{level.orders.toLocaleString()}</td>
                              <td className="p-3 font-medium">{formatCurrency(level.revenue / 100)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Attribution Customer List */}
              {attributionData?.customers && attributionData.customers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Attributed Customers</CardTitle>
                    <CardDescription>
                      All customers in the attribution chain with their referral paths
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-medium text-gray-700">Email</th>
                            <th className="text-left p-3 font-medium text-gray-700">Level</th>
                            <th className="text-left p-3 font-medium text-gray-700">
                              <div>Direct Orders</div>
                              <div className="text-xs font-normal text-gray-500">(Customer Only)</div>
                            </th>
                            <th className="text-left p-3 font-medium text-gray-700">
                              <div>Chain Orders</div>
                              <div className="text-xs font-normal text-gray-500">(Referrals)</div>
                            </th>
                            <th className="text-left p-3 font-medium text-gray-700">
                              <div>Total Orders</div>
                              <div className="text-xs font-normal text-gray-500">(Direct + Chain)</div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {attributionData.customers.map((customer: any, index: number) => {
                            // Calculate indentation based on referral level (0-indexed, so level 1 = no indent)
                            const indentLevel = Math.max(0, customer.referral_level - 1);
                            const indentPx = indentLevel * 24; // 24px per level

                            // Calculate chain totals (all descendants)
                            let chainOrders = 0;
                            let chainRevenue = 0;

                            // Find all descendants of this customer
                            const findDescendants = (parentEmail: string) => {
                              console.log(`[DEBUG] Finding descendants for: ${parentEmail}`);
                              console.log(`[DEBUG] Current customer index: ${index}`);
                              console.log(`[DEBUG] Total customers: ${attributionData.customers.length}`);

                              attributionData.customers.forEach((c: any, idx: number) => {
                                if (idx > index) { // Only look at customers after this one (already in tree order)
                                  const pathParts = c.referral_path?.split(' → ') || [];
                                  console.log(`[DEBUG]   Checking ${c.customer_email} (idx: ${idx})`);
                                  console.log(`[DEBUG]     Path: ${c.referral_path}`);
                                  console.log(`[DEBUG]     PathParts: ${JSON.stringify(pathParts)}`);
                                  console.log(`[DEBUG]     Includes parent? ${pathParts.includes(parentEmail)}`);
                                  console.log(`[DEBUG]     Order count: ${c.order_count || 0}`);

                                  // Check if this customer is a descendant
                                  if (pathParts.includes(parentEmail)) {
                                    console.log(`[DEBUG]     ✅ MATCH - Adding ${c.order_count || 0} orders to chain`);
                                    chainOrders += (c.order_count || 0);
                                    chainRevenue += (c.total_revenue || 0);
                                  } else {
                                    console.log(`[DEBUG]     ❌ NO MATCH`);
                                  }
                                }
                              });

                              console.log(`[DEBUG] Final chain orders for ${parentEmail}: ${chainOrders}`);
                            };

                            findDescendants(customer.customer_email);

                            const directOrders = customer.order_count || 0;
                            const directRevenue = customer.total_revenue || 0;
                            const totalOrders = directOrders + chainOrders;
                            const totalRevenue = directRevenue + chainRevenue;

                            return (
                              <tr key={customer.customer_id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">
                                  <div style={{ paddingLeft: `${indentPx}px` }} className="flex items-center gap-2">
                                    {indentLevel > 0 && (
                                      <span className="text-gray-400 text-xs">
                                        {'└─ '}
                                      </span>
                                    )}
                                    <Link
                                      href={`/admin/customers/${customer.customer_id}`}
                                      className="text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {customer.customer_email}
                                    </Link>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <Badge className="bg-indigo-100 text-indigo-800">
                                    L{customer.referral_level}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <div className="text-sm">
                                    <div className="font-medium">{directOrders} orders</div>
                                    <div className="text-gray-600">{formatCurrency(directRevenue / 100)}</div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="text-sm">
                                    <div className="font-medium text-indigo-600">{chainOrders} orders</div>
                                    <div className="text-indigo-600">{formatCurrency(chainRevenue / 100)}</div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="text-sm">
                                    <div className="font-bold">{totalOrders} orders</div>
                                    <div className="font-semibold text-green-600">{formatCurrency(totalRevenue / 100)}</div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(!attributionData || attributionData.total_attributed_customers === 0) && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No attributed customers found</p>
                    <p className="text-sm text-gray-500 mt-2">
                      This partner has no multi-level attribution data yet
                    </p>
                  </CardContent>
                </Card>
              )}
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