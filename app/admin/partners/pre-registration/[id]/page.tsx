'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  QrCode,
  Calendar,
  Building,
  Tag,
  Scan,
  Users,
  TrendingUp,
  Download,
  AlertCircle,
  CheckCircle2,
  Edit,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { PreRegistrationCodeWithPartner } from '@/lib/types';

export default function PreRegistrationCodeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [code, setCode] = useState<PreRegistrationCodeWithPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      loadCodeDetails();
    }
  }, [params.id]);

  const loadCodeDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/pre-registration/${params.id}`);

      if (response.ok) {
        const data = await response.json();
        setCode(data);

        // Generate QR code URL
        if (data.code) {
          generateQRCode(data.code);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load code details');
      }
    } catch (error) {
      console.error('Error loading code details:', error);
      setError('Failed to load code details');
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (codeValue: string) => {
    try {
      const { QRCodeService } = await import('@/lib/qr-code');
      const qrCodeService = new QRCodeService();

      const qrUrl = `${window.location.origin}/p/${codeValue}`;

      // Create the paw logo SVG (rotated to fix upside-down issue)
      const logoUrl = 'data:image/svg+xml;base64,' + btoa(`
        <svg fill="#9333ea" width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <g transform="rotate(180 50 50)">
            <path d="M34.848,40.708c0-5.6-4.542-10.141-10.143-10.141c-5.601,0-10.141,4.541-10.141,10.141c0,5.604,4.539,10.143,10.141,10.143 C30.307,50.851,34.848,46.312,34.848,40.708z"/>
            <path d="M75.293,32.548c-5.6,0-10.141,4.541-10.141,10.141c0,5.604,4.541,10.141,10.141,10.141c5.601,0,10.142-4.537,10.142-10.141 C85.435,37.089,80.895,32.548,75.293,32.548z"/>
            <path d="M66.082,53.978c-0.705-0.869-1.703-1.875-2.849-2.93c-3.058-3.963-7.841-6.527-13.233-6.527 c-4.799,0-9.113,2.032-12.162,5.27c-1.732,1.507-3.272,2.978-4.252,4.188l-0.656,0.801c-3.06,3.731-6.869,8.373-6.841,16.25 c0.027,7.315,5.984,13.27,13.278,13.27c4.166,0,7.984-1.926,10.467-5.159c2.481,3.233,6.3,5.159,10.47,5.159 c7.291,0,13.247-5.954,13.275-13.27c0.028-7.877-3.782-12.519-6.841-16.25L66.082,53.978z"/>
            <circle cx="50.703" cy="26.877" r="11.175"/>
          </g>
        </svg>
      `);

      // Generate branded QR code with Pawtraits logo and purple theme
      const qrCodeDataUrl = await qrCodeService.generateQRCodeWithLogo(qrUrl, logoUrl, {
        width: 256,
        margin: 4,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#9333ea', // Pawtraits purple-600
          light: '#00000000' // Transparent background
        }
      });

      setQrCodeUrl(qrCodeDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleDownloadQR = async () => {
    if (!qrCodeUrl || !code) return;

    try {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `pre-registration-${code.code}.png`;
      link.click();
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'used': return 'bg-blue-100 text-blue-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      case 'deactivated': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/partners/pre-registration">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Codes
            </Button>
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/partners/pre-registration">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Codes
            </Button>
          </Link>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Code not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Link href="/admin/partners/pre-registration">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Codes
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Pre-Registration Code: <span className="font-mono">{code.code}</span>
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className={getStatusColor(code.status)}>
                {code.status}
              </Badge>
              {code.marketing_campaign && (
                <span className="text-sm text-gray-600">
                  Campaign: {code.marketing_campaign}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Code Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {qrCodeUrl ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={qrCodeUrl}
                    alt={`QR Code for ${code.code}`}
                    className="border rounded-lg"
                    width={200}
                    height={200}
                  />
                </div>
                <Button onClick={handleDownloadQR} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download PNG
                </Button>
                <p className="text-xs text-gray-500">
                  Links to: /p/{code.code}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48">
                <div className="text-center text-gray-500">
                  <QrCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Generating QR code...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Code Details */}
        <Card>
          <CardHeader>
            <CardTitle>Code Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <QrCode className="w-4 h-4" />
                  Code
                </div>
                <p className="font-mono font-bold text-lg">{code.code}</p>
              </div>

              {code.business_category && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Building className="w-4 h-4" />
                    Business Category
                  </div>
                  <p className="capitalize">{code.business_category}</p>
                </div>
              )}

              {code.marketing_campaign && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Tag className="w-4 h-4" />
                    Marketing Campaign
                  </div>
                  <p>{code.marketing_campaign}</p>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Calendar className="w-4 h-4" />
                  Created
                </div>
                <p>{formatDate(code.created_at)}</p>
              </div>

              {code.expiration_date && (
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Calendar className="w-4 h-4" />
                    Expires
                  </div>
                  <p className={new Date(code.expiration_date) < new Date() ? 'text-red-600 font-medium' : ''}>
                    {formatDate(code.expiration_date)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Scan className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium">Total Scans</span>
                </div>
                <span className="text-xl font-bold text-blue-600">{code.scans_count}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium">Conversions</span>
                </div>
                <span className="text-xl font-bold text-green-600">{code.conversions_count}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium">Conversion Rate</span>
                </div>
                <span className="text-xl font-bold text-purple-600">
                  {code.scans_count > 0
                    ? ((code.conversions_count / code.scans_count) * 100).toFixed(1)
                    : '0.0'
                  }%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partner Information */}
      {code.partner_name && (
        <Card>
          <CardHeader>
            <CardTitle>Associated Partner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-lg">{code.partner_name}</p>
                <p className="text-sm text-gray-600">
                  Signed up: {formatDate(code.created_at)}
                </p>
              </div>
              <Badge className="bg-green-100 text-green-800">
                Active Partner
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">How it works:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                <li>Print and distribute the QR code to potential partners</li>
                <li>Partners scan the QR code with their phone</li>
                <li>They are redirected to a pre-registration page</li>
                <li>After completing registration, they are linked to this code</li>
                <li>Track conversions and partner performance</li>
              </ol>
            </div>

            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>QR Code URL:</strong> {window.location.origin}/p/{code.code}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}