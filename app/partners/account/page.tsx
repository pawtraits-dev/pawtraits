"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, CreditCard, Bell, Shield, Eye, EyeOff, Save, Loader2, Check, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { PartnerOnly } from '@/components/user-access-control'
import { SupabaseService } from "@/lib/supabase"
import type { Partner } from "@/lib/types"

function AccountPageContent() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [partner, setPartner] = useState<Partner | null>(null)

  const supabaseService = new SupabaseService()

  // Profile form state
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    businessName: "",
    businessType: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    bio: "",
  })

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    paymentMethod: "paypal",
    paypalEmail: "",
    bankName: "",
    accountNumber: "",
    routingNumber: "",
    accountHolder: "",
  })

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailReferrals: true,
    emailCommissions: true,
    emailMarketing: false,
    smsReferrals: true,
    smsCommissions: true,
    pushNotifications: true,
  })

  // Load partner data on component mount
  useEffect(() => {
    loadPartnerData()
  }, [])

  const loadPartnerData = async () => {
    try {
      setIsDataLoading(true)
      console.log("Loading partner data...")
      
      const partnerData = await supabaseService.getCurrentPartner()
      console.log("Partner data received:", partnerData)
      
      if (partnerData) {
        setPartner(partnerData)
        
        // Update profile form with real data
        const newProfileData = {
          firstName: partnerData.first_name || "",
          lastName: partnerData.last_name || "",
          email: partnerData.email || "",
          phone: partnerData.phone || "",
          businessName: partnerData.business_name || "",
          businessType: partnerData.business_type || "",
          address: partnerData.business_address?.street || "",
          city: partnerData.business_address?.city || "",
          state: partnerData.business_address?.state || "",
          zipCode: partnerData.business_address?.zip || "",
          bio: partnerData.bio || "",
        }
        
        console.log("Setting profile data to:", newProfileData)
        setProfileData(newProfileData)

        // Update payment data
        setPaymentData(prev => ({
          ...prev,
          paymentMethod: partnerData.payment_method || "paypal",
          paypalEmail: partnerData.payment_method === "paypal" ? partnerData.email : "",
        }))

        // Update notification preferences
        if (partnerData.notification_preferences) {
          setNotifications({
            emailReferrals: partnerData.notification_preferences.email_referrals ?? true,
            emailCommissions: partnerData.notification_preferences.email_commissions ?? true,
            emailMarketing: false,
            smsReferrals: partnerData.notification_preferences.sms_enabled ?? false,
            smsCommissions: partnerData.notification_preferences.sms_enabled ?? false,
            pushNotifications: true,
          })
        }
      } else {
        console.log("No partner data found")
      }
    } catch (error) {
      console.error("Error loading partner data:", error)
    } finally {
      setIsDataLoading(false)
    }
  }

  const handleSave = async (section: string) => {
    if (!partner) return

    setIsLoading(true)

    try {
      if (section === "profile") {
        // Update partner profile
        await supabaseService.updateCurrentPartner({
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone || undefined,
          business_name: profileData.businessName || undefined,
          business_type: profileData.businessType as any,
          business_address: {
            street: profileData.address || undefined,
            city: profileData.city || undefined,
            state: profileData.state || undefined,
            zip: profileData.zipCode || undefined,
            country: "US"
          },
          bio: profileData.bio || undefined,
        })
      } else if (section === "payment") {
        // Update payment information
        await supabaseService.updateCurrentPartner({
          payment_method: paymentData.paymentMethod as any,
          payment_details: paymentData.paymentMethod === "paypal" 
            ? { paypal_email: paymentData.paypalEmail }
            : {
                bank_name: paymentData.bankName,
                account_holder: paymentData.accountHolder,
                account_number: paymentData.accountNumber,
                routing_number: paymentData.routingNumber,
              }
        })
      } else if (section === "notifications") {
        // Update notification preferences
        await supabaseService.updateCurrentPartner({
          notification_preferences: {
            email_commissions: notifications.emailCommissions,
            email_referrals: notifications.emailReferrals,
            sms_enabled: notifications.smsReferrals || notifications.smsCommissions,
          }
        })
      }

      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
      
      // Reload data to show updates
      await loadPartnerData()
    } catch (error) {
      console.error(`Error saving ${section}:`, error)
      // Handle error (could show a toast notification)
    } finally {
      setIsLoading(false)
    }
  }

  const handleProfileChange = (field: string, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePaymentChange = (field: string, value: string) => {
    setPaymentData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData((prev) => ({ ...prev, [field]: value }))
  }

  const handleNotificationChange = (field: string, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [field]: value }))
  }

  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your account information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
              <Link href="/partners" className="flex items-center hover:text-green-600">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Dashboard
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-green-900">Account Settings</h1>
            <p className="text-green-700 mt-2">Manage your profile, payment methods, and preferences</p>
          </div>
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
                <CardTitle className="text-green-900">Profile Information</CardTitle>
                <CardDescription>Update your personal and business information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile Picture */}
                <div className="flex items-center space-x-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={partner?.avatar_url || ""} alt="Profile" />
                    <AvatarFallback className="text-lg bg-green-100 text-green-700">
                      {profileData.firstName.charAt(0)}{profileData.lastName.charAt(0)}
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
                        onChange={(e) => handleProfileChange("firstName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profileData.lastName}
                        onChange={(e) => handleProfileChange("lastName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) => handleProfileChange("email", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={profileData.phone}
                        onChange={(e) => handleProfileChange("phone", e.target.value)}
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
                        onChange={(e) => handleProfileChange("businessName", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business Type</Label>
                      <Select
                        value={profileData.businessType}
                        onValueChange={(value) => handleProfileChange("businessType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
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
                      onChange={(e) => handleProfileChange("address", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={profileData.city}
                        onChange={(e) => handleProfileChange("city", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={profileData.state}
                        onChange={(e) => handleProfileChange("state", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">ZIP Code</Label>
                      <Input
                        id="zipCode"
                        value={profileData.zipCode}
                        onChange={(e) => handleProfileChange("zipCode", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profileData.bio}
                      onChange={(e) => handleProfileChange("bio", e.target.value)}
                      placeholder="Tell us about your business and experience..."
                      rows={3}
                    />
                  </div>
                </div>

                <Button
                  onClick={() => handleSave("profile")}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : isSaved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved!
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

          {/* Payment Tab */}
          <TabsContent value="payment" className="space-y-6">
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-green-900">Payment Methods</CardTitle>
                <CardDescription>Manage how you receive commission payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label>Preferred Payment Method</Label>
                  <Select
                    value={paymentData.paymentMethod}
                    onValueChange={(value) => handlePaymentChange("paymentMethod", value)}
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

                {paymentData.paymentMethod === "paypal" && (
                  <div className="space-y-2">
                    <Label htmlFor="paypalEmail">PayPal Email</Label>
                    <Input
                      id="paypalEmail"
                      type="email"
                      value={paymentData.paypalEmail}
                      onChange={(e) => handlePaymentChange("paypalEmail", e.target.value)}
                      placeholder="your-paypal@email.com"
                    />
                  </div>
                )}

                {paymentData.paymentMethod === "bank" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        id="bankName"
                        value={paymentData.bankName}
                        onChange={(e) => handlePaymentChange("bankName", e.target.value)}
                        placeholder="Your Bank Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="accountHolder">Account Holder Name</Label>
                      <Input
                        id="accountHolder"
                        value={paymentData.accountHolder}
                        onChange={(e) => handlePaymentChange("accountHolder", e.target.value)}
                        placeholder="Full name on account"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="accountNumber">Account Number</Label>
                        <Input
                          id="accountNumber"
                          value={paymentData.accountNumber}
                          onChange={(e) => handlePaymentChange("accountNumber", e.target.value)}
                          placeholder="Account number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="routingNumber">Routing Number</Label>
                        <Input
                          id="routingNumber"
                          value={paymentData.routingNumber}
                          onChange={(e) => handlePaymentChange("routingNumber", e.target.value)}
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

                <Button
                  onClick={() => handleSave("payment")}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : isSaved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Payment Method
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-green-900">Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>

                <Button
                  onClick={() => handleSave("security")}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : isSaved ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Updated!
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-green-900">Account Security</CardTitle>
                <CardDescription>Additional security settings for your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Two-Factor Authentication</h4>
                    <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                  </div>
                  <Button variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">Enable 2FA</Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Login Notifications</h4>
                    <p className="text-sm text-gray-600">Get notified when someone logs into your account</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-green-900">Email Notifications</CardTitle>
                <CardDescription>Choose what email notifications you'd like to receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">New Referrals</h4>
                    <p className="text-sm text-gray-600">Get notified when someone uses your referral link</p>
                  </div>
                  <Switch
                    checked={notifications.emailReferrals}
                    onCheckedChange={(checked) => handleNotificationChange("emailReferrals", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Commission Payments</h4>
                    <p className="text-sm text-gray-600">Get notified when you receive commission payments</p>
                  </div>
                  <Switch
                    checked={notifications.emailCommissions}
                    onCheckedChange={(checked) => handleNotificationChange("emailCommissions", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Marketing Updates</h4>
                    <p className="text-sm text-gray-600">Receive updates about new features and promotions</p>
                  </div>
                  <Switch
                    checked={notifications.emailMarketing}
                    onCheckedChange={(checked) => handleNotificationChange("emailMarketing", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-green-900">SMS Notifications</CardTitle>
                <CardDescription>Manage your text message notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Referral Activity</h4>
                    <p className="text-sm text-gray-600">Get SMS alerts for important referral activity</p>
                  </div>
                  <Switch
                    checked={notifications.smsReferrals}
                    onCheckedChange={(checked) => handleNotificationChange("smsReferrals", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Commission Alerts</h4>
                    <p className="text-sm text-gray-600">Get SMS notifications for commission payments</p>
                  </div>
                  <Switch
                    checked={notifications.smsCommissions}
                    onCheckedChange={(checked) => handleNotificationChange("smsCommissions", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => handleSave("notifications")}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isSaved ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <PartnerOnly>
      <AccountPageContent />
    </PartnerOnly>
  )
}