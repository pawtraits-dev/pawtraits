'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  QrCode,
  CheckCircle2,
  Building,
  Users,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  Heart,
  Star,
  Gift
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface PreRegistrationCode {
  id: string;
  code: string;
  status: string;
  business_category?: string;
  marketing_campaign?: string;
  scans_count: number;
  conversions_count: number;
  created_at: string;
  expiration_date?: string;
}

export default function PreRegistrationLandingPage() {
  const params = useParams();
  const router = useRouter();
  const [codeData, setCodeData] = useState<PreRegistrationCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanRecorded, setScanRecorded] = useState(false);

  useEffect(() => {
    if (params.code) {
      verifyAndRecordScan();
    }
  }, [params.code]);

  const verifyAndRecordScan = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/p/${params.code}`);

      if (response.ok) {
        const data = await response.json();
        setCodeData(data);
        setScanRecorded(true);

        // Record the scan in analytics
        recordScanAnalytics(data.id);
      } else if (response.status === 404) {
        setError('This QR code is not valid or has been deactivated.');
      } else if (response.status === 410) {
        setError('This QR code has expired.');
      } else {
        setError('Unable to verify QR code. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying pre-registration code:', error);
      setError('Unable to verify QR code. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const recordScanAnalytics = async (codeId: string) => {
    try {
      await fetch('/api/p/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code_id: codeId,
          event_type: 'scan',
          metadata: {
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            referrer: document.referrer
          }
        })
      });
    } catch (error) {
      // Don't fail the page load if analytics fails
      console.error('Failed to record scan analytics:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying QR code...</p>
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
            <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid QR Code</h2>
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
                <p className="text-sm text-gray-600">Partner Registration</p>
              </div>
            </div>
            {scanRecorded && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">QR Code Verified</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <QrCode className="w-16 h-16 text-purple-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Pawtraits Partner Program!
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            You&apos;ve scanned a special partner invitation QR code. Join our network of pet care professionals
            and start earning commissions by referring customers to beautiful AI-generated pet portraits.
          </p>
        </div>

        {/* Code Information */}
        {codeData && (
          <div className="mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div>
                    <QrCode className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Invitation Code</p>
                    <p className="font-mono font-bold text-lg">{codeData.code}</p>
                  </div>
                  {codeData.business_category && (
                    <div>
                      <Building className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Target Category</p>
                      <p className="font-medium capitalize">{codeData.business_category}</p>
                    </div>
                  )}
                  <div>
                    <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Others Joined</p>
                    <p className="font-bold text-lg text-green-600">{codeData.conversions_count}</p>
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
                  Join the Pawtraits Partner Network
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-purple-600">1</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Register as a Partner</h4>
                      <p className="text-sm text-gray-600">
                        Complete your partner application with business details and verification
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-purple-600">2</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Get Approved</h4>
                      <p className="text-sm text-gray-600">
                        Our team reviews your application and approves qualified partners
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-purple-600">3</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Start Earning</h4>
                      <p className="text-sm text-gray-600">
                        Refer customers and earn 20% commission on first orders, 5% on subsequent orders
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Link href={`/signup/partner?ref=${codeData?.code}`}>
                    <Button size="lg" className="w-full">
                      <ArrowRight className="w-5 h-5 mr-2" />
                      Join as Partner Now
                    </Button>
                  </Link>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    This will link your registration to invitation code {codeData?.code}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Business Benefits */}
            <Card>
              <CardHeader>
                <CardTitle>Why Partner with Pawtraits?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      <span className="font-medium">High Commissions</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Earn 20% on first orders and 5% on repeat purchases from your referrals
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-red-500" />
                      <span className="font-medium">Customer Delight</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Offer your customers beautiful AI-generated portraits of their beloved pets
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Building className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">Business Integration</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Easy to integrate with your existing pet care services
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-purple-500" />
                      <span className="font-medium">Marketing Support</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      We provide marketing materials and QR codes to help you promote
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
                <CardTitle className="text-lg">Commission Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">20%</p>
                    <p className="text-sm text-green-700">First Order Commission</p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">5%</p>
                    <p className="text-sm text-blue-700">Repeat Order Commission</p>
                  </div>
                </div>

                <div className="text-xs text-gray-500 text-center">
                  Commission calculated on order total (excluding shipping)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Perfect for:</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Pet groomers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Veterinary clinics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Pet stores</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Dog trainers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Pet photographers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>Pet boarding services</span>
                  </li>
                </ul>
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
            <a href="mailto:partners@pawtraits.com" className="text-purple-600 hover:underline">
              partners@pawtraits.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}