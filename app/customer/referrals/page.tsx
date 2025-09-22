'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Share2,
  QrCode,
  Copy,
  CheckCircle2,
  Users,
  Gift,
  Heart,
  Download,
  Mail,
  MessageCircle,
  Facebook,
  Twitter,
  Loader2,
  ExternalLink,
  TrendingUp
} from 'lucide-react';
import { useUserRouting } from '@/hooks/use-user-routing';
import { qrCodeService } from '@/lib/qr-code';

interface CustomerReferral {
  id: string;
  referral_code: string;
  total_referrals: number;
  successful_referrals: number;
  total_earned: number;
  status: string;
  created_at: string;
}

export default function CustomerReferralsPage() {
  const { userProfile, loading: userLoading } = useUserRouting();
  const [referral, setReferral] = useState<CustomerReferral | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [generatingQR, setGeneratingQR] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (userProfile?.email && !userLoading) {
      loadReferralData();
    }
  }, [userProfile, userLoading]);

  const loadReferralData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/customers/referrals?email=${encodeURIComponent(userProfile?.email || '')}`);

      if (response.ok) {
        const data = await response.json();
        setReferral(data.referral);

        // Generate QR code if referral exists
        if (data.referral?.referral_code) {
          generateQRCode(data.referral.referral_code);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load referral data');
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
      setError('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const createReferralCode = async () => {
    if (!userProfile?.email) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/customers/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: userProfile.email,
          customerName: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReferral(data.referral);

        if (data.referral?.referral_code) {
          generateQRCode(data.referral.referral_code);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create referral code');
      }
    } catch (error) {
      console.error('Error creating referral code:', error);
      setError('Failed to create referral code');
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (referralCode: string) => {
    try {
      setGeneratingQR(true);
      const qrDataUrl = await qrCodeService.generatePawtraitsQRCode(referralCode);
      setQrCodeDataUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setGeneratingQR(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl || !referral) return;

    const link = document.createElement('a');
    link.download = `pawtraits-referral-${referral.referral_code}.png`;
    link.href = qrCodeDataUrl;
    link.click();
  };

  const shareViaEmail = () => {
    if (!referral) return;

    const subject = encodeURIComponent('Get 20% off your first Pawtraits order!');
    const body = encodeURIComponent(
      `Hi!\n\nI wanted to share Pawtraits with you - they create beautiful AI-generated portraits of pets!\n\nUse my referral code ${referral.referral_code} to get 20% off your first order.\n\nCheck it out: ${getReferralUrl()}\n\nBest regards!`
    );

    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareOnSocial = (platform: string) => {
    if (!referral) return;

    const url = getReferralUrl();
    const message = encodeURIComponent(`Check out Pawtraits! Get 20% off your first AI pet portrait with code ${referral.referral_code}`);

    let shareUrl = '';
    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${message}&url=${encodeURIComponent(url)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${message} ${encodeURIComponent(url)}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  const getReferralUrl = () => {
    return `${window.location.origin}/r/customer/${referral?.referral_code}`;
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading your referral information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
              <Share2 className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Share & Earn</h1>
          <p className="text-lg text-gray-600 mt-2">
            Share Pawtraits with friends and earn rewards for every successful referral
          </p>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-600">{error}</AlertDescription>
          </Alert>
        )}

        {!referral ? (
          // Create referral code section
          <Card className="mb-8">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Gift className="w-5 h-5 text-purple-600" />
                Get Started with Referrals
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="space-y-4">
                <p className="text-gray-600">
                  Create your personal referral code to start sharing Pawtraits with friends and family.
                </p>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-2">Referral Benefits</h4>
                  <ul className="text-sm text-purple-800 space-y-1">
                    <li>• Your friends get 20% off their first order</li>
                    <li>• You earn points for every successful referral</li>
                    <li>• Share via QR codes, links, or social media</li>
                  </ul>
                </div>
              </div>
              <Button
                onClick={createReferralCode}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4 mr-2" />
                    Create My Referral Code
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Referral dashboard
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{referral.total_referrals}</p>
                  <p className="text-sm text-gray-600">Total Referrals</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{referral.successful_referrals}</p>
                  <p className="text-sm text-gray-600">Successful Orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">£{(referral.total_earned / 100).toFixed(2)}</p>
                  <p className="text-sm text-gray-600">Total Earned</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Referral Code & QR */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-purple-600" />
                    Your Referral Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Referral Code */}
                  <div className="space-y-2">
                    <Label htmlFor="referralCode">Referral Code</Label>
                    <div className="flex gap-2">
                      <Input
                        id="referralCode"
                        value={referral.referral_code}
                        readOnly
                        className="font-mono text-lg"
                      />
                      <Button
                        onClick={() => copyToClipboard(referral.referral_code)}
                        variant="outline"
                        size="icon"
                      >
                        {copySuccess ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Referral URL */}
                  <div className="space-y-2">
                    <Label htmlFor="referralUrl">Referral Link</Label>
                    <div className="flex gap-2">
                      <Input
                        id="referralUrl"
                        value={getReferralUrl()}
                        readOnly
                        className="text-sm"
                      />
                      <Button
                        onClick={() => copyToClipboard(getReferralUrl())}
                        variant="outline"
                        size="icon"
                      >
                        {copySuccess ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="text-center">
                    {generatingQR ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                        <span className="ml-2 text-gray-600">Generating QR code...</span>
                      </div>
                    ) : qrCodeDataUrl ? (
                      <div className="space-y-4">
                        <div className="bg-white p-4 rounded-lg border inline-block">
                          <img
                            src={qrCodeDataUrl}
                            alt="Referral QR Code"
                            className="w-48 h-48"
                          />
                        </div>
                        <Button
                          onClick={downloadQRCode}
                          variant="outline"
                          size="sm"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download QR Code
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => generateQRCode(referral.referral_code)}
                        variant="outline"
                      >
                        <QrCode className="w-4 h-4 mr-2" />
                        Generate QR Code
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Sharing Options */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-purple-600" />
                    Share Your Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Share your referral code with friends and family to earn rewards when they make their first purchase.
                  </p>

                  {/* Email Sharing */}
                  <Button
                    onClick={shareViaEmail}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Share via Email
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </Button>

                  {/* Social Media Sharing */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Social Media</p>
                    <div className="grid grid-cols-1 gap-2">
                      <Button
                        onClick={() => shareOnSocial('whatsapp')}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Share on WhatsApp
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </Button>
                      <Button
                        onClick={() => shareOnSocial('facebook')}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <Facebook className="w-4 h-4 mr-2" />
                        Share on Facebook
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </Button>
                      <Button
                        onClick={() => shareOnSocial('twitter')}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <Twitter className="w-4 h-4 mr-2" />
                        Share on Twitter
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </Button>
                    </div>
                  </div>

                  {/* How it Works */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mt-6">
                    <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      How It Works
                    </h4>
                    <ol className="text-sm text-purple-800 space-y-1">
                      <li>1. Share your code or link with friends</li>
                      <li>2. They get 20% off their first order</li>
                      <li>3. You earn rewards when they purchase</li>
                      <li>4. Everyone wins!</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}