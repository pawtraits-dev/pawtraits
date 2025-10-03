'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  Eye,
  UserPlus,
  TrendingUp,
  DollarSign,
  Gift,
  Activity,
  Calendar,
  BarChart3,
  Copy,
  Download,
  QrCode,
  Share2,
  ExternalLink,
  CheckCircle
} from 'lucide-react';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';

interface UserProfile {
  id: string;
  user_type: 'customer' | 'partner' | 'influencer' | 'admin';
  first_name: string;
  last_name: string;
  email: string;
}

interface ReferralCode {
  code: string;
  qr_code_url: string | null;
  type: 'pre_registration' | 'personal';
  scans_count: number;
  conversions_count: number;
  share_url: string;
  created_at?: string;
}

interface MyReferralCodeResponse {
  user_type: 'partner' | 'customer';
  partner_name?: string;
  customer_name?: string;
  primary_code: ReferralCode;
  all_codes: ReferralCode[];
}

interface ReferralAnalytics {
  summary: {
    total_scans: number;
    total_signups: number;
    total_purchases: number;
    conversion_rate: number;
    total_commissions?: number;
    total_rewards?: number;
    total_order_value: number;
    avg_order_value: number;
  };
  recent_activity: Array<{
    id: string;
    type: 'scan' | 'signup' | 'purchase';
    date: string;
    order_value?: number;
    commission?: number;
    reward?: number;
  }>;
  user_type: string;
}

function ReferralCodeDisplay({ codeData }: { codeData: MyReferralCodeResponse }) {
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const { primary_code, user_type } = codeData;
  const fullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${primary_code.share_url}`
    : primary_code.share_url;

  const copyToClipboard = async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card className="mb-8 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <Share2 className="h-6 w-6 mr-2 text-purple-600" />
              Your Referral Code
            </CardTitle>
            <CardDescription className="mt-2">
              {user_type === 'partner'
                ? 'Share this code with customers to earn commissions on their purchases'
                : 'Share this code with friends to earn rewards when they make their first purchase'}
            </CardDescription>
          </div>
          {primary_code.qr_code_url && (
            <div className="flex items-center">
              <QrCode className="h-5 w-5 text-purple-600 mr-2" />
              <span className="text-sm text-muted-foreground">QR Code Available</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Referral Code */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Referral Code
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border-2 border-purple-300 rounded-lg px-6 py-4">
              <p className="text-3xl font-bold text-purple-600 tracking-wider text-center">
                {primary_code.code}
              </p>
            </div>
            <Button
              onClick={() => copyToClipboard(primary_code.code, 'code')}
              variant="outline"
              size="lg"
              className="h-full"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Share URL */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Share Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3">
              <p className="text-sm text-gray-700 truncate">
                {fullUrl}
              </p>
            </div>
            <Button
              onClick={() => copyToClipboard(fullUrl, 'url')}
              variant="outline"
            >
              {copiedUrl ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
            <Button
              onClick={() => window.open(fullUrl, '_blank')}
              variant="outline"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>

        {/* QR Code Display */}
        {primary_code.qr_code_url && (
          <div className="pt-4 border-t border-gray-200">
            <label className="text-sm font-medium text-gray-700 mb-3 block">
              QR Code
            </label>
            <div className="flex items-start gap-4">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                <img
                  src={primary_code.qr_code_url}
                  alt="Referral QR Code"
                  className="w-48 h-48 object-contain"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-4">
                  Print this QR code and display it in your business, or share it digitally.
                  Customers can scan it to access your referral page instantly.
                </p>
                <Button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = primary_code.qr_code_url!;
                    link.download = `referral-qr-${primary_code.code}.png`;
                    link.click();
                  }}
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{primary_code.scans_count}</p>
            <p className="text-sm text-gray-600">Total Scans/Views</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{primary_code.conversions_count}</p>
            <p className="text-sm text-gray-600">Conversions</p>
          </div>
        </div>

        {/* Code Type Badge */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <Badge variant="outline" className="capitalize">
            {primary_code.type.replace('_', ' ')} Code
          </Badge>
          {primary_code.created_at && (
            <span>
              Created: {new Date(primary_code.created_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReferralSummaryCards({ analytics }: { analytics: ReferralAnalytics }) {
  const { summary } = analytics;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Scans/Accesses</CardTitle>
          <Eye className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.total_scans}</div>
          <p className="text-xs text-muted-foreground">Referral code usage</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Signups</CardTitle>
          <UserPlus className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.total_signups}</div>
          <p className="text-xs text-muted-foreground">Account creations</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Purchases</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.total_purchases}</div>
          <p className="text-xs text-muted-foreground">
            {summary.conversion_rate.toFixed(1)}% conversion rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {analytics.user_type === 'customer' ? 'Rewards Earned' : 'Commissions Earned'}
          </CardTitle>
          {analytics.user_type === 'customer' ?
            <Gift className="h-4 w-4 text-muted-foreground" /> :
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          }
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            £{((summary.total_commissions || summary.total_rewards || 0)).toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            £{summary.avg_order_value.toFixed(2)} avg order value
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ReferralActivityTable({ activities }: { activities: ReferralAnalytics['recent_activity'] }) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'scan': return <Eye className="h-4 w-4" />;
      case 'signup': return <UserPlus className="h-4 w-4" />;
      case 'purchase': return <DollarSign className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'scan': return 'bg-blue-100 text-blue-800';
      case 'signup': return 'bg-yellow-100 text-yellow-800';
      case 'purchase': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Recent Referral Activity
        </CardTitle>
        <CardDescription>
          Privacy-protected view of your referral performance (no customer data shown)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No referral activity yet</p>
            <p className="text-sm">Share your referral code to get started!</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Order Value</TableHead>
                <TableHead>Reward/Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity, index) => (
                <TableRow key={`${activity.id}-${index}`}>
                  <TableCell>
                    <div className="flex items-center">
                      {getActivityIcon(activity.type)}
                      <Badge className={`ml-2 ${getActivityColor(activity.type)}`}>
                        {activity.type}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      {new Date(activity.date).toLocaleDateString('en-GB', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {activity.order_value ? `£${activity.order_value.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell>
                    {activity.commission ? `£${activity.commission.toFixed(2)}` :
                     activity.reward ? `£${activity.reward.toFixed(2)}` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function UserReferralContent({ userType }: { userType: string }) {
  const [analytics, setAnalytics] = useState<ReferralAnalytics | null>(null);
  const [referralCode, setReferralCode] = useState<MyReferralCodeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [userType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both analytics and referral code in parallel
      const [analyticsResponse, codeResponse] = await Promise.all([
        fetch('/api/referrals/analytics', { credentials: 'include' }),
        fetch('/api/referrals/my-code', { credentials: 'include' })
      ]);

      if (!analyticsResponse.ok) {
        throw new Error(`Failed to fetch analytics: ${analyticsResponse.statusText}`);
      }

      if (!codeResponse.ok) {
        console.error('Failed to fetch referral code:', await codeResponse.text());
        // Don't fail the whole page if just the code is missing
      } else {
        const codeData = await codeResponse.json();
        setReferralCode(codeData);
      }

      const analyticsData = await analyticsResponse.json();
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load referral data');
      console.error('Error fetching referral data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading referral analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <TrendingUp className="h-12 w-12 mx-auto opacity-50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Unable to load referral data</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchData} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return null;
  }

  const getUserTypeTitle = (type: string) => {
    switch (type) {
      case 'partner': return 'Partner Referral Dashboard';
      case 'customer': return 'Customer Referral Dashboard';
      case 'influencer': return 'Influencer Referral Dashboard';
      default: return 'Referral Dashboard';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{getUserTypeTitle(analytics.user_type)}</h1>
        <p className="text-muted-foreground mt-2">
          Track your referral performance and earnings with privacy-protected analytics
        </p>
      </div>

      {/* Display referral code if available */}
      {referralCode && <ReferralCodeDisplay codeData={referralCode} />}

      <ReferralSummaryCards analytics={analytics} />

      <Tabs defaultValue="activity" className="space-y-6">
        <TabsList>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="summary">Performance Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <ReferralActivityTable activities={analytics.recent_activity} />
        </TabsContent>

        <TabsContent value="summary">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>Your referral conversion metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Referral Accesses:</span>
                  <span className="font-medium">{analytics.summary.total_scans}</span>
                </div>
                <div className="flex justify-between">
                  <span>Account Signups:</span>
                  <span className="font-medium">{analytics.summary.total_signups}</span>
                </div>
                <div className="flex justify-between">
                  <span>Successful Purchases:</span>
                  <span className="font-medium">{analytics.summary.total_purchases}</span>
                </div>
                <div className="flex justify-between">
                  <span>Conversion Rate:</span>
                  <span className="font-medium">{analytics.summary.conversion_rate.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
                <CardDescription>Your earnings and order values</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Order Value:</span>
                  <span className="font-medium">£{analytics.summary.total_order_value.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Order Value:</span>
                  <span className="font-medium">£{analytics.summary.avg_order_value.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>
                    {analytics.user_type === 'customer' ? 'Total Rewards:' : 'Total Commissions:'}
                  </span>
                  <span className="font-medium text-green-600">
                    £{((analytics.summary.total_commissions || analytics.summary.total_rewards || 0)).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
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
        user_id: user.id
      });

      // Check if user type supports referrals
      if (!['partner', 'customer', 'influencer'].includes(user.user_type)) {
        router.push('/admin');
        return;
      }

      setUserProfile(user);
    } catch (error) {
      console.error('❌ REFERRALS: Auth check error:', error);
      setError('Authentication failed');
      setTimeout(() => router.push('/auth/login'), 1000);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading referral dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => router.push('/auth/login')} variant="outline">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <CountryProvider>
      <UserAwareNavigation userProfile={userProfile} />
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="container mx-auto px-6 py-8">
          <UserReferralContent userType={userProfile.user_type} />
        </div>
      </div>
    </CountryProvider>
  );
}