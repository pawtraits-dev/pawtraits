'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Download,
  Search,
  Filter,
  QrCode,
  Eye,
  Calendar,
  Building,
  TrendingUp,
  Users,
  Scan,
  Copy,
  CheckCircle
} from 'lucide-react';
import Link from 'next/link';
import { PreRegistrationCode, PreRegistrationCodeWithPartner } from '@/lib/types';
import { QRCodeService } from '@/lib/qr-code';

interface PreRegistrationStats {
  total_codes: number;
  active_codes: number;
  used_codes: number;
  expired_codes: number;
  total_scans: number;
  conversion_rate: number;
}

export default function PreRegistrationManagementPage() {
  const [codes, setCodes] = useState<PreRegistrationCodeWithPartner[]>([]);
  const [stats, setStats] = useState<PreRegistrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [copiedCodes, setCopiedCodes] = useState<Set<string>>(new Set());
  const [qrCodes, setQrCodes] = useState<Map<string, string>>(new Map());
  const [generatingQr, setGeneratingQr] = useState<Set<string>>(new Set());

  // Get unique campaigns for filter
  const campaigns = Array.from(new Set(codes.map(code => code.marketing_campaign).filter(Boolean)));

  useEffect(() => {
    loadPreRegistrationCodes();
    loadStats();
  }, [statusFilter, campaignFilter]);

  const loadPreRegistrationCodes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (campaignFilter !== 'all') params.append('campaign', campaignFilter);

      const response = await fetch(`/api/admin/pre-registration/codes?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCodes(data);
      } else {
        console.error('Failed to load pre-registration codes');
      }
    } catch (error) {
      console.error('Error loading pre-registration codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/pre-registration/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleBulkDownload = async () => {
    try {
      const filteredCodes = getFilteredCodes();
      const codeIds = filteredCodes.map(code => code.id);

      const response = await fetch('/api/admin/pre-registration/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_ids: codeIds })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pre-registration-qr-codes.zip';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading QR codes:', error);
    }
  };

  const getFilteredCodes = () => {
    return codes.filter(code => {
      const matchesSearch = !searchTerm ||
        code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.business_category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.marketing_campaign?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
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

  const generateQRCode = async (code: string) => {
    if (qrCodes.has(code) || generatingQr.has(code)) return;

    try {
      setGeneratingQr(prev => new Set(prev).add(code));
      const qrCodeService = new QRCodeService();

      const qrUrl = `${window.location.origin}/p/${code}`;

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
        width: 128,
        margin: 4,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#9333ea', // Pawtraits purple-600
          light: '#00000000' // Transparent background
        }
      });

      setQrCodes(prev => new Map(prev).set(code, qrCodeDataUrl));
    } catch (error) {
      console.error('Error generating QR code:', error);
    } finally {
      setGeneratingQr(prev => {
        const newSet = new Set(prev);
        newSet.delete(code);
        return newSet;
      });
    }
  };

  const handleCopyQRCode = async (code: string, qrDataUrl: string) => {
    try {
      // Convert data URL to blob
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();

      // Copy to clipboard using the Clipboard API
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);

      setCopiedCodes(prev => new Set(prev).add(code));
      // Clear the copied state after 2 seconds
      setTimeout(() => {
        setCopiedCodes(prev => {
          const newSet = new Set(prev);
          newSet.delete(code);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy QR code:', error);
      // Fallback: try to copy the text code instead
      try {
        await navigator.clipboard.writeText(code);
        setCopiedCodes(prev => new Set(prev).add(code));
        setTimeout(() => {
          setCopiedCodes(prev => {
            const newSet = new Set(prev);
            newSet.delete(code);
            return newSet;
          });
        }, 2000);
      } catch (textError) {
        console.error('Failed to copy text code as fallback:', textError);
      }
    }
  };

  const filteredCodes = getFilteredCodes();

  if (loading && codes.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pre-Registration Codes</h1>
          <p className="text-gray-600 mt-1">
            Manage QR codes for partner acquisition campaigns
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleBulkDownload} disabled={filteredCodes.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Download QR Codes ({filteredCodes.length})
          </Button>
          <Link href="/admin/partners/pre-registration/create">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Codes
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Codes</p>
                  <p className="text-2xl font-bold">{stats.total_codes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <div>
                  <p className="text-sm text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{stats.active_codes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Converted</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.used_codes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Scan className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Scans</p>
                  <p className="text-2xl font-bold">{stats.total_scans}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Conversion</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(stats.conversion_rate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="text-sm text-gray-600">Expired</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.expired_codes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search codes, categories, campaigns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="used">Used</option>
                <option value="expired">Expired</option>
                <option value="deactivated">Deactivated</option>
              </select>

              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Campaigns</option>
                {campaigns.map(campaign => (
                  <option key={campaign} value={campaign}>{campaign}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pre-Registration Codes ({filteredCodes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCodes.length === 0 ? (
            <div className="text-center py-8">
              <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No pre-registration codes found</p>
              <Link href="/admin/partners/pre-registration/create" className="inline-block mt-2">
                <Button size="sm">Create Your First Code</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">QR Code</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Category</th>
                    <th className="text-left py-3 px-4 font-medium">Campaign</th>
                    <th className="text-left py-3 px-4 font-medium">Scans</th>
                    <th className="text-left py-3 px-4 font-medium">Created</th>
                    <th className="text-left py-3 px-4 font-medium">Partner</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCodes.map((code) => (
                    <tr key={code.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {qrCodes.has(code.code) ? (
                            <>
                              <img
                                src={qrCodes.get(code.code)!}
                                alt={`QR Code for ${code.code}`}
                                className="w-16 h-16 border rounded"
                                style={{ imageRendering: 'pixelated' }}
                              />
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyQRCode(code.code, qrCodes.get(code.code)!)}
                                  className="h-8 px-2 text-xs"
                                  title="Copy QR code image"
                                >
                                  {copiedCodes.has(code.code) ? (
                                    <>
                                      <CheckCircle className="w-3 h-3 text-green-600 mr-1" />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 mr-1" />
                                      Copy QR
                                    </>
                                  )}
                                </Button>
                                <span className="text-xs text-gray-500 font-mono">{code.code}</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-16 border rounded bg-gray-100 flex items-center justify-center">
                                {generatingQr.has(code.code) ? (
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => generateQRCode(code.code)}
                                    className="h-full w-full p-0 hover:bg-purple-50"
                                    title="Generate QR code"
                                  >
                                    <QrCode className="w-6 h-6 text-gray-400" />
                                  </Button>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500 font-mono">{code.code}</span>
                                <span className="text-xs text-gray-400">Click to generate QR</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(code.status)}>
                          {code.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <span className="capitalize">{code.business_category || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {code.marketing_campaign || 'No campaign'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <div>
                            <span className="font-medium">{code.scans_count}</span>
                            {code.conversions_count > 0 && (
                              <span className="text-xs text-green-600 ml-1">
                                ({code.conversions_count} converted)
                              </span>
                            )}
                          </div>
                          {code.last_scanned_at && (
                            <span className="text-xs text-gray-500 mt-1">
                              Last: {new Date(code.last_scanned_at).toLocaleDateString()} {new Date(code.last_scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {new Date(code.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {code.partner ? (
                          <Link
                            href={`/admin/partners/${code.partner.id}`}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {code.partner.business_name || `${code.partner.first_name} ${code.partner.last_name}`}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">Not used</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Link href={`/admin/partners/pre-registration/${code.id}`}>
                            <Button size="sm" variant="ghost">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          {code.qr_code_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(code.qr_code_url, '_blank')}
                            >
                              <QrCode className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}