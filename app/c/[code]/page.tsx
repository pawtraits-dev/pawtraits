'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  QrCode,
  CheckCircle2,
  Building,
  Star,
  Gift,
  ArrowRight,
  AlertCircle,
  Heart,
  Camera,
  Sparkles
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';

interface Partner {
  id: string;
  business_name?: string;
  first_name: string;
  last_name: string;
  logo_url?: string;
  avatar_url?: string;
}

interface UnifiedReferral {
  id: string;
  code: string;
  type: string;
  status: string;
  expires_at: string;
  commission_rate: number;
  discount_rate: number;
  referral_type: 'PARTNER' | 'CUSTOMER' | 'INFLUENCER' | 'ORGANIC';
  referrer: {
    id: string;
    type: 'partner' | 'customer' | 'influencer';
    name: string;
    avatar_url?: string;
    business_name?: string;
    username?: string;
    is_verified?: boolean;
  };
  partner?: Partner; // Legacy compatibility
}

function CustomerInvitationPageContent() {
  const params = useParams();
  const router = useRouter();
  const [referralData, setReferralData] = useState<UnifiedReferral | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanRecorded, setScanRecorded] = useState(false);

  useEffect(() => {
    if (params.code) {
      fetchReferralData();
    }
  }, [params.code]);

  const fetchReferralData = async () => {
    try {
      setLoading(true);

      // Always call /api/c/${code} first to increment scan count for both partners and customers
      try {
        await fetch(`/api/c/${params.code}`);
      } catch (scanError) {
        console.error('Failed to record scan:', scanError);
        // Non-critical - continue anyway
      }

      // Then fetch referral data for display
      const response = await fetch(`/api/referrals/verify/${params.code}`);

      if (response.ok) {
        const data = await response.json();
        setReferralData(data);
        setScanRecorded(true);
      } else if (response.status === 404) {
        setError('This referral code is not valid or has been deactivated.');
      } else if (response.status === 410) {
        setError('This referral code has expired.');
      } else {
        setError('Unable to verify referral code. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching referral code:', error);
      setError('Unable to verify referral code. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <UserAwareNavigation />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <UserAwareNavigation />
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Referral Code</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link href="/">
                <Button className="bg-purple-600 hover:bg-purple-700">Go to Home Page</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getReferrerName = () => {
    if (!referralData?.referrer) return 'Our Partner';
    return referralData.referrer.business_name || referralData.referrer.name;
  };

  const getReferrerLogo = () => {
    if (referralData?.referrer?.avatar_url) {
      return (
        <div className="w-20 h-20 p-2 bg-white border border-purple-200 rounded-2xl shadow-sm">
          <Image
            src={referralData.referrer.avatar_url}
            alt="Referrer Logo"
            width={80}
            height={80}
            className="w-full h-full object-contain rounded-xl"
          />
        </div>
      );
    } else {
      return (
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
          <span className="text-purple-600 text-2xl font-bold">
            {referralData?.referrer ? referralData.referrer.name.charAt(0).toUpperCase() : 'R'}
          </span>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      {/* Navigation */}
      <UserAwareNavigation />

      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-r from-purple-600 to-blue-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Referrer Logo */}
            <div className="flex items-center justify-center mb-6">
              {getReferrerLogo()}
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold mb-6 font-[family-name:var(--font-life-savers)]">
              You&apos;re Invited by {getReferrerName()}!
            </h1>
            <p className="text-xl lg:text-2xl mb-8 max-w-3xl mx-auto opacity-90">
              {getReferrerName()} has referred you to Pawtraits. Create stunning AI-generated portraits of your beloved pets and get{' '}
              <span className="font-bold bg-white bg-opacity-20 px-2 py-1 rounded">
                {referralData?.discount_rate}% off your first order
              </span>!
            </p>

            {/* Main CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href={`/signup/user?ref=${referralData?.code}`}>
                <Button
                  size="lg"
                  className="bg-white text-purple-600 hover:bg-gray-100 shadow-lg text-lg px-8 py-4"
                >
                  <Sparkles className="w-6 h-6 mr-2" />
                  Start Creating - Get {referralData?.discount_rate}% Off
                </Button>
              </Link>
            </div>

            {/* Referral verification badge */}
            {scanRecorded && (
              <div className="flex items-center justify-center gap-2 mt-6 text-green-200">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Referral Verified</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Referral Information Card */}
      {referralData && (
        <section className="py-12 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="shadow-lg border-0">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                  <div className="space-y-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                      <QrCode className="w-6 h-6 text-purple-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Invitation Code</p>
                    <p className="font-mono font-bold text-xl text-purple-600">{referralData.code}</p>
                  </div>
                  <div className="space-y-3">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <Gift className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Your Discount</p>
                    <p className="font-bold text-xl text-green-600">{referralData.discount_rate}% OFF</p>
                  </div>
                  <div className="space-y-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                      {referralData.referrer.avatar_url ? (
                        <Image
                          src={referralData.referrer.avatar_url}
                          alt={`${getReferrerName()}`}
                          width={32}
                          height={32}
                          className="w-8 h-8 object-contain rounded-full"
                        />
                      ) : (
                        <Building className="w-6 h-6 text-blue-600" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-600">Referred By</p>
                    <p className="font-bold text-lg text-gray-900">{getReferrerName()}</p>
                    <p className="text-sm text-gray-500 capitalize">{referralData.referrer.type}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-life-savers)]">
              Create Beautiful AI Pet Portraits
            </h2>
            <p className="text-xl text-gray-600">
              Transform your pet's photo into stunning artwork in just three steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <Card className="text-center bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-purple-600">1</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Upload Your Pet&apos;s Photo</h3>
                <p className="text-gray-600">
                  Share a clear, high-quality photo of your beloved pet. Our AI works best with well-lit, close-up shots.
                </p>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="text-center bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-purple-600">2</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Choose Your Style</h3>
                <p className="text-gray-600">
                  Pick from dozens of artistic themes and styles, from Renaissance masterpieces to modern digital art.
                </p>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="text-center bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-purple-600">3</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Get Your Portrait</h3>
                <p className="text-gray-600">
                  Receive professional-quality AI-generated artwork perfect for framing or sharing with friends.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-life-savers)]">
              Why Choose Pawtraits?
            </h2>
            <p className="text-xl text-gray-600">
              Trusted by thousands of pet parents worldwide
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">AI-Powered Art</h3>
              <p className="text-gray-600">Advanced AI creates stunning, unique portraits of your pet with incredible detail.</p>
            </div>

            {/* Feature 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Professional Quality</h3>
              <p className="text-gray-600">Museum-quality prints on premium materials that will last for generations.</p>
            </div>

            {/* Feature 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Special Discount</h3>
              <p className="text-gray-600">{referralData?.discount_rate}% off your first order thanks to {getReferrerName()}.</p>
            </div>

            {/* Feature 4 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Made with Love</h3>
              <p className="text-gray-600">Every portrait celebrates the unique bond between you and your beloved pet.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6 font-[family-name:var(--font-life-savers)]">
            Ready to Create Your Pet's Portrait?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of happy pet parents and get {referralData?.discount_rate}% off your first order
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href={`/signup/user?ref=${referralData?.code}`}>
              <Button
                size="lg"
                className="bg-white text-purple-600 hover:bg-gray-100 shadow-lg text-lg px-8 py-4"
              >
                <ArrowRight className="w-6 h-6 mr-2" />
                Start Creating Now
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button
                variant="outline"
                size="lg"
                className="border-white text-white hover:bg-white hover:text-purple-600 text-lg px-8 py-4"
              >
                Already Have an Account?
              </Button>
            </Link>
          </div>
          <p className="text-sm mt-4 opacity-75">
            Your {referralData?.discount_rate}% discount will be automatically applied with referral code {referralData?.code}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Image
                src="/assets/logos/paw-svgrepo-200x200-purple.svg"
                alt="Pawtraits Logo"
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-xl font-bold font-[family-name:var(--font-life-savers)]">Pawtraits</span>
            </div>
            <p className="text-gray-400 mb-4">Perfect Pet Pawtraits</p>
            <p className="text-sm text-gray-500">
              Questions? Contact us at{' '}
              <a href="mailto:support@pawtraits.pics" className="text-purple-400 hover:underline">
                support@pawtraits.pics
              </a>
            </p>
            <div className="mt-8 pt-8 border-t border-gray-800 text-center">
              <p className="text-gray-400">
                © 2024 Pawtraits. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function CustomerInvitationPage() {
  return (
    <CountryProvider>
      <CustomerInvitationPageContent />
    </CountryProvider>
  );
}