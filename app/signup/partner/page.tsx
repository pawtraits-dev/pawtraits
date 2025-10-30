'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Users, TrendingUp, DollarSign, QrCode, Mail, Phone, MapPin, Globe, ArrowRight, Gift, Sparkles, Star, HandHeart, Building, Package, Target, BarChart } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';
import UserAwareNavigation from '@/components/UserAwareNavigation';

const businessTypes = [
  { value: 'groomer', label: 'Pet Groomer', icon: '✂️' },
  { value: 'vet', label: 'Veterinarian', icon: '🏥' },
  { value: 'breeder', label: 'Pet Breeder', icon: '🐕' },
  { value: 'salon', label: 'Pet Salon', icon: '💅' },
  { value: 'mobile', label: 'Mobile Service', icon: '🚐' },
  { value: 'independent', label: 'Independent', icon: '⭐' },
  { value: 'chain', label: 'Chain/Franchise', icon: '🏢' }
];

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone: string;
  manualReferralCode: string;
  businessName: string;
  businessType: string;
  businessPhone: string;
  businessWebsite: string;
  address: {
    street: string;
    street2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

// Component that handles search params and needs Suspense
function PartnerSignupForm() {
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    manualReferralCode: '',
    businessName: '',
    businessType: '',
    businessPhone: '',
    businessWebsite: '',
    address: {
      street: '',
      street2: '',
      city: '',
      state: '',
      zip: '',
      country: 'GB'
    }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCodeValid, setReferralCodeValid] = useState<boolean>(false);

  const supabaseService = new SupabaseService();

  // Check for referral code from QR code scan
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
      // Optionally validate the referral code
      validateReferralCode(refCode);
    }
  }, [searchParams]);

  const validateReferralCode = async (code: string) => {
    try {
      const response = await fetch(`/api/p/${code}`);
      if (response.ok) {
        setReferralCodeValid(true);
      }
    } catch (error) {
      console.error('Failed to validate referral code:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev as any)[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
      
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
      
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
      
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    }

    if (step === 2) {
      if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
      if (!formData.businessType) newErrors.businessType = 'Please select your business type';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) return;

    setLoading(true);

    try {
      console.log("Starting signup process for:", formData.email);
      
      // 1. Create auth account
      const authResult = await supabaseService.signUp(formData.email, formData.password, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        businessName: formData.businessName,
        businessType: formData.businessType
      });

      console.log("Auth signup result:", {
        user: authResult.user?.id,
        email: authResult.user?.email,
        confirmed: authResult.user?.email_confirmed_at,
        session: !!authResult.session
      });

      if (!authResult.user) {
        throw new Error("Failed to create auth user - no user returned from signup");
      }

      if (authResult.user) {
        // 2. For development: Auto-confirm the user email so they can log in immediately
        let realUserId = authResult.user.id;
        try {
          console.log('Auto-confirming user email for development using email...');
          const confirmResponse = await fetch('/api/auth/confirm-user-by-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: formData.email }),
          });

          if (!confirmResponse.ok) {
            throw new Error(`Confirmation failed: ${confirmResponse.statusText}`);
          }

          const confirmResult = await confirmResponse.json();
          console.log('Email confirmation result:', confirmResult);

          // Update the user ID to the real one from the database
          if (confirmResult.userId) {
            realUserId = confirmResult.userId;
            console.log('Updated user ID from temp to real:', { temp: authResult.user.id, real: realUserId });
          }
        } catch (confirmError) {
          console.warn('Email confirmation failed (this is OK for development):', confirmError);
          // Continue anyway - user might still be able to use the account
        }

        // 3. Create partner profile using the API endpoint
        try {
          console.log('Creating partner profile via API with user ID:', realUserId);
          const partnerResponse = await fetch('/api/p/signup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: realUserId,
              email: formData.email,
              firstName: formData.firstName,
              lastName: formData.lastName,
              phone: formData.phone || null,
              businessName: formData.businessName,
              businessType: formData.businessType,
              businessPhone: formData.businessPhone || null,
              businessWebsite: formData.businessWebsite || null,
              preRegCode: referralCode || formData.manualReferralCode || null,
              businessAddress: {
                street: formData.address.street || null,
                street2: formData.address.street2 || null,
                city: formData.address.city || null,
                state: formData.address.state || null,
                zip: formData.address.zip || null,
                country: formData.address.country || 'GB'
              }
            })
          });

          if (!partnerResponse.ok) {
            const partnerError = await partnerResponse.json();
            throw new Error(partnerError.error || 'Failed to create partner profile');
          }

          const partnerResult = await partnerResponse.json();
          const partner = partnerResult.partner;
          console.log('Partner created successfully:', partner);

          // Mark pre-registration code as used if partner signed up via QR code
          if (referralCode && partner) {
            try {
              const convertResponse = await fetch('/api/p/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  code: referralCode,
                  partner_id: partner.id,
                  partner_email: formData.email
                })
              });

              if (convertResponse.ok) {
                const convertResult = await convertResponse.json();
                console.log('Pre-registration code marked as used:', referralCode, convertResult);
              } else {
                const convertError = await convertResponse.json();
                console.error('Failed to convert pre-registration code:', convertError);
              }
            } catch (codeError) {
              console.error('Failed to mark pre-registration code as used:', codeError);
              // Don't fail the signup if this fails
            }
          }

          setSuccess(true);
        } catch (partnerError) {
          console.error('Partner creation error:', partnerError);
          throw new Error(partnerError instanceof Error ? partnerError.message : 'Failed to create partner profile');
        }
      }
    } catch (error) {
      console.error('Signup error:', error);
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to create account' });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Pawtraits!</h1>
            <p className="text-gray-600 mb-6">
              Your partner account has been created. Please check your email to verify your account, then you can start creating referrals!
            </p>
            <Link href="/auth/login">
              <Button className="w-full">Sign In to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Navigation */}
      <UserAwareNavigation />

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-r from-purple-600 to-blue-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <HandHeart className="w-16 h-16" />
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 font-[family-name:var(--font-life-savers)]">
              Partner with Pawtraits
            </h1>
            <p className="text-xl lg:text-2xl mb-8 max-w-3xl mx-auto opacity-90">
              Earn 10% commission for life on every sale from clients you refer!
            </p>
          
          {/* Key Benefits */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">Lifetime Commissions</h3>
              <p className="text-purple-100 text-sm">10% on all sales from your referrals</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">Easy Sharing</h3>
              <p className="text-purple-100 text-sm">Custom QR codes for each client</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">Real-time Tracking</h3>
              <p className="text-purple-100 text-sm">Monitor conversions and earnings</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">20% Partner Discount</h3>
              <p className="text-purple-100 text-sm">Save on your own orders and gifts</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">No Caps or Limits</h3>
              <p className="text-purple-100 text-sm">Unlimited earning potential</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">Marketing Support</h3>
              <p className="text-purple-100 text-sm">Resources to help you succeed</p>
            </div>
          </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-life-savers)]">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Start earning in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <Card className="text-center bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-purple-600">1</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Sign Up & Get Approved</h3>
                <p className="text-gray-600">
                  Complete your partner application with your business details and get approved to start referring customers.
                </p>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="text-center bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-purple-600">2</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Share Your Unique Code</h3>
                <p className="text-gray-600">
                  Share your unique referral code with customers, giving them a 10% discount on their first order.
                </p>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="text-center bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-purple-600">3</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Earn Commission</h3>
                <p className="text-gray-600">
                  Earn 10% commission on all referred customer orders - for life. Track your earnings in your partner dashboard.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Commission Structure */}
      <section className="py-16 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6 font-[family-name:var(--font-life-savers)]">
            Generous Commission Structure
          </h2>
          <Card className="shadow-lg border-0 bg-white">
            <CardContent className="p-8">
              <div className="bg-purple-50 rounded-lg p-8 mb-6">
                <div className="text-center">
                  <p className="text-6xl font-bold text-purple-600 mb-2">10%</p>
                  <p className="text-xl text-purple-700 font-medium">Commission on Every Order</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Commission calculated on order total (excluding shipping) • Paid monthly • No minimum thresholds
              </p>
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Customer Orders £100</p>
                  <p className="text-2xl font-bold text-purple-600">£10</p>
                  <p className="text-xs text-gray-500">Your Commission</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Customer Orders £500</p>
                  <p className="text-2xl font-bold text-purple-600">£50</p>
                  <p className="text-xs text-gray-500">Your Commission</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Customer Orders £1,000</p>
                  <p className="text-2xl font-bold text-purple-600">£100</p>
                  <p className="text-xs text-gray-500">Your Commission</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Perfect For Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-life-savers)]">
              Perfect For Pet Care Professionals
            </h2>
            <p className="text-xl text-gray-600">
              Join pet care professionals already earning with Pawtraits
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {businessTypes.map((type) => (
              <Card key={type.value} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="text-4xl mb-3">{type.icon}</div>
                  <h3 className="font-semibold text-gray-900">{type.label}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Signup Form */}
      <section className="py-16 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Create Your Partner Account</CardTitle>
              <CardDescription>
                Join {businessTypes.find(t => t.value === formData.businessType)?.label || 'professionals'} earning with Pawtraits
              </CardDescription>
              
              {/* Progress */}
              <div className="flex items-center justify-center space-x-4 mt-6">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 1 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>1</div>
                <div className={`h-1 w-16 ${currentStep >= 2 ? 'bg-purple-600' : 'bg-gray-200'}`}></div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep >= 2 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>2</div>
              </div>
            </CardHeader>

            {/* Pre-registration Code Indicator */}
            {referralCode && (
              <div className="px-6 pb-4">
                <Alert className="border-green-200 bg-green-50">
                  <QrCode className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    <strong>QR Code Registration:</strong> You&apos;re signing up via invitation code{' '}
                    <span className="font-mono font-bold">{referralCode}</span>
                    {referralCodeValid && <span className="text-green-600"> ✓ Verified</span>}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <CardContent className="space-y-6">
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Personal Information</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={errors.firstName ? 'border-red-500' : ''}
                        placeholder="John"
                      />
                      {errors.firstName && <p className="text-sm text-red-600">{errors.firstName}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={errors.lastName ? 'border-red-500' : ''}
                        placeholder="Smith"
                      />
                      {errors.lastName && <p className="text-sm text-red-600">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={errors.email ? 'border-red-500' : ''}
                      placeholder="john@petgroomers.com"
                    />
                    {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  {/* Manual Referral Code Input */}
                  {!referralCode && (
                    <div className="space-y-2">
                      <Label htmlFor="manualReferralCode">Referral Code (Optional)</Label>
                      <Input
                        id="manualReferralCode"
                        value={formData.manualReferralCode}
                        onChange={(e) => handleInputChange('manualReferralCode', e.target.value.toUpperCase())}
                        placeholder="Enter referral code (e.g., JOHN1234ABCD)"
                        className="uppercase"
                      />
                      <p className="text-xs text-gray-500">
                        Have a referral code? Enter it here to get started.
                      </p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className={errors.password ? 'border-red-500' : ''}
                        placeholder="••••••••"
                      />
                      {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className={errors.confirmPassword ? 'border-red-500' : ''}
                        placeholder="••••••••"
                      />
                      {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword}</p>}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Business Information</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="businessType">Business Type *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {businessTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => handleInputChange('businessType', type.value)}
                          className={`p-3 border rounded-lg text-left hover:border-purple-500 transition-colors ${
                            formData.businessType === type.value ? 'border-purple-500 bg-purple-50' : 'border-gray-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span>{type.icon}</span>
                            <span className="text-sm font-medium">{type.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    {errors.businessType && <p className="text-sm text-red-600">{errors.businessType}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      value={formData.businessName}
                      onChange={(e) => handleInputChange('businessName', e.target.value)}
                      className={errors.businessName ? 'border-red-500' : ''}
                      placeholder="Paws & Claws Grooming"
                    />
                    {errors.businessName && <p className="text-sm text-red-600">{errors.businessName}</p>}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessPhone">Business Phone</Label>
                      <Input
                        id="businessPhone"
                        type="tel"
                        value={formData.businessPhone}
                        onChange={(e) => handleInputChange('businessPhone', e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="businessWebsite">Website</Label>
                      <Input
                        id="businessWebsite"
                        type="url"
                        value={formData.businessWebsite}
                        onChange={(e) => handleInputChange('businessWebsite', e.target.value)}
                        placeholder="https://yourgrooming.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Business Address (Optional)</Label>
                    <div className="space-y-3">
                      <Input
                        value={formData.address.street}
                        onChange={(e) => handleInputChange('address.street', e.target.value)}
                        placeholder="Address Line 1"
                      />
                      <Input
                        value={formData.address.street2}
                        onChange={(e) => handleInputChange('address.street2', e.target.value)}
                        placeholder="Address Line 2"
                      />
                      <div className="grid md:grid-cols-4 gap-3">
                        <Input
                          value={formData.address.city}
                          onChange={(e) => handleInputChange('address.city', e.target.value)}
                          placeholder="City"
                        />
                        <Input
                          value={formData.address.state}
                          onChange={(e) => handleInputChange('address.state', e.target.value)}
                          placeholder="County"
                        />
                        <Input
                          value={formData.address.zip}
                          onChange={(e) => handleInputChange('address.zip', e.target.value)}
                          placeholder="Post Code"
                        />
                        <select
                          value={formData.address.country}
                          onChange={(e) => handleInputChange('address.country', e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="GB">United Kingdom</option>
                          <option value="US">United States</option>
                          <option value="CA">Canada</option>
                          <option value="AU">Australia</option>
                          <option value="DE">Germany</option>
                          <option value="FR">France</option>
                          <option value="IT">Italy</option>
                          <option value="ES">Spain</option>
                          <option value="NL">Netherlands</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{errors.submit}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-6">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(prev => prev - 1)}
                  >
                    Back
                  </Button>
                )}
                
                {currentStep < 2 ? (
                  <Button 
                    type="button" 
                    onClick={handleNext}
                    className="ml-auto bg-gradient-to-r from-purple-600 to-blue-600"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    type="button" 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="ml-auto bg-gradient-to-r from-purple-600 to-blue-600"
                  >
                    {loading ? 'Creating Account...' : 'Create Partner Account'}
                  </Button>
                )}
              </div>

              <div className="text-center pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link href="/auth/login" className="text-purple-600 hover:text-purple-700 font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Branding */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <HandHeart className="w-8 h-8 text-purple-400" />
                <span className="text-xl font-bold font-[family-name:var(--font-life-savers)]">Pawtraits</span>
              </div>
              <p className="text-gray-400 text-sm">
                Fantastic Fun Pictures of your Furry Friends
              </p>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="font-semibold mb-4 text-lg">Contact Us</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <a href="mailto:partners@pawtraits.pics" className="hover:text-purple-400 transition-colors">
                    partners@pawtraits.pics
                  </a>
                </div>
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4" />
                  <a href="https://www.pawtraits.pics" className="hover:text-purple-400 transition-colors">
                    www.pawtraits.pics
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold mb-4 text-lg">Quick Links</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div>
                  <Link href="/auth/login" className="hover:text-purple-400 transition-colors">
                    Partner Login
                  </Link>
                </div>
                <div>
                  <Link href="/" className="hover:text-purple-400 transition-colors">
                    Home
                  </Link>
                </div>
                <div>
                  <Link href="/shop" className="hover:text-purple-400 transition-colors">
                    Shop
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} Pawtraits. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Main export component with Suspense wrapper
export default function PartnerSignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div>}>
      <PartnerSignupForm />
    </Suspense>
  );
}