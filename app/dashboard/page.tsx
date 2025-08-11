"use client"

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Images, Users, Plus, ArrowRight, TrendingUp, Clock, CheckCircle } from "lucide-react"
import Link from "next/link"
import DashboardLayout from "@/components/dashboard-layout"
import { SupabaseService } from '@/lib/supabase'
import type { Partner, PartnerStats, Referral } from '@/lib/types'

export default function DashboardPage() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [recentReferrals, setRecentReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);

  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [partnerData, statsData, referralsData] = await Promise.all([
        supabaseService.getCurrentPartner(),
        supabaseService.getPartnerStats(),
        supabaseService.getReferrals({ limit: 5 })
      ]);

      setPartner(partnerData);
      setStats(statsData);
      setRecentReferrals(referralsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWelcomeName = () => {
    if (!partner) return 'Welcome back!';
    return partner.business_name 
      ? `Welcome back, ${partner.business_name}!`
      : `Welcome back, ${partner.first_name}!`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getActivityIcon = (status: string) => {
    switch (status) {
      case 'purchased':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'viewed':
      case 'clicked':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Users className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (referral: Referral) => {
    switch (referral.status) {
      case 'applied':
        return `Purchased for ${formatCurrency(referral.order_value || 0)}`;
      case 'accepted':
        return 'Account created';
      case 'accessed':
        return 'Viewed referral page';
      case 'invited':
        return 'QR Code Generated';
      case 'expired':
        return 'Expired';
      default:
        return 'Unknown status';
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{getWelcomeName()}</h1>
            <p className="text-gray-600 mt-2">Here's what's happening with your referrals today.</p>
          </div>
          {stats && (
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(stats.total_commission_earned)}
              </div>
              <div className="text-sm text-gray-600">Total Earned</div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.total_referrals}</p>
                    <p className="text-sm text-gray-600">Total Referrals</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.successful_referrals}</p>
                    <p className="text-sm text-gray-600">Successful</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.conversion_rate}%</p>
                    <p className="text-sm text-gray-600">Conversion Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.pending_referrals}</p>
                    <p className="text-sm text-gray-600">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mr-4">
                  <Images className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <CardTitle>Browse Catalog</CardTitle>
                  <CardDescription>Explore AI pet portraits to share with clients</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/catalog">
                <Button className="w-full bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700">
                  View Catalog
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mr-4">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle>Create Referral</CardTitle>
                  <CardDescription>Generate QR code for new client referral</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/referrals/create">
                <Button className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New Referral
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest referrals and commissions</CardDescription>
          </CardHeader>
          <CardContent>
            {recentReferrals.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No referrals yet!</p>
                <Link href="/dashboard/referrals/create">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Referral
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentReferrals.map((referral) => (
                  <div key={referral.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getActivityIcon(referral.status)}
                      <div>
                        <p className="font-medium text-gray-900">{referral.client_name}</p>
                        <p className="text-sm text-gray-600">{getStatusText(referral)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {referral.commission_amount 
                          ? formatCurrency(referral.commission_amount)
                          : referral.status === 'applied' 
                            ? formatCurrency((referral.order_value || 0) * 0.20)
                            : 'Pending'
                        }
                      </p>
                      <p className="text-sm text-gray-600">{getTimeAgo(referral.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-6">
              <Link href="/dashboard/referrals">
                <Button variant="outline" className="w-full bg-transparent">
                  View All Referrals
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
