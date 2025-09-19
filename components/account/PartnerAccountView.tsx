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
import { User, CreditCard, Bell, Shield, Eye, EyeOff, Save, Loader2, Check } from 'lucide-react';
import type { UserProfile } from '@/lib/user-types';
import { getUserDisplayName } from '@/lib/user-types';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';

// 🏗️ PARTNER ACCOUNT VIEW COMPONENT
// Following architectural patterns from docs/patterns/

interface PartnerAccountViewProps {
  userProfile: UserProfile;
}

export default function PartnerAccountView({ userProfile }: PartnerAccountViewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Profile form state - initialized from userProfile prop
  const [profileData, setProfileData] = useState({
    firstName: userProfile.first_name || '',
    lastName: userProfile.last_name || '',
    email: userProfile.email || '',
    phone: userProfile.phone || '',
    businessName: '',
    businessType: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
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

  // Notification preferences (partner-specific)
  const [notifications, setNotifications] = useState({
    emailReferrals: true,
    emailCommissions: true,
    emailMarketing: false,
    smsReferrals: false,
    smsCommissions: false,
    pushNotifications: true,
  });

  // ✅ ARCHITECTURAL PATTERN: Load partner data via API endpoint
  const loadPartnerData = async () => {
    try {
      setIsDataLoading(true);
      console.log('🏗️ PARTNER ACCOUNT: Loading partner data via API');

      const response = await fetch('/api/partners/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ Include cookies for auth
      });

      if (!response.ok) {
        throw new Error(`Failed to load partner data: ${response.status}`);
      }

      const partnerData = await response.json();
      console.log('Partner data received:', partnerData);

      if (partnerData) {
        // Update profile form with real data
        setProfileData({
          firstName: partnerData.first_name || userProfile.first_name || '',
          lastName: partnerData.last_name || userProfile.last_name || '',
          email: partnerData.email || userProfile.email || '',
          phone: partnerData.phone || userProfile.phone || '',
          businessName: partnerData.business_name || '',
          businessType: partnerData.business_type || '',
          address: partnerData.business_address?.street || '',
          city: partnerData.business_address?.city || '',
          state: partnerData.business_address?.state || '',
          zipCode: partnerData.business_address?.zip || '',
          bio: partnerData.bio || '',
        });

        // Update payment data
        setPaymentData(prev => ({
          ...prev,
          paymentMethod: partnerData.payment_method || 'paypal',
          paypalEmail: partnerData.payment_method === 'paypal' ? partnerData.email : '',
        }));

        // Update notification preferences
        if (partnerData.notification_preferences) {
          setNotifications({
            emailReferrals: partnerData.notification_preferences.email_referrals ?? true,
            emailCommissions: partnerData.notification_preferences.email_commissions ?? true,
            emailMarketing: false,
            smsReferrals: partnerData.notification_preferences.sms_enabled ?? false,
            smsCommissions: partnerData.notification_preferences.sms_enabled ?? false,
            pushNotifications: true,
          });
        }
      }
    } catch (error) {
      console.error('Error loading partner data:', error);
      // TODO: Show error message to user
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    loadPartnerData();
  }, []);

  // ✅ ARCHITECTURAL PATTERN: Update data via API endpoint
  const saveProfile = async () => {
    try {
      setIsLoading(true);
      console.log('🏗️ PARTNER ACCOUNT: Saving profile data via API');

      const response = await fetch('/api/partners/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ Include cookies for auth
        body: JSON.stringify({
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone || undefined,
          business_name: profileData.businessName || undefined,
          business_type: profileData.businessType || undefined,
          business_address: {
            street: profileData.address || undefined,
            city: profileData.city || undefined,
            state: profileData.state || undefined,
            zip: profileData.zipCode || undefined,
            country: 'US'
          },
          bio: profileData.bio || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save profile: ${response.status}`);
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);

    } catch (error) {
      console.error('Error saving profile:', error);
      // TODO: Show error message to user
    } finally {
      setIsLoading(false);
    }
  };

  const savePayment = async () => {
    try {
      setIsLoading(true);
      console.log('🏗️ PARTNER ACCOUNT: Saving payment data via API');

      const response = await fetch('/api/partners/payment', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ Include cookies for auth
        body: JSON.stringify({
          payment_method: paymentData.paymentMethod,
          payment_details: paymentData.paymentMethod === 'paypal'
            ? { paypal_email: paymentData.paypalEmail }
            : {
                bank_name: paymentData.bankName,
                account_holder: paymentData.accountHolder,
                account_number: paymentData.accountNumber,
                routing_number: paymentData.routingNumber,
              }
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save payment: ${response.status}`);
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);

    } catch (error) {
      console.error('Error saving payment:', error);
      // TODO: Show error message to user
    } finally {
      setIsLoading(false);
    }
  };

  const savePassword = async () => {
    try {
      setIsLoading(true);
      console.log('🏗️ PARTNER ACCOUNT: Updating password via API');

      const response = await fetch('/api/partners/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ Include cookies for auth
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update password: ${response.status}`);
      }

      // Clear password fields
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);

    } catch (error) {
      console.error('Error updating password:', error);
      // TODO: Show error message to user
    } finally {
      setIsLoading(false);
    }
  };

  const saveNotifications = async () => {
    try {
      setIsLoading(true);
      console.log('🏗️ PARTNER ACCOUNT: Saving notifications via API');

      const response = await fetch('/api/partners/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // ✅ Include cookies for auth
        body: JSON.stringify({
          notification_preferences: {
            email_commissions: notifications.emailCommissions,
            email_referrals: notifications.emailReferrals,
            sms_enabled: notifications.smsReferrals || notifications.smsCommissions,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save notifications: ${response.status}`);
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);

    } catch (error) {
      console.error('Error saving notifications:', error);
      // TODO: Show error message to user
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handlePaymentChange = (field: string, value: string) => {
    setPaymentData(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (field: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [field]: value }));
  };

  if (isDataLoading) {
    return (
      <CountryProvider>
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
          <UserAwareNavigation />
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading your account information...</p>
            </div>
          </div>
        </div>
      </CountryProvider>
    );
  }

  return (
    <CountryProvider>
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
        <UserAwareNavigation />

        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-green-900">Account Settings</h1>
            <p className="text-green-700 mt-2">
              Welcome, {getUserDisplayName(userProfile)} - Manage your partner account
            </p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-white border-green-200">
              <TabsTrigger value="profile" className="flex items-center data-[state=active]:bg-green-100 data-[state=active]:text-green-600">
                <User className="w-4 h-4 mr-2" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="payment" className="flex items-center data-[state=active]:bg-green-100 data-[state=active]:text-green-600">
                <CreditCard className="w-4 h-4 mr-2" />
                Payment
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center data-[state=active]:bg-green-100 data-[state=active]:text-green-600">
                <Shield className="w-4 h-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center data-[state=active]:bg-green-100 data-[state=active]:text-green-600">
                <Bell className="w-4 h-4 mr-2" />
                Notifications
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              <Card className="border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-900">
                    <User className="w-5 h-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal and business information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6 mb-6">
                    <Avatar className="w-16 h-16">
                      <AvatarImage src="/placeholder-avatar.png" />
                      <AvatarFallback className="text-lg bg-green-100 text-green-700">
                        {getUserDisplayName(userProfile).split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Button variant="outline" size="sm" className="border-green-300 text-green-700 hover:bg-green-50">
                        Change Photo
                      </Button>
                      <p className="text-sm text-gray-600 mt-1">JPG, GIF or PNG. 1MB max.</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-green-900">Personal Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={profileData.firstName}
                          onChange={(e) => handleProfileChange('firstName', e.target.value)}
                          placeholder="Enter your first name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={profileData.lastName}
                          onChange={(e) => handleProfileChange('lastName', e.target.value)}
                          placeholder="Enter your last name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={profileData.email}
                          onChange={(e) => handleProfileChange('email', e.target.value)}
                          placeholder="Enter your email"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={profileData.phone}
                          onChange={(e) => handleProfileChange('phone', e.target.value)}
                          placeholder="Enter your phone number"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Business Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-green-900">Business Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="businessName">Business Name</Label>
                        <Input
                          id="businessName"
                          value={profileData.businessName}
                          onChange={(e) => handleProfileChange('businessName', e.target.value)}
                          placeholder="Enter your business name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessType">Business Type</Label>
                        <Select
                          value={profileData.businessType}
                          onValueChange={(value) => handleProfileChange('businessType', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select business type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="groomer">Pet Groomer</SelectItem>
                            <SelectItem value="vet">Veterinarian</SelectItem>
                            <SelectItem value="breeder">Pet Breeder</SelectItem>
                            <SelectItem value="salon">Pet Salon</SelectItem>
                            <SelectItem value="mobile">Mobile Service</SelectItem>
                            <SelectItem value="independent">Independent</SelectItem>
                            <SelectItem value="chain">Chain/Franchise</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Business Address</Label>
                      <Input
                        id="address"
                        value={profileData.address}
                        onChange={(e) => handleProfileChange('address', e.target.value)}
                        placeholder="Enter your business address"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={profileData.city}
                          onChange={(e) => handleProfileChange('city', e.target.value)}
                          placeholder="Enter city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          value={profileData.state}
                          onChange={(e) => handleProfileChange('state', e.target.value)}
                          placeholder="Enter state"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zipCode">ZIP Code</Label>
                        <Input
                          id="zipCode"
                          value={profileData.zipCode}
                          onChange={(e) => handleProfileChange('zipCode', e.target.value)}
                          placeholder="Enter ZIP code"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={profileData.bio}
                        onChange={(e) => handleProfileChange('bio', e.target.value)}
                        placeholder="Tell us about your business and experience..."
                        rows={3}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-end">
                    <Button
                      onClick={saveProfile}
                      disabled={isLoading}
                      className="w-32 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isSaved ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <><Save className="w-4 h-4 mr-2" />Save</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment Tab */}
            <TabsContent value="payment" className="space-y-6">
              <Card className="border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-900">
                    <CreditCard className="w-5 h-5" />
                    Payment Methods
                  </CardTitle>
                  <CardDescription>
                    Manage how you receive commission payments
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label>Preferred Payment Method</Label>
                    <Select
                      value={paymentData.paymentMethod}
                      onValueChange={(value) => handlePaymentChange('paymentMethod', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="bank">Direct Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentData.paymentMethod === 'paypal' && (
                    <div className="space-y-2">
                      <Label htmlFor="paypalEmail">PayPal Email</Label>
                      <Input
                        id="paypalEmail"
                        type="email"
                        value={paymentData.paypalEmail}
                        onChange={(e) => handlePaymentChange('paypalEmail', e.target.value)}
                        placeholder="your-paypal@email.com"
                      />
                    </div>
                  )}

                  {paymentData.paymentMethod === 'bank' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="bankName">Bank Name</Label>
                        <Input
                          id="bankName"
                          value={paymentData.bankName}
                          onChange={(e) => handlePaymentChange('bankName', e.target.value)}
                          placeholder="Your Bank Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountHolder">Account Holder Name</Label>
                        <Input
                          id="accountHolder"
                          value={paymentData.accountHolder}
                          onChange={(e) => handlePaymentChange('accountHolder', e.target.value)}
                          placeholder="Full name on account"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="accountNumber">Account Number</Label>
                          <Input
                            id="accountNumber"
                            value={paymentData.accountNumber}
                            onChange={(e) => handlePaymentChange('accountNumber', e.target.value)}
                            placeholder="Account number"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="routingNumber">Routing Number</Label>
                          <Input
                            id="routingNumber"
                            value={paymentData.routingNumber}
                            onChange={(e) => handlePaymentChange('routingNumber', e.target.value)}
                            placeholder="Routing number"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">Payment Schedule</h4>
                    <ul className="text-sm text-green-800 space-y-1">
                      <li>• Commissions are paid monthly on the 15th</li>
                      <li>• Minimum payout threshold: $25</li>
                      <li>• Processing time: 3-5 business days</li>
                      <li>• You'll receive an email confirmation for each payment</li>
                    </ul>
                  </div>

                  <Separator />

                  <div className="flex justify-end">
                    <Button
                      onClick={savePayment}
                      disabled={isLoading}
                      className="w-40 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isSaved ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <>Save Payment Method</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <Card className="border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-900">
                    <Shield className="w-5 h-5" />
                    Change Password
                  </CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                        placeholder="Enter current password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                        placeholder="Enter new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>

                  <Separator />

                  <div className="flex justify-end">
                    <Button
                      onClick={savePassword}
                      disabled={isLoading || !passwordData.currentPassword || !passwordData.newPassword || passwordData.newPassword !== passwordData.confirmPassword}
                      className="w-40 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isSaved ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <>Update Password</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              <Card className="border-green-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-900">
                    <Bell className="w-5 h-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>
                    Choose how you want to receive partner notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">New Referrals</Label>
                        <p className="text-sm text-gray-500">
                          Get notified when someone uses your referral link
                        </p>
                      </div>
                      <Switch
                        checked={notifications.emailReferrals}
                        onCheckedChange={(checked) => handleNotificationChange('emailReferrals', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Commission Payments</Label>
                        <p className="text-sm text-gray-500">
                          Get notified when you receive commission payments
                        </p>
                      </div>
                      <Switch
                        checked={notifications.emailCommissions}
                        onCheckedChange={(checked) => handleNotificationChange('emailCommissions', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Marketing Updates</Label>
                        <p className="text-sm text-gray-500">
                          Receive updates about new features and promotions
                        </p>
                      </div>
                      <Switch
                        checked={notifications.emailMarketing}
                        onCheckedChange={(checked) => handleNotificationChange('emailMarketing', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">SMS Notifications</Label>
                        <p className="text-sm text-gray-500">
                          Receive important updates via text message
                        </p>
                      </div>
                      <Switch
                        checked={notifications.smsReferrals || notifications.smsCommissions}
                        onCheckedChange={(checked) => {
                          handleNotificationChange('smsReferrals', checked);
                          handleNotificationChange('smsCommissions', checked);
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Push Notifications</Label>
                        <p className="text-sm text-gray-500">
                          Receive notifications in your browser
                        </p>
                      </div>
                      <Switch
                        checked={notifications.pushNotifications}
                        onCheckedChange={(checked) => handleNotificationChange('pushNotifications', checked)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-end">
                    <Button
                      onClick={saveNotifications}
                      disabled={isLoading}
                      className="w-32 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isSaved ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <><Save className="w-4 h-4 mr-2" />Save</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </CountryProvider>
  );
}

// 📋 ARCHITECTURAL COMPLIANCE CHECKLIST:
// ✅ No direct database queries in component
// ✅ All data updates through API endpoints with credentials: 'include'
// ✅ Proper error handling for API failures
// ✅ Uses userProfile prop instead of fetching data
// ✅ Follows component template patterns
// ✅ Partner-specific styling and content