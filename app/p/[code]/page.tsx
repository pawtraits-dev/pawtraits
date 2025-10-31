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
  Gift,
  Sparkles,
  HandHeart
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

function PreRegistrationLandingPageContent() {
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
        if (data.redirect === 'customer_invitation') {
          // Redirect to customer invitation page
          router.push(`/c/${data.code}`);
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
              <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid QR Code</h2>
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

  const getPartnerName = () => {
    if (!codeData?.partner) return 'Our Partner Network';
    return codeData.partner.business_name || `${codeData.partner.first_name} ${codeData.partner.last_name}`;
  };

  const getPartnerLogo = () => {
    if (codeData?.partner?.logo_url) {
      return (
        <div className="w-20 h-20 p-2 bg-white border border-purple-200 rounded-2xl shadow-sm">
          <Image
            src={codeData.partner.logo_url}
            alt="Partner Logo"
            width={80}
            height={80}
            className="w-full h-full object-contain rounded-xl"
          />
        </div>
      );
    } else {
      return (
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
          <HandHeart className="w-12 h-12 text-purple-600" />
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
            {/* Partner Logo */}
            <div className="flex items-center justify-center mb-6">
              {getPartnerLogo()}
            </div>

            <h1 className="text-4xl lg:text-6xl font-bold mb-6 font-[family-name:var(--font-life-savers)]">
              {codeData?.partner ? `You're Invited by ${getPartnerName()}!` : 'Join Pawtraits Partner Network!'}
            </h1>
            <p className="text-xl lg:text-2xl mb-8 max-w-3xl mx-auto opacity-90">
              {codeData?.partner ?
                `${getPartnerName()} has invited you to join the Pawtraits Partner Program. Start earning commissions and help pet parents create beautiful AI portraits.` :
                "You've scanned a special partner invitation QR code. Join our network of pet care professionals and start earning referral bonuses and commissions."
              }
            </p>

            {/* Main CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href={`/signup/partner?ref=${codeData?.code}`}>
                <Button
                  size="lg"
                  className="bg-white text-purple-600 hover:bg-gray-100 shadow-lg text-lg px-8 py-4"
                >
                  <Sparkles className="w-6 h-6 mr-2" />
                  Join as Partner Now
                </Button>
              </Link>
            </div>

            {/* QR verification badge */}
            {scanRecorded && (
              <div className="flex items-center justify-center gap-2 mt-6 text-green-200">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">QR Code Verified</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Partner Information Card */}
      {codeData && (
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
                    <p className="font-mono font-bold text-xl text-purple-600">{codeData.code}</p>
                  </div>
                  {codeData.business_category && (
                    <div className="space-y-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                        <Building className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-600">Partner Type</p>
                      <p className="font-bold text-lg text-gray-900 capitalize">{codeData.business_category}</p>
                    </div>
                  )}
                  {codeData?.partner && (
                    <div className="space-y-3">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        {codeData.partner.logo_url ? (
                          <Image
                            src={codeData.partner.logo_url}
                            alt={getPartnerName()}
                            width={32}
                            height={32}
                            className="w-8 h-8 object-contain rounded-full"
                          />
                        ) : (
                          <HandHeart className="w-6 h-6 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-600">Referring Partner</p>
                      <p className="font-bold text-lg text-gray-900">{getPartnerName()}</p>
                    </div>
                  )}
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
              Join the Pawtraits Partner Network
            </h2>
            <p className="text-xl text-gray-600">
              Become part of our growing network of pet care professionals in just three steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 - Direct CTA Link */}
            <Link href={`/signup/partner?ref=${codeData?.code}#signup-form`} className="group">
              <Card className="text-center bg-white shadow-lg border-0 hover:shadow-xl transition-all hover:border-purple-500 hover:scale-105 cursor-pointer h-full">
                <CardContent className="p-8">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-purple-600 transition-colors">
                    <span className="text-2xl font-bold text-purple-600 group-hover:text-white transition-colors">1</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-purple-600 transition-colors">Register as a Partner</h3>
                  <p className="text-gray-600 mb-4">
                    Complete your partner application with your business details and get approved to start referring customers.
                  </p>
                  <div className="flex items-center justify-center text-purple-600 font-semibold group-hover:underline">
                    <span className="mr-2">Get Started</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Step 2 */}
            <Card className="text-center bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-purple-600">2</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Share Your Code</h3>
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
                <h3 className="text-xl font-bold text-gray-900 mb-4">Start Earning</h3>
                <p className="text-gray-600">
                  Earn 10% commission on all referred customer orders - for life. Track your earnings in your partner dashboard.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-life-savers)]">
              Why Partner with Pawtraits?
            </h2>
            <p className="text-xl text-gray-600">
              Join the growing network of successful pet care professionals
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Benefit 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">High Commissions</h3>
              <p className="text-gray-600">Earn 10% commission on all referred customer orders with no caps or limits.</p>
            </div>

            {/* Benefit 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Customer Delight</h3>
              <p className="text-gray-600">Customers love Pawtraits and get a 10% discount with your unique referral code.</p>
            </div>

            {/* Benefit 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Perfect Integration</h3>
              <p className="text-gray-600">AI pet portraits are a natural fit with your existing pet care products and services.</p>
            </div>

            {/* Benefit 4 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HandHeart className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Lifetime Earnings</h3>
              <p className="text-gray-600">Once you refer a customer, you earn commission on all their future orders forever.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Commission Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6 font-[family-name:var(--font-life-savers)]">
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
              <p className="text-gray-600">
                Commission calculated on order total (excluding shipping) • Paid monthly • No minimum thresholds
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6 font-[family-name:var(--font-life-savers)]">
            Ready to Join Our Partner Network?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Start earning commissions by helping pet parents create beautiful AI portraits
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href={`/signup/partner?ref=${codeData?.code}`}>
              <Button
                size="lg"
                className="bg-white text-purple-600 hover:bg-gray-100 shadow-lg text-lg px-8 py-4"
              >
                <ArrowRight className="w-6 h-6 mr-2" />
                Join as Partner Now
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
            Registration will be linked to invitation code {codeData?.code}
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
            <p className="text-gray-400 mb-4">Partner Program</p>
            <p className="text-sm text-gray-500">
              Questions? Contact us at{' '}
              <a href="mailto:partners@pawtraits.pics" className="text-purple-400 hover:underline">
                partners@pawtraits.pics
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

export default function PreRegistrationLandingPage() {
  return (
    <CountryProvider>
      <PreRegistrationLandingPageContent />
    </CountryProvider>
  );
}