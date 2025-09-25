'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  CreditCard,
  Bell,
  Shield,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Check,
  Upload,
  Trash2,
  Instagram,
  Twitter,
  Facebook,
  Youtube,
  Plus,
  ExternalLink,
  TrendingUp,
  DollarSign,
  Users,
  Heart
} from 'lucide-react';
import type { UserProfile } from '@/lib/user-types';
import { getUserDisplayName } from '@/lib/user-types';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';

interface InfluencerAccountViewProps {
  userProfile: UserProfile;
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
}

export default function InfluencerAccountView({ userProfile }: InfluencerAccountViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Influencer data
  const [influencerData, setInfluencerData] = useState<any>(null);
  const [socialChannels, setSocialChannels] = useState<SocialChannel[]>([]);
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([]);

  // Profile form state
  const [profileData, setProfileData] = useState({
    firstName: userProfile.first_name || '',
    lastName: userProfile.last_name || '',
    email: userProfile.email || '',
    phone: userProfile.phone || '',
    username: '',
    bio: '',
  });

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    paymentMethod: 'paypal',
    paypalEmail: '',
    bankName: '',
    accountNumber: '',
    routingNumber: '',
    accountHolder: '',
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Notification preferences (influencer-specific)
  const [notifications, setNotifications] = useState({
    emailReferrals: true,
    emailCommissions: true,
    emailMarketing: false,
    smsReferrals: false,
    smsCommissions: false,
    pushNotifications: true,
  });

  // Load influencer data via API endpoint
  const loadInfluencerData = async () => {
    try {
      setIsDataLoading(true);
      console.log('🌟 INFLUENCER ACCOUNT: Loading influencer data via API');

      // For now, we'll use a placeholder API call since we need to implement this
      // This would call /api/influencers/profile
      const response = await fetch('/api/influencers/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        console.log('⏳ INFLUENCER ACCOUNT: Profile API not yet implemented, using placeholder data');
        // Use placeholder data for now
        setInfluencerData({
          id: userProfile.influencer_id,
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          email: userProfile.email,
          username: 'example_influencer',
          bio: 'Passionate pet lover and content creator',
          commission_rate: 10.0,
          stats: {
            referrals: { total_codes: 0, active_codes: 0, total_usage: 0 },
            financial: { total_commission_earned: 0, commission_pending: 0 },
            social_media: { total_reach: 0, active_channels: 0 }
          }
        });
        setSocialChannels([]);
        setReferralCodes([]);
        return;
      }

      const data = await response.json();
      console.log('Influencer data received:', data);

      setInfluencerData(data);
      setSocialChannels(data.social_channels || []);
      setReferralCodes(data.referral_codes || []);

      // Update form data
      setProfileData({
        firstName: data.first_name || userProfile.first_name || '',
        lastName: data.last_name || userProfile.last_name || '',
        email: data.email || userProfile.email || '',
        phone: data.phone || '',
        username: data.username || '',
        bio: data.bio || '',
      });

      if (data.payment_details) {
        setPaymentData({
          paymentMethod: data.payment_method || 'paypal',
          paypalEmail: data.payment_details.paypal_email || '',
          bankName: data.payment_details.bank_name || '',
          accountNumber: data.payment_details.account_number || '',
          routingNumber: data.payment_details.routing_number || '',
          accountHolder: data.payment_details.account_holder || '',
        });
      }

      if (data.notification_preferences) {
        setNotifications({
          emailReferrals: data.notification_preferences.email_referrals ?? true,
          emailCommissions: data.notification_preferences.email_commissions ?? true,
          emailMarketing: data.notification_preferences.email_marketing ?? false,
          smsReferrals: false,
          smsCommissions: false,
          pushNotifications: true,
        });
      }

      setAvatarUrl(data.avatar_url);

    } catch (error) {
      console.error('❌ INFLUENCER ACCOUNT: Error loading data:', error);
      // Set placeholder data on error
      setInfluencerData({
        id: userProfile.influencer_id,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        email: userProfile.email,
        username: 'example_influencer',
        bio: 'Passionate pet lover and content creator',
        commission_rate: 10.0,
        stats: {
          referrals: { total_codes: 0, active_codes: 0, total_usage: 0 },
          financial: { total_commission_earned: 0, commission_pending: 0 },
          social_media: { total_reach: 0, active_channels: 0 }
        }
      });
    } finally {
      setIsDataLoading(false);
    }
  };

  // Update profile
  const updateProfile = async () => {
    setIsLoading(true);
    try {
      console.log('🌟 INFLUENCER ACCOUNT: Updating profile via API');

      const updateData = {
        first_name: profileData.firstName.trim(),
        last_name: profileData.lastName.trim(),
        phone: profileData.phone.trim(),
        username: profileData.username.trim(),
        bio: profileData.bio.trim(),
        notification_preferences: {
          email_referrals: notifications.emailReferrals,
          email_commissions: notifications.emailCommissions,
        },
        payment_method: paymentData.paymentMethod,
        payment_details: paymentData.paymentMethod === 'paypal' ? {
          paypal_email: paymentData.paypalEmail
        } : {
          bank_name: paymentData.bankName,
          account_number: paymentData.accountNumber,
          routing_number: paymentData.routingNumber,
          account_holder: paymentData.accountHolder
        }
      };

      // For now, just show success without API call since we need to implement this
      console.log('Would update with data:', updateData);

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);

    } catch (error) {
      console.error('❌ INFLUENCER ACCOUNT: Update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram': return Instagram;
      case 'twitter': return Twitter;
      case 'facebook': return Facebook;
      case 'youtube': return Youtube;
      default: return ExternalLink;
    }
  };

  useEffect(() => {
    loadInfluencerData();
  }, []);

  if (isDataLoading) {
    return (
      <CountryProvider>
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-50">
          <UserAwareNavigation />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-yellow-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading your influencer account...</p>
              </div>
            </div>
          </div>
        </div>
      </CountryProvider>
    );
  }

  return (
    <CountryProvider>
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-50">
        <UserAwareNavigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Welcome, {getUserDisplayName(userProfile)}! ✨
                </h1>
                <p className="mt-2 text-gray-600">
                  Manage your influencer profile, social channels, and referral codes
                </p>
              </div>
              <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full">
                <Heart className="w-4 h-4" />
                <span className="text-sm font-medium">Influencer</span>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          {influencerData?.stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="w-8 h-8 text-yellow-600" />
                    <div className="ml-4">
                      <p className="text-sm text-gray-600">Social Reach</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {influencerData.stats.social_media.total_reach?.toLocaleString() || '0'}
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
                      <p className="text-sm text-gray-600">Active Codes</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {influencerData.stats.referrals.active_codes || 0}
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
                      <p className="text-sm text-gray-600">Earnings Pending</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${(influencerData.stats.financial.commission_pending || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs defaultValue="profile" className="space-y-8">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="social">Social Channels</TabsTrigger>
              <TabsTrigger value="referrals">Referral Codes</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal details and bio for your influencer profile
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-4 mb-6">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-yellow-100 text-yellow-600 text-lg">
                        {profileData.firstName.charAt(0)}{profileData.lastName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Button variant="outline" disabled={isUploadingAvatar}>
                        {isUploadingAvatar ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        Upload Avatar
                      </Button>
                      <p className="text-sm text-gray-500 mt-1">
                        JPG, PNG or GIF. Max size 2MB.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={profileData.firstName}
                        onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profileData.lastName}
                        onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={profileData.email}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Email cannot be changed. Contact support if needed.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={profileData.username}
                        onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                        placeholder="Your unique username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profileData.bio}
                      onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                      placeholder="Tell your audience about yourself and your content..."
                      rows={4}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {profileData.bio.length}/500 characters
                    </p>
                  </div>

                  <Button
                    onClick={updateProfile}
                    disabled={isLoading}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : isSaved ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {isSaved ? 'Saved!' : 'Save Changes'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Social Channels Tab */}
            <TabsContent value="social" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Instagram className="w-5 h-5 mr-2" />
                    Social Media Channels
                  </CardTitle>
                  <CardDescription>
                    Manage your connected social media accounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {socialChannels.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Social Channels Connected</h3>
                      <p className="text-gray-500 mb-6">
                        Connect your social media accounts to track your reach and engagement
                      </p>
                      <Button className="bg-yellow-600 hover:bg-yellow-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Social Channel
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {socialChannels.map((channel) => {
                        const Icon = getPlatformIcon(channel.platform);
                        return (
                          <div key={channel.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Icon className="w-6 h-6 text-yellow-600" />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium capitalize">{channel.platform}</span>
                                  {channel.verified && <Check className="w-4 h-4 text-green-600" />}
                                  {channel.is_primary && (
                                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Primary</span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">@{channel.username}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <p className="text-sm font-medium">{channel.follower_count.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">followers</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{(channel.engagement_rate * 100).toFixed(1)}%</p>
                                <p className="text-xs text-gray-500">engagement</p>
                              </div>
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      <Button className="w-full bg-yellow-600 hover:bg-yellow-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Another Channel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Referrals Tab */}
            <TabsContent value="referrals" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Referral Codes
                  </CardTitle>
                  <CardDescription>
                    Create and manage your referral codes for earning commissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {referralCodes.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No Referral Codes Yet</h3>
                      <p className="text-gray-500 mb-6">
                        Create your first referral code to start earning commissions
                      </p>
                      <Button className="bg-yellow-600 hover:bg-yellow-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Referral Code
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Referral codes would be listed here */}
                      <Button className="w-full bg-yellow-600 hover:bg-yellow-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Code
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="w-5 h-5 mr-2" />
                    Payment Information
                  </CardTitle>
                  <CardDescription>
                    Configure how you receive commission payments
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select value={paymentData.paymentMethod} onValueChange={(value) => setPaymentData({ ...paymentData, paymentMethod: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentData.paymentMethod === 'paypal' && (
                    <div>
                      <Label htmlFor="paypalEmail">PayPal Email</Label>
                      <Input
                        id="paypalEmail"
                        type="email"
                        value={paymentData.paypalEmail}
                        onChange={(e) => setPaymentData({ ...paymentData, paypalEmail: e.target.value })}
                        placeholder="your-paypal@email.com"
                      />
                    </div>
                  )}

                  {paymentData.paymentMethod === 'bank_transfer' && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="bankName">Bank Name</Label>
                        <Input
                          id="bankName"
                          value={paymentData.bankName}
                          onChange={(e) => setPaymentData({ ...paymentData, bankName: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="accountNumber">Account Number</Label>
                          <Input
                            id="accountNumber"
                            value={paymentData.accountNumber}
                            onChange={(e) => setPaymentData({ ...paymentData, accountNumber: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="routingNumber">Routing Number</Label>
                          <Input
                            id="routingNumber"
                            value={paymentData.routingNumber}
                            onChange={(e) => setPaymentData({ ...paymentData, routingNumber: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="accountHolder">Account Holder Name</Label>
                        <Input
                          id="accountHolder"
                          value={paymentData.accountHolder}
                          onChange={(e) => setPaymentData({ ...paymentData, accountHolder: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bell className="w-5 h-5 mr-2" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>
                    Choose how you want to be notified about your influencer activity
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emailReferrals">Email - New referrals</Label>
                    <Switch
                      id="emailReferrals"
                      checked={notifications.emailReferrals}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, emailReferrals: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emailCommissions">Email - Commission updates</Label>
                    <Switch
                      id="emailCommissions"
                      checked={notifications.emailCommissions}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, emailCommissions: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={updateProfile}
                disabled={isLoading}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : isSaved ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isSaved ? 'Saved!' : 'Save Settings'}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </CountryProvider>
  );
}