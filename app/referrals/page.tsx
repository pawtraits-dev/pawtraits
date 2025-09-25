'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Share2,
  QrCode,
  Copy,
  Users,
  Eye,
  UserPlus,
  Gift,
  TrendingUp,
  Download,
  MessageSquare,
  Mail,
  Phone,
  ExternalLink
} from 'lucide-react';
import Image from 'next/image';
import { getSupabaseClient } from '@/lib/supabase-client';
import { qrCodeService } from '@/lib/qr-code';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';

// Import the existing partner referrals component for reuse
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { Referral } from "@/lib/types";

interface UserProfile {
  id: string;
  user_type: 'customer' | 'partner' | 'influencer' | 'admin';
  first_name: string;
  last_name: string;
  email: string;
}

interface CustomerReferralData {
  personal_referral_code: string;
  total_referrals: number;
  successful_referrals: number;
  rewards_earned: number;
  signup_discount_used?: number;
  qr_code_url?: string;
}

interface ReferralAnalytics {
  total_shares: number;
  qr_scans: number;
  link_clicks: number;
  signups: number;
  successful_purchases: number;
  total_rewards_earned: number;
}

// Influencer referrals component
function InfluencerReferralsContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("All Statuses")
  const [sortBy, setSortBy] = useState("date")

  const [referrals, setReferrals] = useState<any[]>([])
  const [influencerData, setInfluencerData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const supabase = getSupabaseClient()

  useEffect(() => {
    fetchInfluencerData()
  }, [])

  const fetchInfluencerData = async () => {
    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      // For now, use placeholder data since we need to implement the API
      console.log('🌟 INFLUENCER REFERRALS: Would fetch from /api/influencers/referrals');

      // Placeholder data structure
      const mockInfluencerData = {
        stats: {
          total_codes: 2,
          active_codes: 2,
          total_usage: 15,
          total_conversions: 8,
          conversion_rate: 0.533,
          total_revenue: 450.00,
          total_commission: 45.00,
          commission_pending: 25.00,
          commission_paid: 20.00
        },
        referral_codes: [
          {
            id: '1',
            code: 'PETLOVER20',
            description: 'General promotion',
            usage_count: 10,
            conversion_count: 6,
            total_revenue: 300.00,
            total_commission: 30.00,
            is_active: true
          },
          {
            id: '2',
            code: 'DOGMOM',
            description: 'Dog-focused content',
            usage_count: 5,
            conversion_count: 2,
            total_revenue: 150.00,
            total_commission: 15.00,
            is_active: true
          }
        ],
        recent_referrals: [
          {
            id: '1',
            customer_email: 'customer1@example.com',
            status: 'purchased',
            order_value: 75.00,
            commission_amount: 7.50,
            source_platform: 'instagram',
            created_at: new Date().toISOString()
          },
          {
            id: '2',
            customer_email: 'customer2@example.com',
            status: 'pending',
            order_value: 0,
            commission_amount: 0,
            source_platform: 'tiktok',
            created_at: new Date().toISOString()
          }
        ]
      };

      setInfluencerData(mockInfluencerData);
      setReferrals(mockInfluencerData.recent_referrals);

    } catch (error) {
      console.error('Error fetching influencer data:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'purchased':
      case 'credited':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'accessed':
        return 'bg-blue-100 text-blue-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchInfluencerData} className="bg-yellow-600 hover:bg-yellow-700">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Influencer Referrals ✨</h1>
          <p className="mt-2 text-gray-600">
            Manage your referral codes and track your commission earnings
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <QrCode className="w-8 h-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Active Codes</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {influencerData?.stats?.active_codes || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Conversion Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {((influencerData?.stats?.conversion_rate || 0) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Gift className="w-8 h-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${(influencerData?.stats?.total_revenue || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Gift className="w-8 h-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Pending Commission</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${(influencerData?.stats?.commission_pending || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="codes" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="codes">Referral Codes</TabsTrigger>
            <TabsTrigger value="referrals">Recent Referrals</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="codes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Referral Codes</CardTitle>
                <CardDescription>
                  Create and manage your influencer referral codes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {influencerData?.referral_codes?.map((code: any) => (
                    <div key={code.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="flex items-center space-x-2">
                          <code className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-mono">
                            {code.code}
                          </code>
                          <Badge className={code.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {code.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{code.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {code.conversion_count}/{code.usage_count} conversions
                        </p>
                        <p className="text-lg font-bold text-yellow-600">
                          ${code.total_commission.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Button className="w-full bg-yellow-600 hover:bg-yellow-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Code
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="referrals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Referrals</CardTitle>
                <CardDescription>
                  Track your recent referral activity and earnings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Order Value</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((referral: any) => (
                      <TableRow key={referral.id}>
                        <TableCell>{referral.customer_email}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(referral.status)}>
                            {referral.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{referral.source_platform || '-'}</TableCell>
                        <TableCell>${referral.order_value.toFixed(2)}</TableCell>
                        <TableCell>${referral.commission_amount.toFixed(2)}</TableCell>
                        <TableCell>{new Date(referral.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Analytics</CardTitle>
                <CardDescription>
                  Detailed insights into your referral performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Usage Statistics</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Usage:</span>
                        <span className="font-medium">{influencerData?.stats?.total_usage || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Conversions:</span>
                        <span className="font-medium">{influencerData?.stats?.total_conversions || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Conversion Rate:</span>
                        <span className="font-medium">
                          {((influencerData?.stats?.conversion_rate || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Financial Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Total Revenue Generated:</span>
                        <span className="font-medium">${(influencerData?.stats?.total_revenue || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Commission:</span>
                        <span className="font-medium">${(influencerData?.stats?.total_commission || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Commission Paid:</span>
                        <span className="font-medium text-green-600">${(influencerData?.stats?.commission_paid || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Commission Pending:</span>
                        <span className="font-medium text-yellow-600">${(influencerData?.stats?.commission_pending || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Partner referrals component (existing logic)
function PartnerReferralsContent() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("All Statuses")
  const [sortBy, setSortBy] = useState("date")

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [commissionData, setCommissionData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const supabase = getSupabaseClient()

  useEffect(() => {
    fetchReferrals()
  }, [])

  const fetchReferrals = async () => {
    try {
      setLoading(true)

      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const [referralsResponse, commissionsResponse] = await Promise.all([
        fetch('/api/referrals', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
        fetch('/api/partner/commissions', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
      ])

      if (!referralsResponse.ok) {
        throw new Error('Failed to fetch referrals')
      }

      const referralsData = await referralsResponse.json()
      setReferrals(referralsData)

      if (commissionsResponse.ok) {
        const commissionDataResult = await commissionsResponse.json()
        setCommissionData(commissionDataResult)
      }
    } catch (error) {
      console.error('Error fetching referrals:', error)
      setError('Failed to load referrals')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      applied: "bg-emerald-100 text-emerald-800",
      accepted: "bg-green-100 text-green-800",
      accessed: "bg-blue-100 text-blue-800",
      invited: "bg-amber-100 text-amber-800",
      expired: "bg-gray-100 text-gray-800",
    }
    return variants[status as keyof typeof variants] || "bg-gray-100 text-gray-800"
  }

  const filteredReferrals = referrals.filter((referral) => {
    return (
      (searchTerm === "" ||
        referral.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        referral.client_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        referral.referral_code?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === "All Statuses" || referral.status === statusFilter)
    )
  })

  const totalCommissions = commissionData
    ? parseFloat(commissionData.summary.totalCommissions)
    : referrals.reduce((sum, r) => sum + (r.total_commission_amount || 0), 0) / 100;

  const successfulReferrals = referrals.filter((r) => (r.order_count || 0) > 0).length

  const stats = [
    { label: "Total Referrals", value: referrals.length.toString() },
    { label: "Successful", value: successfulReferrals.toString() },
    { label: "Total Commissions", value: `£${totalCommissions.toFixed(2)}` },
    {
      label: "Conversion Rate",
      value: referrals.length > 0 ? `${((successfulReferrals / referrals.length) * 100).toFixed(1)}%` : "0%",
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading referrals...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Referral Center</h1>
            <p className="text-gray-600 mt-2">Manage your referrals and track commissions</p>
          </div>
          <div className="flex gap-3 mt-4 sm:mt-0">
            <Link href="/partners">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
            <Link href="/commissions">
              <Button variant="outline">View Commissions</Button>
            </Link>
            <Link href="/referrals/create">
              <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                New Referral
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const isCommissionStat = stat.label === "Total Commissions"
            const CardWrapper = isCommissionStat ? Link : 'div'
            const cardProps = isCommissionStat ? { href: "/commissions" } : {}

            return (
              <CardWrapper key={index} {...cardProps}>
                <Card className={`border-green-200 ${isCommissionStat ? 'hover:shadow-lg transition-shadow cursor-pointer' : ''}`}>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-900">{stat.value}</div>
                    <div className="text-sm text-green-700">{stat.label}</div>
                  </CardContent>
                </Card>
              </CardWrapper>
            )
          })}
        </div>

        {/* Filters and Search */}
        <Card className="border-green-200">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search referrals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Statuses">All Statuses</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="accessed">Accessed</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date Created</SelectItem>
                  <SelectItem value="name">Client Name</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="commission">Commission</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Referrals Table */}
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-green-900">All Referrals</CardTitle>
            <CardDescription>
              Showing {filteredReferrals.length} of {referrals.length} referrals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referral ID</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>QR Scans</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell className="font-medium">{referral.referral_code}</TableCell>
                      <TableCell>{referral.client_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{referral.client_email}</div>
                          <div className="text-gray-500">{referral.client_phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(referral.status)}>{referral.status}</Badge>
                      </TableCell>
                      <TableCell>{referral.qr_scans}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{referral.order_count || 0} orders</div>
                          <div className="text-gray-500">£{((referral.total_order_value || 0) / 100).toFixed(2)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium text-orange-600">£{((referral.pending_commission || 0) / 100).toFixed(2)} pending</div>
                          <div className="text-green-600">£{((referral.paid_commission || 0) / 100).toFixed(2)} paid</div>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(referral.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Customer referrals component
function CustomerReferralsContent() {
  const [customerData, setCustomerData] = useState<CustomerReferralData | null>(null);
  const [analytics, setAnalytics] = useState<ReferralAnalytics | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerReferralData();
  }, []);

  const loadCustomerReferralData = async () => {
    try {
      const authResponse = await fetch('/api/auth/check', {
        credentials: 'include'
      });

      if (!authResponse.ok) {
        throw new Error('Not authenticated');
      }

      const { user } = await authResponse.json();
      const response = await fetch(`/api/referrals/customer?email=${encodeURIComponent(user.email)}`);

      if (response.ok) {
        const data = await response.json();
        setCustomerData(data.customer);
        setAnalytics(data.analytics);

        if (data.customer?.personal_referral_code) {
          const qrUrl = await qrCodeService.generatePawtraitsQRCode(data.customer.personal_referral_code);
          setQrCodeUrl(qrUrl);
        }
      }
    } catch (error) {
      console.error('Error loading customer referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReferralUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pawtraits.pics';
    return `${baseUrl}/r/customer/${customerData?.personal_referral_code}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const shareVia = (platform: string) => {
    const referralUrl = getReferralUrl();
    const message = `Check out Pawtraits - create amazing AI pet portraits! Use my referral link to get started: ${referralUrl}`;

    let shareUrl = '';

    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent('Check out Pawtraits!')}&body=${encodeURIComponent(message)}`;
        break;
      case 'sms':
        shareUrl = `sms:?body=${encodeURIComponent(message)}`;
        break;
      default:
        return;
    }

    trackShare(platform);
    window.open(shareUrl, '_blank');
  };

  const trackShare = async (platform: string) => {
    try {
      await fetch('/api/referrals/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referral_code: customerData?.personal_referral_code,
          action: 'share',
          platform
        })
      });
    } catch (error) {
      console.error('Error tracking share:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Share & Earn Rewards
          </h1>
          <p className="text-gray-600">
            Share Pawtraits with friends and earn rewards for every successful referral!
          </p>
        </div>

        {/* Stats Overview */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <Eye className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{analytics.total_shares}</div>
                <div className="text-sm text-gray-600">Total Shares</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <QrCode className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{analytics.qr_scans}</div>
                <div className="text-sm text-gray-600">QR Code Scans</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <UserPlus className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{analytics.signups}</div>
                <div className="text-sm text-gray-600">Friend Signups</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Gift className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">£{analytics.total_rewards_earned?.toFixed(2) || '0.00'}</div>
                <div className="text-sm text-gray-600">Rewards Earned</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <Tabs defaultValue="share" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="share">Share Your Code</TabsTrigger>
            <TabsTrigger value="rewards">Rewards & History</TabsTrigger>
          </TabsList>

          <TabsContent value="share" className="space-y-6">
            {/* Referral Code Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Share2 className="w-5 h-5" />
                  <span>Your Referral Code</span>
                </CardTitle>
                <CardDescription>
                  Share this code with friends to give them a discount and earn rewards!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <Label htmlFor="referral-code">Referral Code</Label>
                    <Input
                      id="referral-code"
                      value={customerData?.personal_referral_code || ''}
                      readOnly
                      className="font-mono text-lg font-bold"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(customerData?.personal_referral_code || '')}
                    className="mt-6"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <Label htmlFor="referral-url">Referral Link</Label>
                    <Input
                      id="referral-url"
                      value={getReferralUrl()}
                      readOnly
                      className="text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(getReferralUrl())}
                    className="mt-6"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* QR Code Card */}
            {qrCodeUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <QrCode className="w-5 h-5" />
                    <span>QR Code</span>
                  </CardTitle>
                  <CardDescription>
                    Let friends scan this QR code to visit your referral link
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <div className="inline-block p-4 bg-white rounded-lg shadow-sm">
                    <Image
                      src={qrCodeUrl}
                      alt="Referral QR Code"
                      width={200}
                      height={200}
                      className="mx-auto"
                    />
                  </div>
                  <Button onClick={() => {
                    const link = document.createElement('a');
                    link.href = qrCodeUrl;
                    link.download = `pawtraits-referral-${customerData?.personal_referral_code}.png`;
                    link.click();
                  }} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download QR Code
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Share Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Share with Friends</CardTitle>
                <CardDescription>
                  Choose how you'd like to share your referral code
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Button
                    onClick={() => shareVia('whatsapp')}
                    variant="outline"
                    className="flex flex-col items-center p-4 h-auto space-y-2 hover:bg-green-50"
                  >
                    <MessageSquare className="w-6 h-6 text-green-600" />
                    <span className="text-xs">WhatsApp</span>
                  </Button>

                  <Button
                    onClick={() => shareVia('facebook')}
                    variant="outline"
                    className="flex flex-col items-center p-4 h-auto space-y-2 hover:bg-blue-50"
                  >
                    <ExternalLink className="w-6 h-6 text-blue-600" />
                    <span className="text-xs">Facebook</span>
                  </Button>

                  <Button
                    onClick={() => shareVia('twitter')}
                    variant="outline"
                    className="flex flex-col items-center p-4 h-auto space-y-2 hover:bg-sky-50"
                  >
                    <ExternalLink className="w-6 h-6 text-sky-600" />
                    <span className="text-xs">Twitter</span>
                  </Button>

                  <Button
                    onClick={() => shareVia('email')}
                    variant="outline"
                    className="flex flex-col items-center p-4 h-auto space-y-2 hover:bg-gray-50"
                  >
                    <Mail className="w-6 h-6 text-gray-600" />
                    <span className="text-xs">Email</span>
                  </Button>

                  <Button
                    onClick={() => shareVia('sms')}
                    variant="outline"
                    className="flex flex-col items-center p-4 h-auto space-y-2 hover:bg-orange-50"
                  >
                    <Phone className="w-6 h-6 text-orange-600" />
                    <span className="text-xs">SMS</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-6">
            {/* Current Rewards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Gift className="w-5 h-5" />
                  <span>Your Rewards</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      £{customerData?.rewards_earned?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-sm text-green-600">Available Credits</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {customerData?.signup_discount_used ? `${customerData.signup_discount_used}%` : '0%'}
                    </div>
                    <div className="text-sm text-blue-600">Signup Discount Used</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {customerData?.successful_referrals || 0}
                    </div>
                    <div className="text-sm text-purple-600">Successful Referrals</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* How It Works */}
            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Badge variant="outline" className="mt-1">1</Badge>
                  <div>
                    <h4 className="font-medium">Share Your Code</h4>
                    <p className="text-sm text-gray-600">Share your referral code or QR code with friends and family</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Badge variant="outline" className="mt-1">2</Badge>
                  <div>
                    <h4 className="font-medium">Friend Gets Discount</h4>
                    <p className="text-sm text-gray-600">They get a discount on their first purchase when they sign up</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Badge variant="outline" className="mt-1">3</Badge>
                  <div>
                    <h4 className="font-medium">You Earn Rewards</h4>
                    <p className="text-sm text-gray-600">Earn credits when your friends make their first purchase</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkUserAccess();
  }, [router]);

  const checkUserAccess = async () => {
    try {
      const authResponse = await fetch('/api/auth/check', {
        credentials: 'include'
      });

      if (!authResponse.ok) {
        router.push('/auth/login');
        return;
      }

      const { isAuthenticated, user } = await authResponse.json();

      if (!isAuthenticated || !user) {
        console.log('❌ REFERRALS: User not authenticated, redirecting to login');
        router.push('/auth/login');
        return;
      }

      console.log('✅ REFERRALS: User authenticated:', {
        user_type: user.user_type,
        email: user.email
      });

      // Validate user type - referrals are available to customers and partners
      if (!['customer', 'partner'].includes(user.user_type)) {
        console.error('❌ REFERRALS: Invalid user type for referrals:', user.user_type);
        if (user.user_type === 'admin') {
          router.push('/admin');
        } else {
          router.push('/auth/login');
        }
        return;
      }

      setUserProfile(user);
    } catch (error) {
      console.error('❌ REFERRALS: API error:', error);
      setError('Failed to load user profile');
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading referrals...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // No user profile loaded (shouldn't happen due to loading/error states above)
  if (!userProfile) {
    return null;
  }

  // Route to appropriate content based on user type
  const content = userProfile.user_type === 'partner'
    ? <PartnerReferralsContent />
    : userProfile.user_type === 'influencer'
    ? <InfluencerReferralsContent />
    : userProfile.user_type === 'customer'
    ? <CustomerReferralsContent />
    : (router.push('/admin'), null);

  if (!content) {
    return null;
  }

  return (
    <CountryProvider>
      <UserAwareNavigation userProfile={userProfile} />
      {content}
    </CountryProvider>
  );
}