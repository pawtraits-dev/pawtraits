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

interface Partner {
  id: string;
  business_name?: string;
  first_name: string;
  last_name: string;
  logo_url?: string;
  avatar_url?: string;
}

interface ReferralCode {
  id: string;
  referral_code: string;
  client_first_name?: string;
  client_last_name?: string;
  client_email?: string;
  pet_name?: string;
  commission_rate: number;
  expires_at: string;
  partner: Partner;
  image?: {
    id: string;
    filename: string;
    description: string;
    public_url: string;
    breed_name: string;
    theme_name: string;
    style_name: string;
  };
}

export default function CustomerInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const [referralData, setReferralData] = useState<ReferralCode | null>(null);
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
      const response = await fetch(`/api/referrals/code/${params.code}`);

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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying referral code...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Referral Code</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link href="/">
              <Button>Go to Home Page</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getPartnerName = () => {
    if (!referralData?.partner) return 'Our Partner';
    return referralData.partner.business_name ||
           `${referralData.partner.first_name} ${referralData.partner.last_name}`;
  };

  const getPartnerLogo = () => {
    if (referralData?.partner?.logo_url) {
      return (
        <div className="w-20 h-20 p-2 bg-white border border-purple-200 rounded-2xl shadow-sm">
          <Image
            src={referralData.partner.logo_url}
            alt="Partner Logo"
            width={80}
            height={80}
            className="w-full h-full object-contain rounded-xl"
          />
        </div>
      );
    } else if (referralData?.partner?.avatar_url) {
      return (
        <Image
          src={referralData.partner.avatar_url}
          alt="Partner Avatar"
          width={80}
          height={80}
          className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-sm"
        />
      );
    } else {
      return (
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
          <span className="text-purple-600 text-2xl font-bold">
            {referralData?.partner ?
              `${referralData.partner.first_name[0]}${referralData.partner.last_name[0]}` :
              'P'}
          </span>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <img src="/assets/logos/paw-svgrepo-200x200-green.svg" alt="Pawtraits Logo" className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Pawtraits</h1>
                <p className="text-sm text-gray-600">AI Pet Portraits</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Partner Logo */}
              {referralData?.partner && (
                <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border">
                  {referralData.partner.logo_url ? (
                    <Image
                      src={referralData.partner.logo_url}
                      alt={`${getPartnerName()} Logo`}
                      width={32}
                      height={32}
                      className="w-8 h-8 object-contain rounded"
                    />
                  ) : referralData.partner.avatar_url ? (
                    <Image
                      src={referralData.partner.avatar_url}
                      alt={`${getPartnerName()} Avatar`}
                      width={32}
                      height={32}
                      className="w-8 h-8 object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-purple-600">
                        {referralData.partner.first_name[0]}{referralData.partner.last_name[0]}
                      </span>
                    </div>
                  )}
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">
                      {getPartnerName()}
                    </p>
                    <p className="text-gray-500">Referring Partner</p>
                  </div>
                </div>
              )}
              {scanRecorded && (
                <div className="flex items-center gap-2 text-purple-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Referral Verified</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            {getPartnerLogo()}
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            You&apos;re Invited by {getPartnerName()}!
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {getPartnerName()} has referred you to Pawtraits. Create stunning AI-generated portraits of your beloved pets with professional quality and get <span className="font-semibold text-purple-600">10% off your first order</span>!
          </p>
        </div>

        {/* Referral Information */}
        {referralData && (
          <div className="mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div>
                    <QrCode className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Referral Code</p>
                    <p className="font-mono font-bold text-lg">{referralData.referral_code}</p>
                  </div>
                  <div>
                    <Gift className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Your Discount</p>
                    <p className="font-bold text-lg text-green-600">10% OFF</p>
                  </div>
                  <div>
                    <Building className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Referred By</p>
                    <p className="font-medium">{getPartnerName()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Featured Image Preview */}
        {referralData?.image && (
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  Featured Portrait Style
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="relative">
                    <Image
                      src={referralData.image.public_url}
                      alt={referralData.image.description}
                      width={400}
                      height={400}
                      className="w-full h-64 object-cover rounded-lg shadow-md"
                    />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-900">
                      {referralData.image.breed_name} in {referralData.image.theme_name}
                    </h3>
                    <p className="text-gray-600">
                      Style: {referralData.image.style_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {referralData.image.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Action */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  Create Beautiful AI Pet Portraits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-purple-600">1</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Upload Your Pet&apos;s Photo</h4>
                      <p className="text-sm text-gray-600">
                        Share a clear photo of your beloved pet
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-purple-600">2</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Choose Your Style</h4>
                      <p className="text-sm text-gray-600">
                        Pick from dozens of artistic themes and styles
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-purple-600">3</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Get Your Portrait</h4>
                      <p className="text-sm text-gray-600">
                        Receive professional-quality AI-generated artwork
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Link href={`/signup/user?ref_partner_id=${referralData?.partner.id}&ref_code=${referralData?.referral_code}`}>
                    <Button size="lg" className="w-full bg-purple-600 hover:bg-purple-700">
                      <ArrowRight className="w-5 h-5 mr-2" />
                      Start Creating - Get 10% Off
                    </Button>
                  </Link>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Your 10% discount will be automatically applied with referral code {referralData?.referral_code}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Why Choose Pawtraits */}
            <Card>
              <CardHeader>
                <CardTitle>Why Choose Pawtraits?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Camera className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">AI-Powered Art</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Advanced AI creates stunning, unique portraits of your pet
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500" />
                      <span className="font-medium">Professional Quality</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Museum-quality prints on premium materials
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Special Discount</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      10% off your first order thanks to {getPartnerName()}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-red-500" />
                      <span className="font-medium">Made with Love</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Every portrait celebrates the unique bond with your pet
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Special Discount</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">10%</p>
                    <p className="text-sm text-green-700">OFF First Order</p>
                  </div>
                </div>

                <div className="text-xs text-gray-500 text-center">
                  Discount automatically applied during checkout
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Already have an account?</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            Questions? Contact us at{' '}
            <a href="mailto:support@pawtraits.pics" className="text-purple-600 hover:underline">
              support@pawtraits.pics
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}