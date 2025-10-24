'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  ShoppingBag,
  Image,
  DollarSign,
  TrendingUp,
  Eye,
  Heart,
  Share2,
  Target,
  Package,
  Palette,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Clock,
  Star
} from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';

interface DashboardStats {
  totalCustomers: number;
  totalPartners: number;
  totalOrders: number;
  totalRevenue: number;
  totalImages: number;
  totalBreeds: number;
  totalThemes: number;
  totalProducts: number;
  totalReviews: number;
  pendingReviews: number;
  averageRating: number;
  recentActivity: any[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    totalPartners: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalImages: 0,
    totalBreeds: 0,
    totalThemes: 0,
    totalProducts: 0,
    totalReviews: 0,
    pendingReviews: 0,
    averageRating: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Load basic stats - these are placeholder calls
      // You'll need to implement these methods in SupabaseService or use direct queries
      const [
        customers,
        partners,
        breeds,
        themes,
        images,
        reviews,
        pendingReviews
      ] = await Promise.all([
        supabaseService.getClient().from('customers').select('id', { count: 'exact', head: true }),
        supabaseService.getClient().from('partners').select('id', { count: 'exact', head: true }),
        supabaseService.getClient().from('breeds').select('id', { count: 'exact', head: true }),
        supabaseService.getClient().from('themes').select('id', { count: 'exact', head: true }),
        supabaseService.getClient().from('image_catalog').select('id', { count: 'exact', head: true }),
        supabaseService.getClient().from('reviews').select('rating', { count: 'exact' }),
        supabaseService.getClient().from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      // Calculate average rating
      const avgRating = reviews.data && reviews.data.length > 0
        ? reviews.data.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.data.length
        : 0;

      setStats({
        totalCustomers: customers.count || 0,
        totalPartners: partners.count || 0,
        totalOrders: 0, // Implement when orders table is available
        totalRevenue: 0, // Implement when revenue data is available
        totalImages: images.count || 0,
        totalBreeds: breeds.count || 0,
        totalThemes: themes.count || 0,
        totalProducts: 0, // Implement when products data is available
        totalReviews: reviews.count || 0,
        pendingReviews: pendingReviews.count || 0,
        averageRating: Math.round(avgRating * 10) / 10,
        recentActivity: []
      });

    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickStats = [
    {
      title: 'Total Customers',
      value: stats.totalCustomers,
      icon: Users,
      color: 'bg-blue-500',
      href: '/admin/customers'
    },
    {
      title: 'Business Partners',
      value: stats.totalPartners,
      icon: Target,
      color: 'bg-green-500',
      href: '/admin/partners'
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: 'bg-purple-500',
      href: '/admin/orders'
    },
    {
      title: 'Revenue',
      value: `£${(stats.totalRevenue / 100).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-yellow-500',
      href: '/admin/financial/revenue'
    },
    {
      title: 'AI Images',
      value: stats.totalImages,
      icon: Image,
      color: 'bg-pink-500',
      href: '/admin/catalog'
    },
    {
      title: 'Dog/Cat Breeds',
      value: stats.totalBreeds,
      icon: Tag,
      color: 'bg-indigo-500',
      href: '/admin/breeds'
    },
    {
      title: 'Art Themes',
      value: stats.totalThemes,
      icon: Palette,
      color: 'bg-orange-500',
      href: '/admin/themes'
    },
    {
      title: 'Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'bg-teal-500',
      href: '/admin/products'
    },
    {
      title: 'Customer Reviews',
      value: stats.totalReviews,
      icon: Star,
      color: 'bg-amber-500',
      href: '/admin/reviews'
    }
  ];

  const quickActions = [
    {
      title: 'Generate New Images',
      description: 'Create AI-generated pet portraits',
      icon: Image,
      href: '/admin/generate',
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Add New Breed',
      description: 'Expand the breed catalog',
      icon: Tag,
      href: '/admin/breeds/new',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Create Theme',
      description: 'Add new artistic themes',
      icon: Palette,
      href: '/admin/themes/new',
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'View Analytics',
      description: 'Check platform performance',
      icon: TrendingUp,
      href: '/admin/image-analytics',
      color: 'from-orange-500 to-red-500'
    },
    {
      title: 'Batch Jobs',
      description: 'Monitor background processing',
      icon: Clock,
      href: '/admin/batch-jobs',
      color: 'from-indigo-500 to-purple-500'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600 mt-2">
          Welcome to the Pawtraits admin panel. Monitor your platform's performance and manage content.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      {stat.title === 'Customer Reviews' && stats.totalReviews > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-amber-600 font-medium">
                            ⭐ {stats.averageRating.toFixed(1)} average
                          </p>
                          {stats.pendingReviews > 0 && (
                            <p className="text-xs text-red-600 font-medium">
                              {stats.pendingReviews} pending approval
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={`p-3 rounded-full ${stat.color} text-white`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.title} href={action.href}>
                  <div className={`p-6 rounded-lg bg-gradient-to-br ${action.color} text-white hover:shadow-lg transition-shadow cursor-pointer group`}>
                    <div className="flex items-center justify-between mb-4">
                      <Icon className="w-8 h-8" />
                      <ArrowUpRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{action.title}</h3>
                    <p className="text-white/80 text-sm">{action.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Heart className="w-5 h-5 text-red-500" />
              <span>Popular Content</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Eye className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Most viewed images</span>
                </div>
                <Link href="/admin/image-analytics">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Share2 className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Most shared content</span>
                </div>
                <Link href="/admin/shared-images">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="text-sm">Most liked images</span>
                </div>
                <Link href="/admin/liked-images">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span>System Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Content Database</span>
                <span className="text-sm font-medium text-green-600">Healthy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Image Generation</span>
                <span className="text-sm font-medium text-green-600">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">User Authentication</span>
                <span className="text-sm font-medium text-green-600">Operational</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Payment Processing</span>
                <span className="text-sm font-medium text-green-600">Online</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}