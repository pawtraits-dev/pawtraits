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
  Star,
  Gift
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Partner {
  id: string;
  business_name?: string;
  first_name: string;
  last_name: string;
  logo_url?: string;
}

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
  partner?: Partner;
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

        // Handle redirect for used codes
        if (data.redirect === 'customer_referral') {
          // Redirect to main referral landing page with the generated referral code
          router.push(`/r/${data.referral_code}`);
          return;
        } else if (data.redirect === 'customer_signup') {
          // Fallback for old format
          router.push(`/r/partner/${data.code}`);
          return;
        }

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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying QR code...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <img src="/assets/logos/paw-svgrepo-200x200-green.svg" alt="Pawtraits Logo" className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Pawtraits</h1>
                <p className="text-sm text-gray-600">Partner Registration</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Partner Logo */}
              {codeData?.partner?.logo_url && (
                <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border">
                  <img
                    src={codeData.partner.logo_url}
                    alt={`${codeData.partner.business_name || `${codeData.partner.first_name} ${codeData.partner.last_name}`} Logo`}
                    className="w-8 h-8 object-contain rounded"
                  />
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">
                      {codeData.partner.business_name || `${codeData.partner.first_name} ${codeData.partner.last_name}`}
                    </p>
                    <p className="text-gray-500">Referring Partner</p>
                  </div>
                </div>
              )}
              {scanRecorded && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">QR Code Verified</span>
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
            {codeData?.partner?.logo_url ? (
              <div className="w-20 h-20 p-2 bg-white border border-green-200 rounded-2xl shadow-sm">
                <img
                  src={codeData.partner.logo_url}
                  alt="Partner Logo"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
            ) : (
              <QrCode className="w-16 h-16 text-green-600" />
            )}
          </div>

          {codeData?.partner ? (
            <>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                You&apos;re Invited by {codeData.partner.business_name || `${codeData.partner.first_name} ${codeData.partner.last_name}`}!
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {codeData.partner.business_name || `${codeData.partner.first_name} ${codeData.partner.last_name}`} has invited you to join the Pawtraits Partner Program.
                
              </p>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome to Pawtraits Partner Program!
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                You&apos;ve scanned a special partner invitation QR code. Join our network of pet care professionals, and start earning referral bonuses and commissions.
                
              </p>
            </>
          )}
        </div>

        {/* Code Information */}
        {codeData && (
          <div className="mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div>
                    <QrCode className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Invitation Code</p>
                    <p className="font-mono font-bold text-lg">{codeData.code}</p>
                  </div>
                  {codeData.business_category && (
                    <div>
                      <Building className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Partner Type</p>
                      <p className="font-medium capitalize">{codeData.business_category}</p>
                    </div>
                  )}
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
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-green-600">1</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Register as a Partner</h4>
                      <p className="text-sm text-gray-600">
                        Complete your partner application with your business details 
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-green-600">2</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Get Approved</h4>
                      <p className="text-sm text-gray-600">
                        Share your referral code with your customers giving them an introductory 10% discount
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-bold text-green-600">3</span>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Start Earning</h4>
                      <p className="text-sm text-gray-600">
                        Earn 10% commission on referred customer orders - for life
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
                      Earn 10% commission on referred customer orders
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-red-500" />
                      <span className="font-medium">Customer Delight</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Customers love Patraits, and receive a 10% discount by using your uniqie code
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Building className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">Business Integration</span>
                    </div>
                    <p className="text-sm text-gray-600 pl-7">
                      Natural fit with your existing products and services
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
                    <p className="text-2xl font-bold text-green-600">10%</p>
                    <p className="text-sm text-green-700">Commission</p>
                  </div>
                </div>



                <div className="text-xs text-gray-500 text-center">
                  Commission calculated on order total (excluding shipping)
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
            <a href="mailto:partners@pawtraits.pics" className="text-green-600 hover:underline">
              partners@pawtraits.pics
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}