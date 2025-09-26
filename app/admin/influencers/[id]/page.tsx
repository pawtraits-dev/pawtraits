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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  Globe,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import Link from 'next/link';
import { qrCodeService } from '@/lib/qr-code';

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
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [addingChannel, setAddingChannel] = useState(false);
  const [showAddCodeModal, setShowAddCodeModal] = useState(false);
  const [addingCode, setAddingCode] = useState(false);
  const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({}); // Store QR codes by referral code ID
  const [showQrCode, setShowQrCode] = useState<{ [key: string]: boolean }>({}); // Track which QR codes are visible
  const [generatingQr, setGeneratingQr] = useState<{ [key: string]: boolean }>({}); // Track QR generation loading state

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

  // Form state for adding social channel
  const [channelFormData, setChannelFormData] = useState({
    platform: '',
    username: '',
    profile_url: '',
    follower_count: 0,
    engagement_rate: 0,
    verified: false,
    is_primary: false,
    is_active: true,
  });

  // Auto-fetch state
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoFetchResult, setAutoFetchResult] = useState<string | null>(null);

  // Edit/Delete social channel state
  const [showEditChannelModal, setShowEditChannelModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<any>(null);
  const [updatingChannel, setUpdatingChannel] = useState(false);
  const [deletingChannel, setDeletingChannel] = useState<string | null>(null);

  // Form state for adding referral code
  const [codeFormData, setCodeFormData] = useState({
    code: '',
    description: '',
    expires_at: '',
    is_active: true,
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

  const addSocialChannel = async () => {
    try {
      setAddingChannel(true);
      const response = await fetch(`/api/admin/influencers/${influencerId}/social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channelFormData)
      });

      if (response.ok) {
        await loadInfluencerDetail(); // Reload data
        setShowAddChannelModal(false);
        setChannelFormData({
          platform: '',
          username: '',
          profile_url: '',
          follower_count: 0,
          engagement_rate: 0,
          verified: false,
          is_primary: false,
          is_active: true,
        });
        alert('Social channel added successfully');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to add social channel'}`);
      }
    } catch (error) {
      console.error('Error adding social channel:', error);
      alert('Error adding social channel');
    } finally {
      setAddingChannel(false);
    }
  };

  const addReferralCode = async () => {
    try {
      setAddingCode(true);
      const response = await fetch(`/api/admin/influencers/${influencerId}/codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: codeFormData.code,
          description: codeFormData.description || null,
          expires_at: codeFormData.expires_at || null,
          is_active: codeFormData.is_active,
        })
      });

      if (response.ok) {
        await loadInfluencerDetail(); // Reload data
        setShowAddCodeModal(false);
        setCodeFormData({
          code: '',
          description: '',
          expires_at: '',
          is_active: true,
        });
        alert('Referral code created successfully');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to create referral code'}`);
      }
    } catch (error) {
      console.error('Error creating referral code:', error);
      alert('Error creating referral code');
    } finally {
      setAddingCode(false);
    }
  };

  // QR code functions
  const generateQRCode = async (codeId: string, referralCode: string) => {
    try {
      setGeneratingQr(prev => ({ ...prev, [codeId]: true }));

      // Generate QR code data URL
      const qrDataURL = await qrCodeService.generateReferralQRDataURL(referralCode);

      setQrCodes(prev => ({ ...prev, [codeId]: qrDataURL }));
      setShowQrCode(prev => ({ ...prev, [codeId]: true }));
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code');
    } finally {
      setGeneratingQr(prev => ({ ...prev, [codeId]: false }));
    }
  };

  const toggleQRCode = async (codeId: string, referralCode: string) => {
    if (showQrCode[codeId]) {
      // Hide QR code
      setShowQrCode(prev => ({ ...prev, [codeId]: false }));
    } else {
      // Show QR code - generate if not exists
      if (!qrCodes[codeId]) {
        await generateQRCode(codeId, referralCode);
      } else {
        setShowQrCode(prev => ({ ...prev, [codeId]: true }));
      }
    }
  };

  const copyReferralURL = (referralCode: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pawtraits.pics';
    const referralUrl = `${baseUrl}/r/${referralCode}`;

    navigator.clipboard.writeText(referralUrl).then(() => {
      // Show temporary success message
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

  const autoFetchSocialData = async () => {
    if (!channelFormData.platform || !channelFormData.username) {
      setAutoFetchResult('Please select a platform and enter a username first');
      return;
    }

    setAutoFetching(true);
    setAutoFetchResult(null);

    try {
      const response = await fetch('/api/social-media/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: channelFormData.platform,
          username: channelFormData.username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch social media data');
      }

      if (data.error) {
        setAutoFetchResult(`Error: ${data.error}`);
        return;
      }

      // Update form with fetched data
      setChannelFormData(prev => ({
        ...prev,
        profile_url: data.profile_url || prev.profile_url,
        follower_count: data.follower_count || prev.follower_count,
        engagement_rate: data.engagement_rate || prev.engagement_rate,
        verified: data.verified !== null ? data.verified : prev.verified,
      }));

      const successMessage = [];
      if (data.follower_count) successMessage.push(`${data.follower_count.toLocaleString()} followers`);
      if (data.post_count) successMessage.push(`${data.post_count.toLocaleString()} posts`);
      if (data.verified) successMessage.push('verified account');

      setAutoFetchResult(`✓ Fetched: ${successMessage.length > 0 ? successMessage.join(', ') : 'Profile validated'}`);
    } catch (error) {
      console.error('Error auto-fetching social data:', error);
      setAutoFetchResult(`Error: ${error instanceof Error ? error.message : 'Failed to fetch data'}`);
    } finally {
      setAutoFetching(false);
    }
  };

  const startEditChannel = (channel: any) => {
    setEditingChannel(channel);
    setChannelFormData({
      platform: channel.platform,
      username: channel.username,
      profile_url: channel.profile_url || '',
      follower_count: channel.follower_count || 0,
      engagement_rate: channel.engagement_rate || 0,
      verified: channel.verified || false,
      is_primary: channel.is_primary || false,
      is_active: channel.is_active !== false,
    });
    setShowEditChannelModal(true);
  };

  const updateSocialChannel = async () => {
    if (!editingChannel) return;

    setUpdatingChannel(true);
    try {
      const response = await fetch(`/api/admin/influencers/${params.id}/channels/${editingChannel.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...channelFormData,
          follower_count: parseInt(channelFormData.follower_count?.toString() || '0') || 0,
          engagement_rate: parseFloat(channelFormData.engagement_rate?.toString() || '0') || 0,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update social channel: ${error}`);
      }

      // Reload influencer data
      await loadInfluencerData();
      setShowEditChannelModal(false);
      setEditingChannel(null);
      setChannelFormData({
        platform: '',
        username: '',
        profile_url: '',
        follower_count: 0,
        engagement_rate: 0,
        verified: false,
        is_primary: false,
        is_active: true,
      });
    } catch (error) {
      console.error('Error updating social channel:', error);
      alert(error instanceof Error ? error.message : 'Failed to update social channel');
    } finally {
      setUpdatingChannel(false);
    }
  };

  const deleteSocialChannel = async (channelId: string) => {
    if (!confirm('Are you sure you want to delete this social channel?')) {
      return;
    }

    setDeletingChannel(channelId);
    try {
      const response = await fetch(`/api/admin/influencers/${params.id}/channels/${channelId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete social channel: ${error}`);
      }

      // Reload influencer data
      await loadInfluencerData();
    } catch (error) {
      console.error('Error deleting social channel:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete social channel');
    } finally {
      setDeletingChannel(null);
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
                  {((influencer.stats?.referrals?.conversion_rate || 0) * 100).toFixed(1)}%
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
                  ${(influencer.stats?.financial?.total_commission_earned || 0).toFixed(2)}
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
                  <span className="font-medium">${(influencer.stats?.financial?.total_revenue || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Commission:</span>
                  <span className="font-medium">${(influencer.stats?.financial?.total_commission_earned || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Commission Paid:</span>
                  <span className="font-medium text-green-600">${(influencer.stats?.financial?.commission_paid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Commission Pending:</span>
                  <span className="font-medium text-yellow-600">${(influencer.stats?.financial?.commission_pending || 0).toFixed(2)}</span>
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
                <Button
                  size="sm"
                  className="bg-yellow-600 hover:bg-yellow-700"
                  onClick={() => setShowAddChannelModal(true)}
                >
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
                            <p className="text-lg font-semibold">{(channel.follower_count || 0).toLocaleString()}</p>
                            <p className="text-sm text-gray-600">followers</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold">{(channel.engagement_rate || 0).toFixed(1)}%</p>
                            <p className="text-sm text-gray-600">engagement</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditChannel(channel)}
                              title="Edit social channel"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => deleteSocialChannel(channel.id)}
                              disabled={deletingChannel === channel.id}
                              title="Delete social channel"
                            >
                              {deletingChannel === channel.id ? (
                                <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
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
              <CardTitle>
                Referral Codes
              </CardTitle>
              <CardDescription>
                Manage referral codes and track performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {influencer.referral_codes.map((code) => {
                  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pawtraits.pics';
                  const referralUrl = `${baseUrl}/r/${code.code}`;

                  return (
                    <div key={code.id} className="border rounded-lg p-6 bg-gradient-to-r from-yellow-50 to-amber-50">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <code className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md text-lg font-mono font-bold">
                              {code.code}
                            </code>
                            <Badge className={code.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                              {code.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          {code.description && (
                            <p className="text-sm text-gray-700 mb-2">{code.description}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            Created {new Date(code.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        {/* QR Code and Actions */}
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyReferralURL(code.code)}
                            className="flex items-center space-x-1"
                          >
                            <Copy className="w-4 h-4" />
                            <span>Copy URL</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleQRCode(code.id, code.code)}
                            disabled={generatingQr[code.id]}
                            className="flex items-center space-x-1"
                          >
                            {generatingQr[code.id] ? (
                              <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                            ) : showQrCode[code.id] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                            <span>{showQrCode[code.id] ? 'Hide QR' : 'Show QR'}</span>
                          </Button>
                        </div>
                      </div>

                      {/* Referral URL Display */}
                      <div className="mb-4">
                        <Label className="text-xs text-gray-600">Referral URL:</Label>
                        <div className="mt-1 p-2 bg-white border rounded-md font-mono text-sm text-gray-700 break-all">
                          {referralUrl}
                        </div>
                      </div>

                      {/* QR Code Display */}
                      {showQrCode[code.id] && qrCodes[code.id] && (
                        <div className="mb-4 text-center">
                          <div className="inline-block p-4 bg-white rounded-lg shadow-sm border">
                            <img
                              src={qrCodes[code.id]}
                              alt={`QR Code for ${code.code}`}
                              className="w-48 h-48 mx-auto"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                              Scan to access referral link
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Stats Grid */}
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div className="p-3 bg-white rounded-md border">
                          <p className="text-lg font-semibold text-gray-900">{code.usage_count}</p>
                          <p className="text-sm text-gray-500">Uses</p>
                        </div>
                        <div className="p-3 bg-white rounded-md border">
                          <p className="text-lg font-semibold text-gray-900">{code.conversion_count}</p>
                          <p className="text-sm text-gray-500">Conversions</p>
                        </div>
                        <div className="p-3 bg-white rounded-md border">
                          <p className="text-lg font-semibold text-gray-900">${(code.total_revenue || 0).toFixed(2)}</p>
                          <p className="text-sm text-gray-500">Revenue</p>
                        </div>
                        <div className="p-3 bg-white rounded-md border bg-green-50">
                          <p className="text-lg font-semibold text-green-600">${(code.total_commission || 0).toFixed(2)}</p>
                          <p className="text-sm text-gray-500">Commission</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                        <p className="font-medium">${(referral.order_value || 0).toFixed(2)}</p>
                        <p className="text-sm text-green-600">
                          ${(referral.commission_amount || 0).toFixed(2)} commission
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

      {/* Add Social Channel Modal */}
      <Dialog open={showAddChannelModal} onOpenChange={setShowAddChannelModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Social Channel</DialogTitle>
            <DialogDescription>
              Add a new social media channel for this influencer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="platform">Platform *</Label>
              <select
                id="platform"
                value={channelFormData.platform}
                onChange={(e) => {
                  setChannelFormData({ ...channelFormData, platform: e.target.value });
                  setAutoFetchResult(null); // Clear previous result when platform changes
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a platform</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="twitter">Twitter</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="pinterest">Pinterest</option>
              </select>
            </div>

            <div>
              <Label htmlFor="channel_username">Username *</Label>
              <div className="flex space-x-2">
                <Input
                  id="channel_username"
                  value={channelFormData.username}
                  onChange={(e) => {
                    setChannelFormData({ ...channelFormData, username: e.target.value });
                    setAutoFetchResult(null); // Clear previous result when username changes
                  }}
                  placeholder="@username"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={autoFetchSocialData}
                  disabled={autoFetching || !channelFormData.platform || !channelFormData.username}
                  className="whitespace-nowrap"
                >
                  {autoFetching ? (
                    <>
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 mr-2"></div>
                      Fetching...
                    </>
                  ) : (
                    <>🔍 Auto-Fetch</>
                  )}
                </Button>
              </div>
              {autoFetchResult && (
                <p className={`text-xs mt-1 ${
                  autoFetchResult.startsWith('✓') ? 'text-green-600' : autoFetchResult.startsWith('Error') ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {autoFetchResult}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="profile_url">Profile URL</Label>
              <Input
                id="profile_url"
                value={channelFormData.profile_url}
                onChange={(e) => setChannelFormData({ ...channelFormData, profile_url: e.target.value })}
                placeholder="https://platform.com/username"
                className={channelFormData.profile_url && !channelFormData.profile_url.startsWith('http') ? 'border-yellow-500' : ''}
              />
              {channelFormData.profile_url && !channelFormData.profile_url.startsWith('http') && (
                <p className="text-xs text-yellow-600 mt-1">URL should start with https://</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="follower_count">Followers</Label>
                <Input
                  id="follower_count"
                  type="number"
                  min="0"
                  value={channelFormData.follower_count}
                  onChange={(e) => setChannelFormData({ ...channelFormData, follower_count: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="engagement_rate">Engagement Rate (%)</Label>
                <Input
                  id="engagement_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={channelFormData.engagement_rate}
                  onChange={(e) => setChannelFormData({ ...channelFormData, engagement_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="verified"
                  checked={channelFormData.verified}
                  onCheckedChange={(checked) => setChannelFormData({ ...channelFormData, verified: checked })}
                />
                <Label htmlFor="verified">Verified</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_primary"
                  checked={channelFormData.is_primary}
                  onCheckedChange={(checked) => setChannelFormData({ ...channelFormData, is_primary: checked })}
                />
                <Label htmlFor="is_primary">Primary</Label>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddChannelModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={addSocialChannel}
                disabled={addingChannel || !channelFormData.platform || !channelFormData.username}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {addingChannel ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Channel
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Social Channel Modal */}
      <Dialog open={showEditChannelModal} onOpenChange={setShowEditChannelModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Social Channel</DialogTitle>
            <DialogDescription>
              Update the social media channel information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit_platform">Platform *</Label>
              <select
                id="edit_platform"
                value={channelFormData.platform}
                onChange={(e) => {
                  setChannelFormData({ ...channelFormData, platform: e.target.value });
                  setAutoFetchResult(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a platform</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="twitter">Twitter</option>
                <option value="facebook">Facebook</option>
                <option value="linkedin">LinkedIn</option>
                <option value="pinterest">Pinterest</option>
              </select>
            </div>

            <div>
              <Label htmlFor="edit_channel_username">Username *</Label>
              <div className="flex space-x-2">
                <Input
                  id="edit_channel_username"
                  value={channelFormData.username}
                  onChange={(e) => {
                    setChannelFormData({ ...channelFormData, username: e.target.value });
                    setAutoFetchResult(null);
                  }}
                  placeholder="@username"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={autoFetchSocialData}
                  disabled={autoFetching || !channelFormData.platform || !channelFormData.username}
                  className="whitespace-nowrap"
                >
                  {autoFetching ? (
                    <>
                      <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 mr-2"></div>
                      Fetching...
                    </>
                  ) : (
                    <>🔍 Auto-Fetch</>
                  )}
                </Button>
              </div>
              {autoFetchResult && (
                <p className={`text-xs mt-1 ${
                  autoFetchResult.startsWith('✓') ? 'text-green-600' : autoFetchResult.startsWith('Error') ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {autoFetchResult}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="edit_profile_url">Profile URL</Label>
              <Input
                id="edit_profile_url"
                value={channelFormData.profile_url}
                onChange={(e) => setChannelFormData({ ...channelFormData, profile_url: e.target.value })}
                placeholder="https://platform.com/username"
                className={channelFormData.profile_url && !channelFormData.profile_url.startsWith('http') ? 'border-yellow-500' : ''}
              />
              {channelFormData.profile_url && !channelFormData.profile_url.startsWith('http') && (
                <p className="text-xs text-yellow-600 mt-1">URL should start with https://</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_follower_count">Followers</Label>
                <Input
                  id="edit_follower_count"
                  type="number"
                  min="0"
                  value={channelFormData.follower_count}
                  onChange={(e) => setChannelFormData({ ...channelFormData, follower_count: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="edit_engagement_rate">Engagement Rate (%)</Label>
                <Input
                  id="edit_engagement_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={channelFormData.engagement_rate}
                  onChange={(e) => setChannelFormData({ ...channelFormData, engagement_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_verified"
                  checked={channelFormData.verified}
                  onCheckedChange={(checked) => setChannelFormData({ ...channelFormData, verified: checked })}
                />
                <Label htmlFor="edit_verified">Verified</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_primary"
                  checked={channelFormData.is_primary}
                  onCheckedChange={(checked) => setChannelFormData({ ...channelFormData, is_primary: checked })}
                />
                <Label htmlFor="edit_is_primary">Primary</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_active"
                  checked={channelFormData.is_active}
                  onCheckedChange={(checked) => setChannelFormData({ ...channelFormData, is_active: checked })}
                />
                <Label htmlFor="edit_is_active">Active</Label>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditChannelModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={updateSocialChannel}
                disabled={updatingChannel || !channelFormData.platform || !channelFormData.username}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updatingChannel ? (
                  <>
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                    Updating...
                  </>
                ) : (
                  'Update Channel'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Referral Code Modal */}
      <Dialog open={showAddCodeModal} onOpenChange={setShowAddCodeModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Referral Code</DialogTitle>
            <DialogDescription>
              Create a new referral code for this influencer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="referral_code">Referral Code *</Label>
              <Input
                id="referral_code"
                value={codeFormData.code}
                onChange={(e) => setCodeFormData({ ...codeFormData, code: e.target.value.toUpperCase() })}
                placeholder="INFLUENCER10"
                className={`uppercase ${
                  codeFormData.code && (codeFormData.code.length < 6 || !/^[A-Za-z0-9]+$/.test(codeFormData.code))
                    ? 'border-red-500'
                    : codeFormData.code.length >= 6 && /^[A-Za-z0-9]+$/.test(codeFormData.code)
                    ? 'border-green-500'
                    : ''
                }`}
                style={{ textTransform: 'uppercase' }}
              />
              <p className={`text-xs mt-1 ${
                codeFormData.code && (codeFormData.code.length < 6 || !/^[A-Za-z0-9]+$/.test(codeFormData.code))
                  ? 'text-red-500'
                  : codeFormData.code.length >= 6 && /^[A-Za-z0-9]+$/.test(codeFormData.code)
                  ? 'text-green-500'
                  : 'text-gray-500'
              }`}>
                {codeFormData.code && codeFormData.code.length < 6
                  ? `Need ${6 - codeFormData.code.length} more characters`
                  : codeFormData.code && !/^[A-Za-z0-9]+$/.test(codeFormData.code)
                  ? 'Only letters and numbers allowed - no spaces, dashes, or special characters'
                  : codeFormData.code.length >= 6 && /^[A-Za-z0-9]+$/.test(codeFormData.code)
                  ? 'Valid referral code ✓'
                  : 'Minimum 6 characters. Letters and numbers only - no spaces, dashes, or special characters. (Automatically converted to uppercase)'
                }
              </p>
            </div>

            <div>
              <Label htmlFor="code_description">Description</Label>
              <Textarea
                id="code_description"
                value={codeFormData.description}
                onChange={(e) => setCodeFormData({ ...codeFormData, description: e.target.value })}
                placeholder="Describe this code or campaign..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="expires_at">Expiration Date (Optional)</Label>
              <Input
                id="expires_at"
                type="date"
                value={codeFormData.expires_at}
                onChange={(e) => setCodeFormData({ ...codeFormData, expires_at: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank for no expiration
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="code_active"
                checked={codeFormData.is_active}
                onCheckedChange={(checked) => setCodeFormData({ ...codeFormData, is_active: checked })}
              />
              <Label htmlFor="code_active">Active</Label>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddCodeModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={addReferralCode}
                disabled={addingCode || !codeFormData.code || codeFormData.code.length < 6 || !/^[A-Za-z0-9]+$/.test(codeFormData.code)}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {addingCode ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Code
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}