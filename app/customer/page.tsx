'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingBag, 
  Image, 
  Heart, 
  Package,
  Plus,
  Eye,
  ShoppingCart,
  Star,
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Camera,
  Palette,
  PaintBucket,
  Crown,
  Gift,
  Users,
  Mail
} from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { useServerCart } from '@/lib/server-cart-context';
import { getSupabaseClient } from '@/lib/supabase-client';

interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  favoriteImages: number;
  totalPets: number;
  recentOrders: any[];
  recommendedImages: any[];
}

// Marketing Landing Page Component for Non-Logged In Users
function CustomerMarketingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-8 h-8 text-purple-600" />
              <span className="text-2xl font-bold text-gray-900">Pawtraits</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth/login?redirect=/customer">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/signup/user">
                <Button className="bg-purple-600 hover:bg-purple-700">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <Badge className="bg-purple-100 text-purple-800 mb-4">
              ✨ Transform Your Pet Photos with AI
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Turn Your Pet Into
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600"> Art</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Create stunning, personalized portraits of your beloved pets using cutting-edge AI technology. 
              Transform memories into beautiful artwork perfect for your home or as gifts.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup/user">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 text-lg">
                  <Camera className="w-5 h-5 mr-2" />
                  Start Creating
                </Button>
              </Link>
              <Link href="/customer/shop" className="sm:inline-block">
                <Button size="lg" variant="outline" className="px-8 py-4 text-lg">
                  <Eye className="w-5 h-5 mr-2" />
                  View Gallery
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Choose Pawtraits?</h2>
            <p className="text-xl text-gray-600">Discover what makes our AI pet portraits special</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">AI-Powered Magic</h3>
              <p className="text-gray-600">
                Our advanced AI creates stunning, unique portraits that capture your pet's personality perfectly.
              </p>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Palette className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Multiple Styles</h3>
              <p className="text-gray-600">
                Choose from dozens of artistic styles - from classical paintings to modern digital art.
              </p>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Premium Quality</h3>
              <p className="text-gray-600">
                High-resolution artwork perfect for printing, framing, and sharing with friends and family.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600">Get your pet portrait in three simple steps</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Upload Photos</h3>
              <p className="text-gray-600">
                Sign up and upload high-quality photos of your pet. The more photos, the better the result!
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Choose Style</h3>
              <p className="text-gray-600">
                Browse our gallery and select your favorite artistic style and format for your portrait.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Get Your Art</h3>
              <p className="text-gray-600">
                Receive your beautiful AI-generated portrait ready to download, print, or share!
              </p>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Link href="/signup/user">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-4 text-lg">
                <Gift className="w-5 h-5 mr-2" />
                Create Your First Portrait
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Join Thousands of Happy Pet Parents</h2>
          <p className="text-xl text-gray-600 mb-12">See what our customers are saying about Pawtraits</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 rounded-2xl">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">
                "Absolutely amazing! The portrait of my golden retriever looks like a masterpiece. 
                Perfect for our living room!"
              </p>
              <p className="font-semibold text-gray-900">- Sarah M.</p>
            </div>
            
            <div className="p-6 bg-gray-50 rounded-2xl">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">
                "The AI captured my cat's personality perfectly. The quality is incredible and 
                the process was so easy!"
              </p>
              <p className="font-semibold text-gray-900">- Mike R.</p>
            </div>
            
            <div className="p-6 bg-gray-50 rounded-2xl">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">
                "Made the perfect memorial portrait of our beloved dog. The team was so thoughtful 
                and the result was beautiful."
              </p>
              <p className="font-semibold text-gray-900">- Jennifer L.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-purple-600 to-pink-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform Your Pet Into Art?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of pet parents who have created beautiful memories with Pawtraits
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup/user">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 px-12 py-4 text-lg font-semibold">
                <Users className="w-5 h-5 mr-2" />
                Sign Up Now
              </Button>
            </Link>
            <Link href="mailto:hello@pawtraits.com">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-12 py-4 text-lg">
                <Mail className="w-5 h-5 mr-2" />
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <span className="text-2xl font-bold">Pawtraits</span>
          </div>
          <p className="text-gray-400">
            Transform your pet photos into beautiful artwork with AI
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function CustomerDashboard() {
  const [stats, setStats] = useState<CustomerStats>({
    totalOrders: 0,
    totalSpent: 0,
    favoriteImages: 0,
    totalPets: 0,
    recentOrders: [],
    recommendedImages: []
  });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { cart } = useServerCart();

  const supabaseService = new SupabaseService();

  useEffect(() => {
    checkAuthAndLoadStats();
  }, []);

  const checkAuthAndLoadStats = async () => {
    try {
      const { data: { user } } = await supabaseService.getClient().auth.getUser();
      
      if (!user) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      const userProfile = await supabaseService.getCurrentUserProfile();
      
      if (!userProfile || userProfile.user_type !== 'customer') {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      setUser(user);
      setIsAuthenticated(true);
      await loadCustomerStats();
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  const loadCustomerStats = async () => {
    try {
      setLoading(true);
      
      // Load customer-specific stats
      const customer = await supabaseService.getCurrentCustomer();
      if (customer) {
        // Get pets count using service method
        const pets = await supabaseService.getCustomerPets();
        
        setStats({
          totalOrders: 0, // Implement when orders data is available
          totalSpent: 0,
          favoriteImages: 0, // Implement when favorites are available
          totalPets: pets?.length || 0,
          recentOrders: [],
          recommendedImages: []
        });
      }

    } catch (error) {
      console.error('Error loading customer stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickStats = [
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: Package,
      color: 'bg-blue-500',
      href: '/customer/orders'
    },
    {
      title: 'Amount Spent',
      value: `£${(stats.totalSpent / 100).toLocaleString()}`,
      icon: ShoppingCart,
      color: 'bg-green-500',
      href: '/customer/orders'
    },
    {
      title: 'Favorite Images',
      value: stats.favoriteImages,
      icon: Heart,
      color: 'bg-red-500',
      href: '/customer/gallery'
    },
    {
      title: 'My Pets',
      value: stats.totalPets,
      icon: Heart,
      color: 'bg-purple-500',
      href: '/customer/pets'
    }
  ];

  const quickActions = [
    {
      title: 'Browse Shop',
      description: 'Discover AI-generated pet portraits',
      icon: ShoppingBag,
      href: '/customer/shop',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Add My Pet',
      description: 'Upload photos of your beloved pet',
      icon: Plus,
      href: '/customer/pets/add',
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'View Gallery',
      description: 'See your purchased portraits',
      icon: Image,
      href: '/customer/gallery',
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Check Cart',
      description: `${cart.totalItems} items ready for checkout`,
      icon: ShoppingCart,
      href: '/customer/cart',
      color: 'from-orange-500 to-red-500',
      badge: cart.totalItems > 0 ? cart.totalItems : undefined
    }
  ];

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Show marketing page if not authenticated or not a customer
  if (isAuthenticated === false) {
    return <CustomerMarketingPage />;
  }

  // Show loading for authenticated users while stats load
  if (isAuthenticated === true && loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
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
        <h1 className="text-3xl font-bold text-gray-900">Welcome Back!</h1>
        <p className="text-gray-600 mt-2">
          Ready to create some beautiful memories of your pets? Let's get started!
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
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
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
            <Sparkles className="w-5 h-5" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.title} href={action.href}>
                  <div className={`p-6 rounded-lg bg-gradient-to-br ${action.color} text-white hover:shadow-lg transition-shadow cursor-pointer group relative`}>
                    {action.badge && (
                      <Badge className="absolute -top-2 -right-2 bg-red-500 text-white">
                        {action.badge}
                      </Badge>
                    )}
                    <div className="flex items-center justify-between mb-4">
                      <Icon className="w-8 h-8" />
                      <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
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

      {/* Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Getting Started */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <span>Getting Started</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Add Your Pet</h4>
                  <p className="text-sm text-gray-600">Upload photos and details of your beloved pet</p>
                  <Link href="/customer/pets/add">
                    <Button size="sm" className="mt-2">Add Pet</Button>
                  </Link>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Browse Portraits</h4>
                  <p className="text-sm text-gray-600">Explore our AI-generated pet portrait gallery</p>
                  <Link href="/customer/shop">
                    <Button size="sm" className="mt-2">Browse Shop</Button>
                  </Link>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Order & Enjoy</h4>
                  <p className="text-sm text-gray-600">Choose your favorite format and place your order</p>
                  <Link href="/customer/cart">
                    <Button size="sm" className="mt-2">View Cart</Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span>Your Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Eye className="w-4 h-4 text-gray-500" />
                  <div>
                    <span className="text-sm font-medium">Recent Browsing</span>
                    <p className="text-xs text-gray-500">View your browsing history</p>
                  </div>
                </div>
                <Link href="/customer/shop">
                  <Button variant="outline" size="sm">Browse</Button>
                </Link>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Heart className="w-4 h-4 text-red-500" />
                  <div>
                    <span className="text-sm font-medium">Favorite Images</span>
                    <p className="text-xs text-gray-500">Images you've liked</p>
                  </div>
                </div>
                <Link href="/customer/gallery">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Package className="w-4 h-4 text-blue-500" />
                  <div>
                    <span className="text-sm font-medium">Order History</span>
                    <p className="text-xs text-gray-500">Track your purchases</p>
                  </div>
                </div>
                <Link href="/customer/orders">
                  <Button variant="outline" size="sm">View Orders</Button>
                </Link>
              </div>

              {cart.totalItems > 0 && (
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center space-x-3">
                    <ShoppingCart className="w-4 h-4 text-orange-500" />
                    <div>
                      <span className="text-sm font-medium">Items in Cart</span>
                      <p className="text-xs text-orange-600">{cart.totalItems} items ready to checkout</p>
                    </div>
                  </div>
                  <Link href="/customer/checkout">
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                      Checkout
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Featured Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <span>Popular This Week</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Discover trending pet portraits and popular styles</p>
            <Link href="/customer/shop">
              <Button className="mt-4">
                <Palette className="w-4 h-4 mr-2" />
                Explore Gallery
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}