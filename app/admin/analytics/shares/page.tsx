'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Share2, 
  TrendingUp, 
  Users, 
  Eye, 
  ExternalLink,
  Calendar,
  Filter,
  Search,
  Download,
  Heart,
  MessageCircle,
  User,
  Globe,
  Loader2
} from 'lucide-react';
import Image from 'next/image';

interface ShareEvent {
  id: string;
  image_id: string;
  user_email: string;
  platform: string;
  share_url: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  image: {
    id: string;
    filename: string;
    public_url: string;
    prompt_text: string;
    description: string;
    share_count: number;
  };
}

interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  display_name: string;
  profile_url: string;
  follower_count: number;
  verified: boolean;
  total_shares: number;
  last_shared_at: string;
  first_shared_at: string;
}

interface ShareStats {
  totalShares: number;
  totalAccounts: number;
  totalReach: number;
  platformBreakdown: Record<string, number>;
  topImages: Array<{
    id: string;
    prompt_text: string;
    public_url: string;
    share_count: number;
  }>;
}

export default function ShareAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [shareEvents, setShareEvents] = useState<ShareEvent[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [stats, setStats] = useState<ShareStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // In a real implementation, these would be actual API calls
      // For now, we'll use mock data to show the structure
      
      const mockStats: ShareStats = {
        totalShares: 1247,
        totalAccounts: 89,
        totalReach: 156420,
        platformBreakdown: {
          facebook: 432,
          instagram: 298,
          twitter: 187,
          whatsapp: 215,
          copy: 115
        },
        topImages: [
          {
            id: '1',
            prompt_text: 'Golden Retriever in Renaissance Style',
            public_url: '/placeholder.jpg',
            share_count: 67
          },
          {
            id: '2',
            prompt_text: 'Fluffy Cat in Watercolor',
            public_url: '/placeholder.jpg',
            share_count: 52
          }
        ]
      };

      const mockShareEvents: ShareEvent[] = [
        {
          id: '1',
          image_id: '1',
          user_email: 'user@example.com',
          platform: 'instagram',
          share_url: 'https://pawtraits.com/share/image/1',
          user_agent: 'Mozilla/5.0...',
          ip_address: '192.168.1.1',
          created_at: new Date().toISOString(),
          image: {
            id: '1',
            filename: 'golden-retriever.jpg',
            public_url: '/placeholder.jpg',
            prompt_text: 'Golden Retriever in Renaissance Style',
            description: 'A beautiful Golden Retriever portrait',
            share_count: 67
          }
        }
      ];

      const mockSocialAccounts: SocialAccount[] = [
        {
          id: '1',
          platform: 'instagram',
          username: 'petlover_jane',
          display_name: 'Jane Smith',
          profile_url: 'https://instagram.com/petlover_jane',
          follower_count: 15420,
          verified: false,
          total_shares: 8,
          last_shared_at: new Date().toISOString(),
          first_shared_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          platform: 'facebook',
          username: 'doggroomer_mike',
          display_name: 'Mike Johnson',
          profile_url: 'https://facebook.com/doggroomer.mike',
          follower_count: 8920,
          verified: true,
          total_shares: 12,
          last_shared_at: new Date().toISOString(),
          first_shared_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      setStats(mockStats);
      setShareEvents(mockShareEvents);
      setSocialAccounts(mockSocialAccounts);
      
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">f</span>
        </div>;
      case 'instagram':
        return <div className="w-5 h-5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full"></div>;
      case 'twitter':
        return <div className="w-5 h-5 bg-blue-400 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">𝕏</span>
        </div>;
      case 'whatsapp':
        return <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
          <MessageCircle className="w-3 h-3 text-white" />
        </div>;
      default:
        return <Share2 className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-2 text-gray-600">Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Share Analytics</h1>
          <p className="text-gray-600 mt-2">
            Track how your Pawtraits are being shared and discover influential accounts
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Share Events</TabsTrigger>
          <TabsTrigger value="accounts">Social Accounts</TabsTrigger>
          <TabsTrigger value="images">Top Images</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Shares</CardTitle>
                <Share2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalShares.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  +12.5% from last month
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Social Accounts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalAccounts}</div>
                <p className="text-xs text-muted-foreground">
                  +8 new this month
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estimated Reach</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats?.totalReach || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  Based on follower counts
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">+23.1%</div>
                <p className="text-xs text-muted-foreground">
                  Month over month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Platform Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.platformBreakdown && Object.entries(stats.platformBreakdown).map(([platform, count]) => (
                  <div key={platform} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getPlatformIcon(platform)}
                      <span className="font-medium capitalize">{platform}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{count} shares</span>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${(count / (stats?.totalShares || 1)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Shared Images */}
          <Card>
            <CardHeader>
              <CardTitle>Most Shared Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats?.topImages.map((image) => (
                  <div key={image.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Image
                      src={image.public_url}
                      alt={image.prompt_text}
                      width={60}
                      height={60}
                      className="rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {image.prompt_text}
                      </p>
                      <p className="text-sm text-gray-600">
                        {image.share_count} shares
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Accounts Tab */}
        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Influential Accounts</CardTitle>
              <p className="text-sm text-gray-600">
                Social media accounts that have shared your content - great for partnerships!
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {socialAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      {getPlatformIcon(account.platform)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{account.display_name}</span>
                          {account.verified && (
                            <Badge variant="secondary" className="text-xs">
                              ✓ Verified
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">@{account.username}</p>
                        <p className="text-xs text-gray-500">
                          {formatNumber(account.follower_count)} followers
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{account.total_shares} shares</p>
                      <p className="text-xs text-gray-500">
                        Last: {new Date(account.last_shared_at).toLocaleDateString()}
                      </p>
                      <Button variant="outline" size="sm" className="mt-2">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View Profile
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other tabs would be implemented similarly */}
        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Share Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Share events tracking will be displayed here
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Image Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                Detailed image sharing analytics will be displayed here
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}