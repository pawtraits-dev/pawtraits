'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Heart,
  CheckCircle2,
  Users,
  Gift,
  ArrowRight,
  AlertCircle,
  Loader2,
  Star
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import UserAwareNavigation from '@/components/UserAwareNavigation';

interface CustomerReferral {
  id: string;
  referral_code: string;
  customer_name: string;
  customer_email: string;
  status: string;
  total_referrals: number;
  successful_referrals: number;
}

export default function CustomerReferralLandingPage() {
  const params = useParams();
  const router = useRouter();
  const [referralData, setReferralData] = useState<CustomerReferral | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanRecorded, setScanRecorded] = useState(false);

  useEffect(() => {
    if (params.code) {
      verifyReferralCode();
    }
  }, [params.code]);

  const verifyReferralCode = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/customer-referrals/verify/${params.code}`);

      if (response.ok) {
        const data = await response.json();
        setReferralData(data.referral);
        setScanRecorded(true);

        // Record referral access analytics
        recordReferralAccess(data.referral.id);
      } else if (response.status === 404) {
        setError('This referral code is not valid or has been deactivated.');
      } else if (response.status === 410) {
        setError('This referral code has expired.');
      } else {
        setError('Unable to verify referral code. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying customer referral code:', error);
      setError('Unable to verify referral code. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const recordReferralAccess = async (referralId: string) => {
    try {
      await fetch('/api/customer-referrals/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_id: referralId,
          event_type: 'access',
          metadata: {
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            referrer: document.referrer
          }
        })
      });
    } catch (error) {
      // Don't fail the page load if analytics fails
      console.error('Failed to record referral access analytics:', error);
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
      <>
        <UserAwareNavigation />
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
      </>
    );
  }

  return (
    <>
      <UserAwareNavigation />
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
                  <p className="text-sm text-gray-600">Friend Referral</p>
                </div>
              </div>
              {scanRecorded && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Referral Verified</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center">
                <Gift className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              You've been invited to Pawtraits!
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {referralData?.customer_name} wants to share something special with you -
              beautiful AI-generated portraits of your beloved pets with <strong>20% off your first order</strong>!
            </p>
          </div>

          {/* Referral Information */}
          {referralData && (
            <div className="mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                    <div>
                      <Gift className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Referral Code</p>
                      <p className="font-mono font-bold text-lg">{referralData.referral_code}</p>
                    </div>
                    <div>
                      <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Friends Referred</p>
                      <p className="font-bold text-lg text-blue-600">{referralData.total_referrals}</p>
                    </div>
                    <div>
                      <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Happy Customers</p>
                      <p className="font-bold text-lg text-green-600">{referralData.successful_referrals}</p>
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
                    <Star className="w-5 h-5 text-yellow-500" />
                    Get 20% Off Your First Order
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-900">Special Offer Active</span>
                    </div>
                    <p className="text-green-800 text-sm">
                      Use code <strong>{referralData?.referral_code}</strong> at checkout to save 20% on your first Pawtraits order!
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-purple-600">1</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Create Your Account</h4>
                        <p className="text-sm text-gray-600">
                          Sign up for free to access our gallery of AI-generated pet portraits
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-purple-600">2</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Choose Your Portrait</h4>
                        <p className="text-sm text-gray-600">
                          Browse thousands of unique AI-generated portraits and find the perfect style
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-purple-600">3</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Apply Your Discount</h4>
                        <p className="text-sm text-gray-600">
                          Use referral code at checkout and save 20% on your first order
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Link href={`/signup?ref=${referralData?.referral_code}&returnTo=/browse`}>
                      <Button size="lg" className="w-full bg-purple-600 hover:bg-purple-700">
                        <ArrowRight className="w-5 h-5 mr-2" />
                        Start Shopping with 20% Off
                      </Button>
                    </Link>
                    <p className="text-xs text-gray-500 text-center mt-2">
                      This will automatically apply referral code {referralData?.referral_code} to your account
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* How Pawtraits Works */}
              <Card>
                <CardHeader>
                  <CardTitle>Why Choose Pawtraits?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Heart className="w-5 h-5 text-red-500" />
                        <span className="font-medium">AI-Generated Art</span>
                      </div>
                      <p className="text-sm text-gray-600 pl-7">
                        Unique, beautiful portraits created using advanced AI technology
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500" />
                        <span className="font-medium">Premium Quality</span>
                      </div>
                      <p className="text-sm text-gray-600 pl-7">
                        High-resolution artwork perfect for printing and displaying
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        <span className="font-medium">Thousands of Options</span>
                      </div>
                      <p className="text-sm text-gray-600 pl-7">
                        Browse our extensive gallery of pre-generated pet portraits
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Gift className="w-5 h-5 text-purple-500" />
                        <span className="font-medium">Perfect Gifts</span>
                      </div>
                      <p className="text-sm text-gray-600 pl-7">
                        Surprise pet owners with unique, personalized artwork
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
                  <CardTitle className="text-lg">Your Friend's Recommendation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <Heart className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-700">
                      <strong>{referralData?.customer_name}</strong> thinks you'll love Pawtraits!
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>✨ Join thousands</strong> of happy pet owners</p>
                    <p><strong>🎨 Unique AI art</strong> for every pet personality</p>
                    <p><strong>🎁 Perfect gifts</strong> for pet lovers everywhere</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Special Discount</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-green-600">20%</p>
                        <p className="text-sm text-green-700">OFF First Order</p>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500">
                      <p>• Valid for new customers only</p>
                      <p>• Automatically applied with referral code</p>
                      <p>• Cannot be combined with other offers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Already have an account?</CardTitle>
                </CardHeader>
                <CardContent>
                  <Link href={`/auth/login?ref=${referralData?.referral_code}&returnTo=/browse`}>
                    <Button variant="outline" className="w-full">
                      Sign In & Shop
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
              <a href="mailto:support@pawtraits.com" className="text-purple-600 hover:underline">
                support@pawtraits.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}