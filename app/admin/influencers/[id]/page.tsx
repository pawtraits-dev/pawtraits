'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft,
  Save,
  Check,
  X,
  Pause,
  Play,
  Instagram,
  Twitter,
  Facebook,
  Youtube,
  ExternalLink,
  Plus,
  Edit,
  Trash2,
  QrCode,
  TrendingUp,
  DollarSign,
  Users,
  Heart,
  Calendar,
  Mail,
  Phone,
  Globe
} from 'lucide-react';
import Link from 'next/link';

interface InfluencerDetail {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
  phone?: string;
  commission_rate: number;
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  is_active: boolean;
  is_verified: boolean;
  payment_method?: string;
  payment_details?: any;
  notification_preferences: {
    email_referrals: boolean;
    email_commissions: boolean;
  };
  created_at: string;
  updated_at: string;

  // Related data
  social_channels: SocialChannel[];
  referral_codes: ReferralCode[];
  recent_referrals: Referral[];

  // Stats
  stats: {
    referrals: {
      total_codes: number;
      active_codes: number;
      total_usage: number;
      total_conversions: number;
      conversion_rate: number;
    };
    financial: {
      total_revenue: number;
      total_commission_earned: number;
      commission_paid: number;
      commission_pending: number;
      avg_revenue_per_conversion: number;
    };
    social_media: {
      total_reach: number;
      avg_engagement_rate: number;
      platforms_count: number;
      platform_breakdown: { [key: string]: any };
    };
  };
}

interface SocialChannel {
  id: string;
  platform: string;
  username: string;
  profile_url?: string;
  follower_count: number;
  engagement_rate: number;
  verified: boolean;
  is_primary: boolean;
  is_active: boolean;
  last_updated: string;
  created_at: string;
}

interface ReferralCode {
  id: string;
  code: string;
  description?: string;
  usage_count: number;
  conversion_count: number;
  total_revenue: number;
  total_commission: number;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface Referral {
  id: string;
  customer_email: string;
  status: string;
  order_value: number;
  commission_amount: number;
  commission_paid: boolean;
  source_platform?: string;
  created_at: string;
  purchased_at?: string;
}

const platformIcons: { [key: string]: any } = {
  instagram: Instagram,
  twitter: Twitter,
  facebook: Facebook,
  youtube: Youtube
};

const approvalStatusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-gray-100 text-gray-800'
};

export default function AdminInfluencerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const influencerId = params.id as string;

  const [influencer, setInfluencer] = useState<InfluencerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Form state for editing
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    bio: '',
    phone: '',
    commission_rate: 10.0,
    approval_status: 'pending',
    is_active: true,
    is_verified: false,
  });

  useEffect(() => {
    loadInfluencerDetail();
  }, [influencerId]);

  const loadInfluencerDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/influencers/${influencerId}`);

      if (response.ok) {
        const data = await response.json();
        setInfluencer(data);
        setFormData({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          username: data.username || '',
          bio: data.bio || '',
          phone: data.phone || '',
          commission_rate: data.commission_rate,
          approval_status: data.approval_status,
          is_active: data.is_active,
          is_verified: data.is_verified,
        });
      } else {
        console.log('⏳ ADMIN INFLUENCER DETAIL: API endpoint not yet fully implemented, using placeholder data');

        // Placeholder data
        const mockData: InfluencerDetail = {
          id: influencerId,
          first_name: 'Emma',
          last_name: 'Johnson',
          email: 'emma@petinfluencer.com',
          username: 'emmapetlover',
          bio: 'Dog trainer and content creator sharing tips and adorable moments with over 65k followers',
          avatar_url: null,
          phone: '+1 (555) 123-4567',
          commission_rate: 10.0,
          approval_status: 'approved',
          is_active: true,
          is_verified: true,
          payment_method: 'paypal',
          payment_details: { paypal_email: 'emma@petinfluencer.com' },
          notification_preferences: {
            email_referrals: true,
            email_commissions: true
          },
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-09-20T15:30:00Z',

          social_channels: [
            {
              id: '1',
              platform: 'instagram',
              username: 'emmapetlover',
              profile_url: 'https://instagram.com/emmapetlover',
              follower_count: 65000,
              engagement_rate: 4.2,
              verified: true,
              is_primary: true,
              is_active: true,
              last_updated: '2024-09-20T12:00:00Z',
              created_at: '2024-01-15T10:00:00Z'
            },
            {
              id: '2',
              platform: 'youtube',
              username: 'EmmaPetTrainer',
              profile_url: 'https://youtube.com/emmapettrainer',
              follower_count: 18000,
              engagement_rate: 6.8,
              verified: false,
              is_primary: false,
              is_active: true,
              last_updated: '2024-09-19T09:00:00Z',
              created_at: '2024-02-01T14:00:00Z'
            },
            {
              id: '3',
              platform: 'tiktok',
              username: 'emmadogmom',
              follower_count: 25000,
              engagement_rate: 8.1,
              verified: false,
              is_primary: false,
              is_active: true,
              last_updated: '2024-09-18T16:00:00Z',
              created_at: '2024-03-10T11:00:00Z'
            }
          ],

          referral_codes: [
            {
              id: '1',
              code: 'EMMAPET20',
              description: 'Main promotion code',
              usage_count: 28,
              conversion_count: 15,
              total_revenue: 1125.50,
              total_commission: 112.55,
              is_active: true,
              created_at: '2024-02-01T10:00:00Z',
              updated_at: '2024-09-20T14:00:00Z'
            },
            {
              id: '2',
              code: 'DOGTRAINER',
              description: 'Training-focused content',
              usage_count: 17,
              conversion_count: 8,
              total_revenue: 567.25,
              total_commission: 56.73,
              is_active: true,
              created_at: '2024-05-15T12:00:00Z',
              updated_at: '2024-09-15T10:00:00Z'
            }
          ],

          recent_referrals: [
            {
              id: '1',
              customer_email: 'customer1@example.com',
              status: 'purchased',
              order_value: 89.99,
              commission_amount: 8.99,
              commission_paid: false,
              source_platform: 'instagram',
              created_at: '2024-09-20T10:00:00Z',
              purchased_at: '2024-09-20T11:30:00Z'
            },
            {
              id: '2',
              customer_email: 'customer2@example.com',
              status: 'purchased',
              order_value: 124.50,
              commission_amount: 12.45,
              commission_paid: true,
              source_platform: 'youtube',
              created_at: '2024-09-18T14:00:00Z',
              purchased_at: '2024-09-19T09:15:00Z'
            }
          ],

          stats: {
            referrals: {
              total_codes: 2,
              active_codes: 2,
              total_usage: 45,
              total_conversions: 23,
              conversion_rate: 0.511
            },
            financial: {
              total_revenue: 1692.75,
              total_commission_earned: 169.28,
              commission_paid: 95.50,
              commission_pending: 73.78,
              avg_revenue_per_conversion: 73.60
            },
            social_media: {
              total_reach: 108000,
              avg_engagement_rate: 6.37,
              platforms_count: 3,
              platform_breakdown: {
                instagram: { followers: 65000, engagement: 4.2 },
                youtube: { followers: 18000, engagement: 6.8 },
                tiktok: { followers: 25000, engagement: 8.1 }
              }
            }
          }
        };

        setInfluencer(mockData);
        setFormData({
          first_name: mockData.first_name,
          last_name: mockData.last_name,
          email: mockData.email,
          username: mockData.username || '',
          bio: mockData.bio || '',
          phone: mockData.phone || '',
          commission_rate: mockData.commission_rate,
          approval_status: mockData.approval_status,
          is_active: mockData.is_active,
          is_verified: mockData.is_verified,
        });
      }
    } catch (error) {
      console.error('Error loading influencer detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveInfluencer = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/admin/influencers/${influencerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadInfluencerDetail(); // Reload data
        alert('Influencer updated successfully');
      } else {
        console.log('⏳ ADMIN INFLUENCER DETAIL: Update API not yet implemented');
        alert('Update API not yet implemented');
      }
    } catch (error) {
      console.error('Error saving influencer:', error);
      alert('Error saving influencer');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status: 'approved' | 'rejected' | 'suspended') => {
    try {
      const response = await fetch(`/api/admin/influencers/${influencerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_status: status })
      });

      if (response.ok) {
        await loadInfluencerDetail();
      } else {
        console.log('⏳ ADMIN INFLUENCER DETAIL: Status update API not yet implemented');
        alert('Status update API not yet implemented');
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const Icon = platformIcons[platform.toLowerCase()];
    return Icon || ExternalLink;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  if (!influencer) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Influencer Not Found</h2>
          <p className="text-gray-600 mb-4">The influencer you're looking for doesn't exist.</p>
          <Button asChild>
            <Link href="/admin/influencers">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Influencers
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" asChild>
            <Link href="/admin/influencers">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {influencer.first_name} {influencer.last_name}
            </h1>
            <div className="flex items-center space-x-2 mt-1">
              <Badge className={approvalStatusColors[influencer.approval_status]}>
                {influencer.approval_status}
              </Badge>
              {influencer.is_verified && (
                <Badge className="bg-blue-100 text-blue-800">Verified</Badge>
              )}
              {!influencer.is_active && (
                <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {influencer.approval_status === 'pending' && (
            <>
              <Button onClick={() => updateStatus('approved')} className="bg-green-600 hover:bg-green-700">
                <Check className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button onClick={() => updateStatus('rejected')} variant="destructive">
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          {influencer.approval_status === 'approved' && (
            <Button onClick={() => updateStatus('suspended')} variant="outline">
              <Pause className="w-4 h-4 mr-2" />
              Suspend
            </Button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Heart className="w-8 h-8 text-pink-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Reach</p>
                <p className="text-2xl font-bold text-gray-900">
                  {influencer.stats.social_media.total_reach.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(influencer.stats.referrals.conversion_rate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Commission Earned</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${influencer.stats.financial.total_commission_earned.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <QrCode className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Active Codes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {influencer.stats.referrals.active_codes}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="social">Social Channels</TabsTrigger>
          <TabsTrigger value="codes">Referral Codes</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{influencer.email}</span>
                </div>
                {influencer.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{influencer.phone}</span>
                  </div>
                )}
                {influencer.username && (
                  <div className="flex items-center space-x-3">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <span>@{influencer.username}</span>
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>Joined {new Date(influencer.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Revenue Generated:</span>
                  <span className="font-medium">${influencer.stats.financial.total_revenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Commission:</span>
                  <span className="font-medium">${influencer.stats.financial.total_commission_earned.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Commission Paid:</span>
                  <span className="font-medium text-green-600">${influencer.stats.financial.commission_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Commission Pending:</span>
                  <span className="font-medium text-yellow-600">${influencer.stats.financial.commission_pending.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span>Commission Rate:</span>
                  <span className="font-medium">{influencer.commission_rate}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bio */}
          {influencer.bio && (
            <Card>
              <CardHeader>
                <CardTitle>Bio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{influencer.bio}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Edit Profile</CardTitle>
              <CardDescription>
                Update influencer information and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                  <Input
                    id="commission_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="approval_status">Approval Status</Label>
                  <select
                    id="approval_status"
                    value={formData.approval_status}
                    onChange={(e) => setFormData({ ...formData, approval_status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_verified"
                    checked={formData.is_verified}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_verified: checked })}
                  />
                  <Label htmlFor="is_verified">Verified</Label>
                </div>
              </div>

              <Button onClick={saveInfluencer} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700">
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Channels Tab */}
        <TabsContent value="social" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Social Media Channels
                <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Channel
                </Button>
              </CardTitle>
              <CardDescription>
                Manage connected social media accounts and track performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {influencer.social_channels.map((channel) => {
                  const Icon = getPlatformIcon(channel.platform);
                  return (
                    <div key={channel.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <Icon className="w-8 h-8 text-yellow-600" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold capitalize">{channel.platform}</h3>
                              {channel.verified && (
                                <Badge className="bg-blue-100 text-blue-800">Verified</Badge>
                              )}
                              {channel.is_primary && (
                                <Badge className="bg-yellow-100 text-yellow-800">Primary</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">@{channel.username}</p>
                            {channel.profile_url && (
                              <a
                                href={channel.profile_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline flex items-center"
                              >
                                View Profile <ExternalLink className="w-3 h-3 ml-1" />
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-6">
                          <div className="text-center">
                            <p className="text-lg font-semibold">{channel.follower_count.toLocaleString()}</p>
                            <p className="text-sm text-gray-600">followers</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold">{channel.engagement_rate.toFixed(1)}%</p>
                            <p className="text-sm text-gray-600">engagement</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referral Codes Tab */}
        <TabsContent value="codes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Referral Codes
                <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Code
                </Button>
              </CardTitle>
              <CardDescription>
                Manage referral codes and track performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {influencer.referral_codes.map((code) => (
                  <div key={code.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <code className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-mono">
                            {code.code}
                          </code>
                          <Badge className={code.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {code.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {code.description && (
                          <p className="text-sm text-gray-600 mt-1">{code.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Created {new Date(code.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium">{code.usage_count}</p>
                            <p className="text-gray-500">uses</p>
                          </div>
                          <div>
                            <p className="font-medium">{code.conversion_count}</p>
                            <p className="text-gray-500">conversions</p>
                          </div>
                          <div>
                            <p className="font-medium">${code.total_revenue.toFixed(2)}</p>
                            <p className="text-gray-500">revenue</p>
                          </div>
                          <div>
                            <p className="font-medium text-green-600">${code.total_commission.toFixed(2)}</p>
                            <p className="text-gray-500">commission</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Referral Activity</CardTitle>
              <CardDescription>
                Latest referrals and conversions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {influencer.recent_referrals.map((referral) => (
                  <div key={referral.id} className="border-l-4 border-yellow-200 pl-4 py-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{referral.customer_email}</p>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Badge className="text-xs">
                            {referral.status}
                          </Badge>
                          {referral.source_platform && (
                            <span className="capitalize">from {referral.source_platform}</span>
                          )}
                          <span>•</span>
                          <span>{new Date(referral.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${referral.order_value.toFixed(2)}</p>
                        <p className="text-sm text-green-600">
                          ${referral.commission_amount.toFixed(2)} commission
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}