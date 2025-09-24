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

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
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
      console.error('Failed to copy code:', error);
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
                    <th className="text-left py-3 px-4 font-medium">Code</th>
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
                        <div className="flex items-center gap-2">
                          <div className="font-mono font-bold text-lg bg-gray-100 px-3 py-1 rounded border">
                            {code.code}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyCode(code.code)}
                            className="h-8 w-8 p-0"
                            title="Copy code"
                          >
                            {copiedCodes.has(code.code) ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
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
                        <span className="font-medium">{code.scans_count}</span>
                        {code.conversions_count > 0 && (
                          <span className="text-xs text-green-600 ml-1">
                            ({code.conversions_count} converted)
                          </span>
                        )}
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