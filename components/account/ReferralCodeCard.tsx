'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  QrCode,
  Copy,
  Download,
  Share2,
  ExternalLink,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// 🏗️ REFERRAL CODE CARD COMPONENT
// Reusable component for displaying referral codes with QR sharing functionality
// Used in both Partner and Customer account views

interface ReferralCodeCardProps {
  userType: 'partner' | 'customer';
  userEmail: string;
}

interface ReferralCodeData {
  code: string;
  share_url: string;
  qr_code_url?: string | null;
}

export default function ReferralCodeCard({ userType, userEmail }: ReferralCodeCardProps) {
  const [referralCode, setReferralCode] = useState<ReferralCodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  // Determine color scheme based on user type
  const colorScheme = userType === 'partner'
    ? {
        border: 'border-green-200',
        gradient: 'from-green-50 to-white',
        accent: 'text-green-600',
        accentBg: 'bg-green-100',
        accentBorder: 'border-green-300',
        button: 'hover:bg-green-50'
      }
    : {
        border: 'border-purple-200',
        gradient: 'from-purple-50 to-white',
        accent: 'text-purple-600',
        accentBg: 'bg-purple-100',
        accentBorder: 'border-purple-300',
        button: 'hover:bg-purple-50'
      };

  useEffect(() => {
    fetchReferralCode();
  }, []);

  const fetchReferralCode = async () => {
    try {
      setLoading(true);
      const endpoint = userType === 'partner'
        ? '/api/partners/referral-code'
        : `/api/customers/referral-code?email=${encodeURIComponent(userEmail)}`;

      console.log('[ReferralCodeCard] Fetching from endpoint:', endpoint);

      const response = await fetch(endpoint, {
        credentials: 'include'
      });

      console.log('[ReferralCodeCard] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[ReferralCodeCard] Received data:', data);
        setReferralCode(data);
      } else {
        console.error('[ReferralCodeCard] API error:', response.status, await response.text());
      }
    } catch (error) {
      console.error('[ReferralCodeCard] Failed to fetch referral code:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'code' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadQRCode = async () => {
    if (!qrCodeRef.current || !referralCode) return;

    // If we have a branded QR code URL, download it directly
    if (referralCode.qr_code_url) {
      try {
        const response = await fetch(referralCode.qr_code_url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `referral-qr-${referralCode.code}.png`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to download QR code:', error);
      }
      return;
    }

    // Fallback: Download the client-side generated SVG QR code
    const svg = qrCodeRef.current.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `referral-qr-${referralCode.code}.png`;
        link.click();
        URL.revokeObjectURL(url);
      });
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleShare = async () => {
    if (!referralCode) return;

    const fullUrl = typeof window !== 'undefined'
      ? `${window.location.origin}${referralCode.share_url}`
      : referralCode.share_url;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Pawtraits!',
          text: userType === 'partner'
            ? 'Partner with Pawtraits and earn commissions!'
            : 'Get amazing AI-generated pet portraits! Use my referral code.',
          url: fullUrl
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    }
  };

  if (loading) {
    return (
      <Card className={`${colorScheme.border} bg-gradient-to-br ${colorScheme.gradient}`}>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading referral code...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!referralCode) {
    return (
      <Card className={`${colorScheme.border} bg-gradient-to-br ${colorScheme.gradient}`}>
        <CardContent className="pt-6 pb-6">
          <p className="text-center text-gray-600">No referral code available</p>
        </CardContent>
      </Card>
    );
  }

  const fullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${referralCode.share_url}`
    : referralCode.share_url;

  return (
    <Card className={`${colorScheme.border} bg-gradient-to-br ${colorScheme.gradient}`}>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Share2 className={`h-5 w-5 mr-2 ${colorScheme.accent}`} />
          Your Referral Code
        </CardTitle>
        <CardDescription>
          Quick access to your referral code and QR code
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Code and URL */}
          <div className="space-y-3">
            {/* Referral Code */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Referral Code
              </label>
              <div className="flex items-center gap-2">
                <div className={`flex-1 bg-white border ${colorScheme.accentBorder} rounded-md px-3 py-2`}>
                  <p className={`text-xl font-bold ${colorScheme.accent} tracking-wider text-center`}>
                    {referralCode.code}
                  </p>
                </div>
                <Button
                  onClick={() => copyToClipboard(referralCode.code, 'code')}
                  variant="outline"
                  size="sm"
                  className={colorScheme.button}
                >
                  {copied ? (
                    <CheckCircle2 className={`h-4 w-4 ${colorScheme.accent}`} />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Share URL */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Share Link
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 overflow-hidden">
                  <p className="text-xs text-gray-700 truncate">
                    {fullUrl}
                  </p>
                </div>
                <Button
                  onClick={() => copyToClipboard(fullUrl, 'url')}
                  variant="outline"
                  size="sm"
                  className={colorScheme.button}
                >
                  {copiedUrl ? (
                    <CheckCircle2 className={`h-4 w-4 ${colorScheme.accent}`} />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => window.open('/referrals', '_blank')}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Full Analytics
              </Button>
              {navigator.share && (
                <Button
                  onClick={handleShare}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Share2 className="h-3 w-3 mr-1" />
                  Share
                </Button>
              )}
            </div>
          </div>

          {/* Right: QR Code */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div ref={qrCodeRef} className={`bg-white p-3 rounded-lg border ${colorScheme.accentBorder}`}>
              {referralCode.qr_code_url ? (
                // Use stored branded QR code
                <img
                  src={referralCode.qr_code_url}
                  alt="Branded QR Code"
                  width={140}
                  height={140}
                  className="rounded"
                />
              ) : (
                // Fallback to client-side generated QR code
                <QRCodeSVG
                  value={fullUrl}
                  size={140}
                  level="H"
                  includeMargin={true}
                />
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadQRCode}
              className="text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Download QR
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 📋 COMPONENT CHECKLIST:
// ✅ Reusable for both partner and customer views
// ✅ Dynamic color scheme based on user type
// ✅ No direct database queries
// ✅ Uses API endpoints for data access
// ✅ Client-side QR generation with qrcode.react
// ✅ Copy, download, and share functionality
// ✅ Responsive design
// ✅ Loading and error states
