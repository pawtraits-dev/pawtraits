'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, Share2, Smartphone, Mail, MessageSquare, QrCode, CheckCircle, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import type { ImageCatalogWithDetails } from '@/lib/types';
import { getSupabaseClient } from '@/lib/supabase-client';

interface PartnerQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: ImageCatalogWithDetails;
  partnerId: string;
  partnerInfo?: {
    business_name?: string;
    first_name?: string;
    last_name?: string;
  };
}

export default function PartnerQRModal({ 
  isOpen, 
  onClose, 
  image, 
  partnerId, 
  partnerInfo 
}: PartnerQRModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [clientMessage, setClientMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralUrl, setReferralUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [hasCreatedReferral, setHasCreatedReferral] = useState(false);

  const supabase = getSupabaseClient();

  // Default client message - will be updated when referral is created
  const getDefaultMessage = (url: string) => `Hi! I found this amazing pet portrait that would be perfect for you. Check it out and get a special discount through my recommendation!

${image.description || 'Custom AI-generated pet portrait'}

Click the link or scan the QR code to view and purchase:
${url}

Best regards,
${partnerInfo?.business_name || `${partnerInfo?.first_name} ${partnerInfo?.last_name}` || 'Your Partner'}`;

  useEffect(() => {
    if (isOpen && !hasCreatedReferral) {
      createReferralAndGenerateQR();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasCreatedReferral(false);
      setReferralCode('');
      setReferralUrl('');
      setQrCodeUrl('');
      setError('');
    }
  }, [isOpen]);

  const createReferralAndGenerateQR = async () => {
    try {
      setGenerating(true);
      setError('');

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Create referral record for Method 2 (image sharing)
      const response = await fetch('/api/referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          referral_type: 'image_share',
          image_id: image.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create referral');
      }

      const referralData = await response.json();
      setReferralCode(referralData.referral_code);
      
      // Generate new URL with referral code instead of partner ID
      const newReferralUrl = `${window.location.origin}/r/${referralData.referral_code}`;
      setReferralUrl(newReferralUrl);
      
      // Update message with the new URL
      setClientMessage(getDefaultMessage(newReferralUrl));

      // Generate QR code with the referral URL
      const qrDataUrl = await QRCode.toDataURL(newReferralUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#374151', // gray-700
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrDataUrl);
      
      // Mark that we've successfully created a referral for this modal session
      setHasCreatedReferral(true);

    } catch (error) {
      console.error('Error creating referral and QR code:', error);
      setError(error instanceof Error ? error.message : 'Failed to create referral');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.download = `qr-code-${referralCode || image.filename || 'portrait'}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Check out this amazing pet portrait!`);
    const body = encodeURIComponent(clientMessage);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  const shareViaSMS = () => {
    const message = encodeURIComponent(`Check out this pet portrait with my discount: ${referralUrl}`);
    window.open(`sms:?body=${message}`);
  };

  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(clientMessage);
    window.open(`https://wa.me/?text=${message}`);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-purple-600" />
            <span>Share with Client</span>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              10% OFF
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Generate a QR code and referral link to share this portrait with your client. 
            They'll get a discount and you'll earn commission on any purchases.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          
          {/* Error Display */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-center space-x-2 text-red-800">
                  <span className="text-sm">❌ {error}</span>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Image Preview */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={image.public_url}
                    alt={image.description || 'Pet portrait'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">{image.description || 'Custom Pet Portrait'}</h4>
                  <div className="flex space-x-2 mt-1">
                    {image.breed_name && (
                      <Badge variant="outline" className="text-xs">{image.breed_name}</Badge>
                    )}
                    {image.theme_name && (
                      <Badge variant="outline" className="text-xs">{image.theme_name}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* QR Code */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">QR Code</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                {generating ? (
                  <div className="w-[200px] h-[200px] mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="flex flex-col items-center space-y-2">
                      <Loader2 className="animate-spin h-8 w-8 text-purple-600" />
                      <p className="text-sm text-gray-600">Creating unique referral...</p>
                    </div>
                  </div>
                ) : qrCodeUrl ? (
                  <div className="mx-auto">
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      className="mx-auto border rounded-lg"
                      width={200}
                      height={200}
                    />
                    {referralCode && (
                      <p className="text-xs text-gray-600 mt-2">
                        Referral Code: <code className="bg-gray-100 px-2 py-1 rounded">{referralCode}</code>
                      </p>
                    )}
                  </div>
                ) : error ? (
                  <div className="w-[200px] h-[200px] mx-auto bg-red-50 rounded-lg flex items-center justify-center">
                    <p className="text-sm text-red-600">Failed to generate QR code</p>
                  </div>
                ) : null}
                
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadQRCode}
                    disabled={!qrCodeUrl || generating}
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download QR Code
                  </Button>
                  <p className="text-xs text-gray-600">
                    Perfect for printing or sharing digitally
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Sharing Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Share Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Referral Link */}
                <div>
                  <Label className="text-xs font-medium text-gray-700">Referral Link</Label>
                  <div className="flex space-x-2 mt-1">
                    <Input
                      value={referralUrl}
                      readOnly
                      className="text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(referralUrl)}
                    >
                      {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Quick Share Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareViaEmail}
                    disabled={!referralUrl || generating}
                    className="text-xs"
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareViaSMS}
                    disabled={!referralUrl || generating}
                    className="text-xs"
                  >
                    <Smartphone className="w-4 h-4 mr-1" />
                    SMS
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={shareViaWhatsApp}
                    disabled={!referralUrl || generating}
                    className="text-xs"
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Custom Message */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Custom Message</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Textarea
                  value={clientMessage}
                  onChange={(e) => setClientMessage(e.target.value)}
                  rows={6}
                  className="text-sm"
                  placeholder="Customize your message to the client..."
                />
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(clientMessage)}
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Message
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setClientMessage(getDefaultMessage(referralUrl))}
                    variant="outline"
                    disabled={!referralUrl}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Benefits */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h5 className="font-semibold text-green-800">Client Benefits</h5>
                  <ul className="text-green-700 text-xs mt-1 space-y-1">
                    <li>• 10% discount on first order</li>
                    <li>• High-quality AI portraits</li>
                    <li>• Multiple product formats</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-semibold text-green-800">Your Benefits</h5>
                  <ul className="text-green-700 text-xs mt-1 space-y-1">
                    <li>• 10% commission on sales</li>
                    <li>• Track referral performance</li>
                    <li>• Build client relationships</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </DialogContent>
    </Dialog>
  );
}