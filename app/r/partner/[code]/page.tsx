'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Heart,
  CheckCircle2,
  Building,
  Star,
  Gift,
  ArrowRight,
  AlertCircle,
  Users,
  Percent
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface PartnerInfo {
  id: string;
  business_name?: string;
  first_name: string;
  last_name: string;
  business_type?: string;
  email: string;
}

export default function PartnerReferralSignupPage() {
  const params = useParams();
  const router = useRouter();
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code] = useState<string>(params.code as string);

  useEffect(() => {
    if (params.code) {
      fetchPartnerInfo();
    }
  }, [params.code]);

  const fetchPartnerInfo = async () => {
    try {
      setLoading(true);

      // Get partner info from the used code
      const response = await fetch(`/api/p/${params.code}`);

      if (response.ok) {
        const data = await response.json();

        if (data.redirect === 'customer_signup' && data.partner_email) {
          // Fetch partner details
          const partnerResponse = await fetch(`/api/partners/by-email/${data.partner_email}`);
          if (partnerResponse.ok) {
            const partnerData = await partnerResponse.json();
            setPartnerInfo(partnerData);
          } else {
            // Fallback with basic info
            setPartnerInfo({
              id: data.partner_id || 'unknown',
              email: data.partner_email,
              first_name: 'Partner',
              last_name: '',
              business_name: 'Business'
            });
          }
        } else {
          setError('This referral code is not available for customer signup.');
        }
      } else if (response.status === 404) {
        setError('This referral code is not valid or has been deactivated.');
      } else {
        setError('Unable to verify referral code. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching partner info:', error);
      setError('Unable to load referral information. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPartnerName = () => {
    if (!partnerInfo) return 'Our Partner';
    return partnerInfo.business_name || `${partnerInfo.first_name} ${partnerInfo.last_name}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your referral...</p>
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Referral Not Available</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link href="/">
              <Button>Go to Home Page</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Pawtraits</h1>
                <p className="text-sm text-gray-600">You've Been Invited!</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">Special Invitation</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Gift className="w-16 h-16 text-purple-600" />
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-2">
            You've Been Invited by {getPartnerName()}!
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {getPartnerName()} wants to treat you to beautiful AI-generated pet portraits.
            Sign up now to receive <strong>20% off your first purchase</strong>!
          </p>
        </div>

        {/* Partner Information */}
        {partnerInfo && (
          <div className="mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center space-x-4 mb-4">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                    <Building className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {getPartnerName()}
                    </h3>
                    {partnerInfo.business_type && (
                      <p className="text-gray-600 capitalize text-lg">
                        {partnerInfo.business_type}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-gray-600">
                    Your trusted pet care professional has partnered with Pawtraits to bring you
                    exclusive savings on custom AI pet portraits.
                  </p>
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
                  <Star className="w-5 h-5 text-yellow-500" />
                  Get Your 20% Discount
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-green-200 bg-green-50">
                  <Percent className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    <strong>Exclusive Offer:</strong> Save 20% on your first Pawtraits order when you sign up through this referral link!
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-purple-600">1</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Create Your Account</h4>
                      <p className="text-sm text-gray-600">
                        Sign up for Pawtraits with your email to unlock your exclusive discount
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-purple-600">2</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Upload Your Pet's Photo</h4>
                      <p className="text-sm text-gray-600">
                        Upload your favorite photo of your pet and customize your portrait style
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-purple-600">3</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Get Your Discount</h4>
                      <p className="text-sm text-gray-600">
                        Your 20% discount will be automatically applied at checkout
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Link href={`/signup/user?partner=${partnerInfo?.email}&code=${code}&discount=20`}>
                    <Button size="lg" className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
                      <ArrowRight className="w-5 h-5 mr-2" />
                      Claim Your 20% Discount
                    </Button>
                  </Link>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Referred by {getPartnerName()} • Code: {code}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Why Pawtraits */}
            <Card>
              <CardHeader>
                <CardTitle>Why Pet Parents Love Pawtraits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-red-500" />
                      <span className="font-medium">AI-Powered Art</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Create stunning, personalized portraits of your beloved pet using advanced AI technology
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Multiple Formats</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Choose from canvas prints, digital downloads, and more format options
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500" />
                      <span className="font-medium">Custom Styles</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Select from dozens of artistic styles to match your home decor perfectly
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">Trusted by Professionals</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Recommended by pet groomers, vets, and pet care professionals nationwide
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
                <CardTitle className="text-lg">Your Exclusive Offer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-purple-600">20%</p>
                    <p className="text-sm text-purple-700">OFF Your First Order</p>
                  </div>
                </div>

                <div className="text-xs text-gray-500 text-center space-y-1">
                  <p>• Discount applied automatically</p>
                  <p>• Valid for first purchase only</p>
                  <p>• Cannot be combined with other offers</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Already have an account?</CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/auth/login?redirect=/shop&partner=${partnerInfo?.email}&code=${code}`}>
                  <Button variant="outline" className="w-full">
                    Sign In to Apply Discount
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Questions?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Contact {getPartnerName()} or reach out to our support team.
                </p>
                <Link href="/contact">
                  <Button variant="outline" size="sm" className="w-full">
                    Contact Support
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            This exclusive offer is brought to you by {getPartnerName()}.
          </p>
          <p className="mt-2">
            Questions about Pawtraits?{' '}
            <Link href="/about" className="text-purple-600 hover:underline">
              Learn more about our service
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}