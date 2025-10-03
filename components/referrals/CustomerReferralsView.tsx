'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Share2,
  Copy,
  Download,
  Users,
  ShoppingBag,
  Gift,
  TrendingUp,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  QrCode
} from 'lucide-react';
import QRCode from 'qrcode';

// 🏗️ CUSTOMER REFERRALS VIEW COMPONENT
// User-type specific view for customer referrals page
// Shows customer's referral code, rewards earned, and redemption history

interface CustomerReferralsViewProps {
  userProfile: any;
}

interface ReferralCode {
  code: string;
  qr_code_url: string | null;
  type: 'personal';
  share_url: string;
}

interface ReferralActivity {
  id: string;
  type: 'signup' | 'purchase';
  date: string;
  customer_name: string;
  reward: number;
  status: string;
}

interface RewardRecord {
  id: string;
  customer_id: string;
  friend_customer_id: string;
  order_id: string | null;
  reward_amount: number;
  reward_type: 'signup' | 'purchase';
  status: 'pending' | 'earned' | 'redeemed';
  created_at: string;
  redeemed_at: string | null;
}

interface RedemptionRecord {
  id: string;
  customer_id: string;
  order_id: string;
  credits_used: number;
  order_total: number;
  redeemed_at: string;
}

interface CustomerReferralData {
  user_type: string;
  customer_name: string;
  primary_code: ReferralCode | null;
  summary: {
    total_friends_referred: number;
    total_friends_purchased: number;
    total_rewards_earned: number;
    pending_rewards: number;
    available_balance: number;
    total_redeemed: number;
  };
  recent_activity: ReferralActivity[];
  rewards: RewardRecord[];
}

// Referral Code Display Component
function ReferralCodeDisplay({ code }: { code: ReferralCode | null }) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (code) {
      const fullUrl = `${window.location.origin}${code.share_url}`;
      QRCode.toDataURL(fullUrl, { width: 200 })
        .then(setQrCodeDataUrl)
        .catch(console.error);
    }
  }, [code]);

  const handleCopy = () => {
    if (code) {
      const fullUrl = `${window.location.origin}${code.share_url}`;
      navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (code && navigator.share) {
      try {
        await navigator.share({
          title: 'Join Pawtraits!',
          text: 'Get amazing AI-generated pet portraits! Use my referral code to get started.',
          url: `${window.location.origin}${code.share_url}`
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    }
  };

  const handleDownloadQR = () => {
    if (qrCodeDataUrl) {
      const link = document.createElement('a');
      link.href = qrCodeDataUrl;
      link.download = `pawtraits-referral-${code?.code}.png`;
      link.click();
    }
  };

  if (!code) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
        <CardContent className="pt-6">
          <p className="text-gray-600 text-center">No referral code available</p>
        </CardContent>
      </Card>
    );
  }

  const fullUrl = `${window.location.origin}${code.share_url}`;

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
      <CardHeader>
        <CardTitle>Your Referral Code</CardTitle>
        <CardDescription>Share with friends to earn rewards!</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between bg-white p-4 rounded-lg">
          <div>
            <p className="text-sm text-gray-600 mb-1">Referral Code</p>
            <p className="text-2xl font-bold text-purple-600">{code.code}</p>
            <p className="text-xs text-gray-500 mt-1">{fullUrl}</p>
          </div>
          {qrCodeDataUrl && (
            <div className="flex flex-col items-center gap-2">
              <img src={qrCodeDataUrl} alt="QR Code" className="w-24 h-24" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadQR}
                className="text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleCopy}
            variant="outline"
            className="flex-1"
          >
            <Copy className="w-4 h-4 mr-2" />
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          {navigator.share && (
            <Button
              onClick={handleShare}
              variant="outline"
              className="flex-1"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> When your friends sign up using your code, you earn £5 credit.
            When they make their first purchase, you earn an additional £10 credit!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerReferralsView({ userProfile }: CustomerReferralsViewProps) {
  const [referralData, setReferralData] = useState<CustomerReferralData | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(true);
  const [loadingRedemptions, setLoadingRedemptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rewardFilter, setRewardFilter] = useState<'all' | 'earned' | 'pending' | 'redeemed'>('all');

  useEffect(() => {
    fetchReferralData();
    fetchRedemptions();
  }, []);

  const fetchReferralData = async () => {
    try {
      setLoadingReferrals(true);

      // TODO: Create /api/customers/referrals endpoint
      const response = await fetch(`/api/customers/referrals?email=${userProfile.email}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch referral data');
      }

      const data = await response.json();
      setReferralData(data);
    } catch (err) {
      console.error('Error fetching referral data:', err);
      setError('Failed to load referral data');
    } finally {
      setLoadingReferrals(false);
    }
  };

  const fetchRedemptions = async () => {
    try {
      setLoadingRedemptions(true);

      // TODO: Create /api/customers/redemptions endpoint
      const response = await fetch(`/api/customers/redemptions?email=${userProfile.email}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch redemptions');
      }

      const data = await response.json();
      setRedemptions(data.redemptions || []);
    } catch (err) {
      console.error('Error fetching redemptions:', err);
    } finally {
      setLoadingRedemptions(false);
    }
  };

  const filteredRewards = referralData?.rewards.filter(reward => {
    if (rewardFilter === 'all') return true;
    return reward.status === rewardFilter;
  }) || [];

  if (loadingReferrals) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !referralData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">{error || 'Failed to load referral data'}</p>
            <Button onClick={fetchReferralData} className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Referral Program
          </h1>
          <p className="text-gray-600">
            Share your love for Pawtraits and earn rewards!
          </p>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="referrals" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white">
            <TabsTrigger value="referrals">
              <Users className="w-4 h-4 mr-2" />
              Referrals & Activity
            </TabsTrigger>
            <TabsTrigger value="rewards">
              <Gift className="w-4 h-4 mr-2" />
              Rewards
            </TabsTrigger>
            <TabsTrigger value="redemptions">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Redemptions
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Referrals & Activity */}
          <TabsContent value="referrals" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Referral Code Card */}
              <div>
                <ReferralCodeDisplay code={referralData.primary_code} />
              </div>

              {/* Performance Metrics */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Your Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-600" />
                        <span className="text-sm text-gray-600">Friends Referred</span>
                      </div>
                      <span className="text-2xl font-bold text-purple-600">
                        {referralData.summary.total_friends_referred}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-gray-600">Friends Purchased</span>
                      </div>
                      <span className="text-2xl font-bold text-green-600">
                        {referralData.summary.total_friends_purchased}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <span className="text-sm text-gray-600">Conversion Rate</span>
                      </div>
                      <span className="text-2xl font-bold text-blue-600">
                        {referralData.summary.total_friends_referred > 0
                          ? Math.round((referralData.summary.total_friends_purchased / referralData.summary.total_friends_referred) * 100)
                          : 0}%
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
                  <CardHeader>
                    <CardTitle className="text-lg">Available Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-green-600">
                      £{referralData.summary.available_balance.toFixed(2)}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Ready to use on your next purchase!
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest referral events</CardDescription>
              </CardHeader>
              <CardContent>
                {referralData.recent_activity.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No referral activity yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Share your referral code to get started!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referralData.recent_activity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${
                            activity.type === 'purchase'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {activity.type === 'purchase' ? (
                              <ShoppingBag className="w-5 h-5" />
                            ) : (
                              <Users className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {activity.customer_name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {activity.type === 'purchase' ? 'Made a purchase' : 'Signed up'}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(activity.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={activity.status === 'earned' ? 'default' : 'secondary'}>
                            {activity.status}
                          </Badge>
                          <p className="text-lg font-bold text-green-600 mt-1">
                            +£{activity.reward.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Rewards */}
          <TabsContent value="rewards" className="space-y-6">
            {/* Reward Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Total Earned</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    £{referralData.summary.total_rewards_earned.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Available Balance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    £{referralData.summary.available_balance.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Pending Rewards</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    £{referralData.summary.pending_rewards.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Total Redeemed</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    £{referralData.summary.total_redeemed.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Reward Status Filter */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Reward History</CardTitle>
                    <CardDescription>Track your earnings from referrals</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={rewardFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRewardFilter('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={rewardFilter === 'earned' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRewardFilter('earned')}
                    >
                      Earned
                    </Button>
                    <Button
                      variant={rewardFilter === 'pending' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRewardFilter('pending')}
                    >
                      Pending
                    </Button>
                    <Button
                      variant={rewardFilter === 'redeemed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRewardFilter('redeemed')}
                    >
                      Redeemed
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredRewards.length === 0 ? (
                  <div className="text-center py-8">
                    <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No rewards found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredRewards.map((reward) => (
                          <tr key={reward.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(reward.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <Badge variant="outline">
                                {reward.reward_type === 'signup' ? 'Sign-up Bonus' : 'Purchase Bonus'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <Badge variant={
                                reward.status === 'earned' ? 'default' :
                                reward.status === 'pending' ? 'secondary' :
                                'outline'
                              }>
                                {reward.status === 'earned' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                {reward.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                                {reward.status.charAt(0).toUpperCase() + reward.status.slice(1)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">
                              £{reward.reward_amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Redemptions */}
          <TabsContent value="redemptions" className="space-y-6">
            {/* Redemption Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Total Redemptions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    {redemptions.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Credits Used</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    £{redemptions.reduce((sum, r) => sum + r.credits_used, 0).toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Total Savings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    £{redemptions.reduce((sum, r) => sum + r.credits_used, 0).toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Redemption History */}
            <Card>
              <CardHeader>
                <CardTitle>Redemption History</CardTitle>
                <CardDescription>Credits you've used on orders</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRedemptions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-4 border-purple-600 border-t-transparent rounded-full"></div>
                  </div>
                ) : redemptions.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No redemptions yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Use your available balance on your next purchase!
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Order Total</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credits Used</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {redemptions.map((redemption) => (
                          <tr key={redemption.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {new Date(redemption.redeemed_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-gray-600">
                              {redemption.order_id.substring(0, 8)}...
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              £{redemption.order_total.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-orange-600 text-right">
                              -£{redemption.credits_used.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-green-600 text-right">
                              £{(redemption.order_total - redemption.credits_used).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// 📋 COMPONENT CHECKLIST:
// ✅ No direct database queries
// ✅ Uses API endpoints for all data access
// ✅ Client-side component with proper authentication
// ✅ Three-tab structure matching requirements
// ✅ Customer-specific terminology (rewards, credits, redemptions)
// ✅ Proper error handling and loading states
// ✅ Responsive design with Tailwind CSS
