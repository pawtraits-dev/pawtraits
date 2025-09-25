'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Link from 'next/link';
import {
  Search,
  Filter,
  Eye,
  Check,
  X,
  Pause,
  Play,
  MoreHorizontal,
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  Heart,
  Instagram,
  Twitter,
  Facebook,
  Youtube,
  QrCode,
  Plus,
  Copy,
  CheckCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { QRCodeService } from '@/lib/qr-code';

interface AdminInfluencerOverview {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  username?: string;
  bio?: string;
  commission_rate: number;
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;

  // Stats
  total_referrals: number;
  successful_referrals: number;
  pending_referrals: number;
  total_commission_earned: number;
  conversion_rate: number;
  social_channels_count: number;
  active_codes_count: number;
  total_social_reach: number;
  primary_platform?: string;
  primary_social_channel?: {
    platform: string;
    username: string;
    follower_count: number;
    verified: boolean;
  };
  setup_code?: string;
}

const approvalStatusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-gray-100 text-gray-800'
};

const platformIcons: { [key: string]: any } = {
  instagram: Instagram,
  twitter: Twitter,
  facebook: Facebook,
  youtube: Youtube
};

export default function AdminInfluencersPage() {
  const [influencers, setInfluencers] = useState<AdminInfluencerOverview[]>([]);
  const [filteredInfluencers, setFilteredInfluencers] = useState<AdminInfluencerOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [showAddInfluencerModal, setShowAddInfluencerModal] = useState(false);
  const [addingInfluencer, setAddingInfluencer] = useState(false);

  // QR code state management
  const [copiedCodes, setCopiedCodes] = useState<Set<string>>(new Set());
  const [qrCodes, setQrCodes] = useState<Map<string, string>>(new Map());
  const [generatingQr, setGeneratingQr] = useState<Set<string>>(new Set());

  // Stats for overview cards
  const [overviewStats, setOverviewStats] = useState({
    total_influencers: 0,
    active_influencers: 0,
    pending_approval: 0,
    total_commission_paid: 0,
    total_social_reach: 0,
    avg_conversion_rate: 0
  });

  // Form state for adding new influencer
  const [newInfluencerData, setNewInfluencerData] = useState({
    first_name: '',
    last_name: '',
    bio: '',
    custom_referral_code: '',
    commission_rate: 10.0,
    approval_status: 'approved' as 'pending' | 'approved' | 'rejected' | 'suspended',
    is_active: true,
    is_verified: false,
  });

  useEffect(() => {
    loadInfluencers();
  }, []);

  useEffect(() => {
    filterInfluencers();
    calculateOverviewStats();
  }, [influencers, searchTerm, statusFilter, platformFilter]);

  const loadInfluencers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/influencers');

      if (response.ok) {
        const data = await response.json();
        setInfluencers(data);
      } else {
        console.log('⏳ ADMIN INFLUENCERS: API endpoint not yet fully implemented, using placeholder data');

        // Placeholder data for demo
        const mockData: AdminInfluencerOverview[] = [
          {
            id: '1',
            first_name: 'Emma',
            last_name: 'Johnson',
            email: 'emma@petinfluencer.com',
            username: 'emmapetlover',
            bio: 'Dog trainer and content creator sharing tips and adorable moments',
            commission_rate: 10.0,
            approval_status: 'approved',
            is_active: true,
            is_verified: true,
            created_at: '2024-01-15T10:00:00Z',
            total_referrals: 45,
            successful_referrals: 23,
            pending_referrals: 22,
            total_commission_earned: 287.50,
            conversion_rate: 0.511,
            social_channels_count: 3,
            active_codes_count: 2,
            total_social_reach: 85000,
            primary_platform: 'instagram',
            primary_social_channel: {
              platform: 'instagram',
              username: 'emmapetlover',
              follower_count: 65000,
              verified: true
            },
            setup_code: 'EMMJOH123456'
          },
          {
            id: '2',
            first_name: 'Marcus',
            last_name: 'Chen',
            email: 'marcus@catcreator.com',
            username: 'marcuscat',
            bio: 'Cat behavior specialist and photographer',
            commission_rate: 10.0,
            approval_status: 'approved',
            is_active: true,
            is_verified: false,
            created_at: '2024-02-20T14:30:00Z',
            total_referrals: 28,
            successful_referrals: 12,
            pending_referrals: 16,
            total_commission_earned: 156.00,
            conversion_rate: 0.429,
            social_channels_count: 2,
            active_codes_count: 1,
            total_social_reach: 42000,
            primary_platform: 'youtube',
            primary_social_channel: {
              platform: 'youtube',
              username: 'MarcusCatTips',
              follower_count: 28000,
              verified: false
            },
            setup_code: 'MARCHE789012'
          },
          {
            id: '3',
            first_name: 'Sarah',
            last_name: 'Williams',
            email: 'sarah@pawsandpics.com',
            username: 'sarahpaws',
            bio: 'Pet photographer capturing precious moments',
            commission_rate: 10.0,
            approval_status: 'pending',
            is_active: false,
            is_verified: false,
            created_at: '2024-09-15T09:15:00Z',
            total_referrals: 5,
            successful_referrals: 2,
            pending_referrals: 3,
            total_commission_earned: 23.50,
            conversion_rate: 0.400,
            social_channels_count: 1,
            active_codes_count: 0,
            total_social_reach: 12000,
            primary_platform: 'instagram',
            primary_social_channel: {
              platform: 'instagram',
              username: 'sarahpaws',
              follower_count: 12000,
              verified: false
            },
            setup_code: 'SARWIL345678'
          }
        ];

        setInfluencers(mockData);
      }
    } catch (error) {
      console.error('Error loading influencers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterInfluencers = () => {
    let filtered = influencers;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(influencer =>
        `${influencer.first_name} ${influencer.last_name}`.toLowerCase().includes(term) ||
        influencer.email.toLowerCase().includes(term) ||
        influencer.username?.toLowerCase().includes(term) ||
        influencer.bio?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(influencer => influencer.approval_status === statusFilter);
    }

    if (platformFilter !== 'all') {
      filtered = filtered.filter(influencer => influencer.primary_platform === platformFilter);
    }

    setFilteredInfluencers(filtered);
  };

  const calculateOverviewStats = () => {
    const stats = {
      total_influencers: influencers.length,
      active_influencers: influencers.filter(i => i.is_active && i.approval_status === 'approved').length,
      pending_approval: influencers.filter(i => i.approval_status === 'pending').length,
      total_commission_paid: influencers.reduce((sum, i) => sum + i.total_commission_earned, 0),
      total_social_reach: influencers.reduce((sum, i) => sum + i.total_social_reach, 0),
      avg_conversion_rate: influencers.length > 0
        ? influencers.reduce((sum, i) => sum + i.conversion_rate, 0) / influencers.length
        : 0
    };

    setOverviewStats(stats);
  };

  const updateInfluencerStatus = async (influencerId: string, status: 'approved' | 'rejected' | 'suspended') => {
    try {
      const response = await fetch(`/api/admin/influencers/${influencerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_status: status })
      });

      if (response.ok) {
        await loadInfluencers(); // Reload data
      } else {
        console.error('Failed to update influencer status');
      }
    } catch (error) {
      console.error('Error updating influencer status:', error);
    }
  };

  const toggleInfluencerActive = async (influencerId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/influencers/${influencerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });

      if (response.ok) {
        await loadInfluencers(); // Reload data
      } else {
        console.error('Failed to toggle influencer active status');
      }
    } catch (error) {
      console.error('Error toggling influencer active status:', error);
    }
  };

  const addNewInfluencer = async () => {
    try {
      setAddingInfluencer(true);
      const response = await fetch('/api/admin/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInfluencerData)
      });

      if (response.ok) {
        await loadInfluencers(); // Reload data
        setShowAddInfluencerModal(false);
        setNewInfluencerData({
          first_name: '',
          last_name: '',
          bio: '',
          custom_referral_code: '',
          commission_rate: 10.0,
          approval_status: 'approved',
          is_active: true,
          is_verified: false,
        });
        alert('Influencer created successfully');
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to create influencer'}`);
      }
    } catch (error) {
      console.error('Error creating influencer:', error);
      alert('Error creating influencer');
    } finally {
      setAddingInfluencer(false);
    }
  };

  const getPlatformIcon = (platform?: string) => {
    if (!platform) return Heart;
    const Icon = platformIcons[platform.toLowerCase()];
    return Icon || Heart;
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

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Influencer Management ✨</h1>
          <p className="text-gray-600 mt-2">
            Manage influencer partnerships, track performance, and approve new applications
          </p>
        </div>
        <Button
          className="bg-yellow-600 hover:bg-yellow-700"
          onClick={() => setShowAddInfluencerModal(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Influencer
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Influencers</p>
                <p className="text-2xl font-bold text-gray-900">{overviewStats.total_influencers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Check className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-gray-900">{overviewStats.active_influencers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{overviewStats.pending_approval}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Commission Paid</p>
                <p className="text-2xl font-bold text-gray-900">${overviewStats.total_commission_paid.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Heart className="w-8 h-8 text-pink-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Reach</p>
                <p className="text-2xl font-bold text-gray-900">{overviewStats.total_social_reach.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Avg Conversion</p>
                <p className="text-2xl font-bold text-gray-900">{(overviewStats.avg_conversion_rate * 100).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search influencers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>

            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Platforms</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="tiktok">TikTok</option>
              <option value="twitter">Twitter</option>
            </select>

            <Button variant="outline" onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setPlatformFilter('all');
            }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Influencers List */}
      <Card>
        <CardHeader>
          <CardTitle>Influencers ({filteredInfluencers.length})</CardTitle>
          <CardDescription>
            Manage and monitor your influencer partnerships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredInfluencers.map((influencer) => {
              const PlatformIcon = getPlatformIcon(influencer.primary_platform);

              return (
                <div key={influencer.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                        <span className="text-lg font-semibold text-yellow-600">
                          {influencer.first_name[0]}{influencer.last_name[0]}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-900">
                            {influencer.first_name} {influencer.last_name}
                          </h3>
                          {influencer.is_verified && (
                            <Badge className="bg-blue-100 text-blue-800">Verified</Badge>
                          )}
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>{influencer.email}</span>
                          {influencer.username && (
                            <span>@{influencer.username}</span>
                          )}
                          {influencer.primary_social_channel && (
                            <div className="flex items-center space-x-1">
                              <PlatformIcon className="w-4 h-4" />
                              <span>{influencer.primary_social_channel.follower_count.toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {influencer.bio && (
                          <p className="text-sm text-gray-500 mt-1 max-w-md truncate">
                            {influencer.bio}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {/* QR Code Section */}
                      {influencer.setup_code && (
                        <div className="flex items-center gap-2">
                          {qrCodes.has(influencer.setup_code) ? (
                            <>
                              <img
                                src={qrCodes.get(influencer.setup_code)!}
                                alt={`Setup QR Code for ${influencer.first_name} ${influencer.last_name}`}
                                className="w-12 h-12 border rounded"
                                style={{ imageRendering: 'pixelated' }}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCopyQRCode(influencer.setup_code!, qrCodes.get(influencer.setup_code!)!)}
                                className="h-8 px-2 text-xs"
                                title="Copy setup QR code"
                              >
                                {copiedCodes.has(influencer.setup_code) ? (
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
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-12 border rounded bg-gray-100 flex items-center justify-center">
                                {generatingQr.has(influencer.setup_code) ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => generateQRCode(influencer.setup_code!)}
                                    className="h-full w-full p-0 hover:bg-purple-50"
                                    title="Generate setup QR code"
                                  >
                                    <QrCode className="w-4 h-4 text-gray-400" />
                                  </Button>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                <span className="font-mono">{influencer.setup_code}</span>
                                <br />
                                <span className="text-gray-400">Setup Code</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Status Badge */}
                      <Badge className={approvalStatusColors[influencer.approval_status]}>
                        {influencer.approval_status}
                      </Badge>

                      {/* Stats */}
                      <div className="text-right text-sm">
                        <div className="text-gray-900 font-medium">
                          {influencer.successful_referrals}/{influencer.total_referrals} conversions
                        </div>
                        <div className="text-gray-500">
                          ${influencer.total_commission_earned.toFixed(2)} earned
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/admin/influencers/${influencer.id}`}>
                            <Eye className="w-4 h-4" />
                          </Link>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {influencer.approval_status === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => updateInfluencerStatus(influencer.id, 'approved')}>
                                  <Check className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateInfluencerStatus(influencer.id, 'rejected')}>
                                  <X className="w-4 h-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}

                            {influencer.approval_status === 'approved' && (
                              <DropdownMenuItem onClick={() => toggleInfluencerActive(influencer.id, influencer.is_active)}>
                                {influencer.is_active ? (
                                  <>
                                    <Pause className="w-4 h-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem onClick={() => updateInfluencerStatus(influencer.id, 'suspended')}>
                              <Pause className="w-4 h-4 mr-2" />
                              Suspend
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Influencer Modal */}
      <Dialog open={showAddInfluencerModal} onOpenChange={setShowAddInfluencerModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Influencer</DialogTitle>
            <DialogDescription>
              Create a new influencer profile with a custom referral code for easy sharing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={newInfluencerData.first_name}
                  onChange={(e) => setNewInfluencerData({ ...newInfluencerData, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={newInfluencerData.last_name}
                  onChange={(e) => setNewInfluencerData({ ...newInfluencerData, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="custom_referral_code">Referral Code *</Label>
              <Input
                id="custom_referral_code"
                value={newInfluencerData.custom_referral_code}
                onChange={(e) => setNewInfluencerData({ ...newInfluencerData, custom_referral_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                placeholder="SARAH2024"
                className={`uppercase ${
                  newInfluencerData.custom_referral_code && (newInfluencerData.custom_referral_code.length < 4 || !/^[A-Z0-9]+$/.test(newInfluencerData.custom_referral_code))
                    ? 'border-red-500'
                    : newInfluencerData.custom_referral_code.length >= 4 && /^[A-Z0-9]+$/.test(newInfluencerData.custom_referral_code)
                    ? 'border-green-500'
                    : ''
                }`}
                maxLength={20}
              />
              <p className={`text-xs mt-1 ${
                newInfluencerData.custom_referral_code && (newInfluencerData.custom_referral_code.length < 4 || !/^[A-Z0-9]+$/.test(newInfluencerData.custom_referral_code))
                  ? 'text-red-500'
                  : newInfluencerData.custom_referral_code.length >= 4 && /^[A-Z0-9]+$/.test(newInfluencerData.custom_referral_code)
                  ? 'text-green-500'
                  : 'text-gray-500'
              }`}>
                {newInfluencerData.custom_referral_code && newInfluencerData.custom_referral_code.length < 4
                  ? `Need ${4 - newInfluencerData.custom_referral_code.length} more characters`
                  : newInfluencerData.custom_referral_code && !/^[A-Z0-9]+$/.test(newInfluencerData.custom_referral_code)
                  ? 'Only letters and numbers allowed'
                  : newInfluencerData.custom_referral_code.length >= 4 && /^[A-Z0-9]+$/.test(newInfluencerData.custom_referral_code)
                  ? 'Valid referral code ✓'
                  : 'Minimum 4 characters. Letters and numbers only. Will be used as their referral code for followers.'
                }
              </p>
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={newInfluencerData.bio}
                onChange={(e) => setNewInfluencerData({ ...newInfluencerData, bio: e.target.value })}
                placeholder="Tell us about this influencer..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="commission_rate">Commission Rate (%)</Label>
              <Input
                id="commission_rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={newInfluencerData.commission_rate}
                onChange={(e) => setNewInfluencerData({ ...newInfluencerData, commission_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={newInfluencerData.is_active}
                  onCheckedChange={(checked) => setNewInfluencerData({ ...newInfluencerData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_verified"
                  checked={newInfluencerData.is_verified}
                  onCheckedChange={(checked) => setNewInfluencerData({ ...newInfluencerData, is_verified: checked })}
                />
                <Label htmlFor="is_verified">Verified</Label>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddInfluencerModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={addNewInfluencer}
                disabled={addingInfluencer || !newInfluencerData.first_name || !newInfluencerData.last_name || !newInfluencerData.custom_referral_code || newInfluencerData.custom_referral_code.length < 4 || !/^[A-Z0-9]+$/.test(newInfluencerData.custom_referral_code)}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {addingInfluencer ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Influencer
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}