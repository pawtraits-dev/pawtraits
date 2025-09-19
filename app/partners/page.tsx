'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Target, 
  DollarSign, 
  Users, 
  TrendingUp,
  Package,
  ShoppingBag,
  Plus,
  Eye,
  Share2,
  Star,
  Clock,
  CheckCircle,
  ArrowRight,
  Handshake,
  QrCode,
  Heart,
  Building,
  Briefcase,
  Award,
  Crown,
  Mail,
  Sparkles,
  PiggyBank,
  Camera
} from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { useServerCart } from '@/lib/server-cart-context';

interface PartnerStats {
  totalReferrals: number;
  activeReferrals: number;
  totalCommissions: number;
  pendingCommissions: number;
  totalOrders: number;
  conversionRate: number;
  recentReferrals: any[];
  monthlyStats: any[];
}

// Marketing Landing Page Component for Non-Logged In Partners
function PartnerMarketingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-8 h-8 text-green-600" />
              <span className="text-2xl font-bold text-gray-900">Pawtraits Partners</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth/login?redirect=/partners">
                <Button variant="ghost">Partner Login</Button>
              </Link>
              <Link href="/signup/partner">
                <Button className="bg-green-600 hover:bg-green-700">Join Program</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <Badge className="bg-green-100 text-green-800 mb-4">
              💼 Professional Partnership Program
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Grow Your Business With
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-600"> Pawtraits</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Join our exclusive partner program for pet groomers, veterinarians, and pet service providers. 
              Earn commissions while offering your clients beautiful AI-generated pet portraits.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup/partner">
                <Button size="lg" className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8 py-4 text-lg">
                  <Briefcase className="w-5 h-5 mr-2" />
                  Become a Partner
                </Button>
              </Link>
              <Link href="/partners/shop">
                <Button size="lg" variant="outline" className="px-8 py-4 text-lg">
                  <Eye className="w-5 h-5 mr-2" />
                  View Products
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Partner Benefits</h2>
            <p className="text-xl text-gray-600">Everything you need to succeed in our program</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Earn Commissions</h3>
              <p className="text-gray-600">
                Earn up to 25% commission on every sale you refer. Higher volumes mean better rates!
              </p>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <QrCode className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Easy Referral System</h3>
              <p className="text-gray-600">
                Custom QR codes and referral links make it simple to track your clients and earnings.
              </p>
            </div>
            
            <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Marketing Support</h3>
              <p className="text-gray-600">
                Get marketing materials, product samples, and ongoing support to help you succeed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-green-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How Partnership Works</h2>
            <p className="text-xl text-gray-600">Simple steps to start earning with Pawtraits</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Apply</h3>
              <p className="text-gray-600">
                Submit your partner application with business details and credentials.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Get Approved</h3>
              <p className="text-gray-600">
                Once approved, receive your partner portal access and referral materials.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Refer Clients</h3>
              <p className="text-gray-600">
                Use your unique links and QR codes to refer clients to Pawtraits.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                4
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Earn Money</h3>
              <p className="text-gray-600">
                Track your referrals and receive monthly commission payments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Target Partners */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Perfect For</h2>
            <p className="text-xl text-gray-600">Professional pet service providers we work with</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Pet Groomers</h3>
              <p className="text-sm text-gray-600">Offer portraits after grooming sessions</p>
            </div>
            
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Veterinarians</h3>
              <p className="text-sm text-gray-600">Memorial portraits and wellness visits</p>
            </div>
            
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Pet Photographers</h3>
              <p className="text-sm text-gray-600">Add artistic flair to photo sessions</p>
            </div>
            
            <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl">
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Pet Stores</h3>
              <p className="text-sm text-gray-600">Additional revenue stream for customers</p>
            </div>
          </div>
        </div>
      </section>

      {/* Commission Structure */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Commission Structure</h2>
            <p className="text-xl text-gray-600">Transparent, tiered commission rates</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-gray-200">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PiggyBank className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter</h3>
                <div className="text-3xl font-bold text-green-600 mb-4">15%</div>
                <p className="text-gray-600 mb-6">For new partners and low volume referrals</p>
                <ul className="text-left space-y-2 text-gray-600">
                  <li>• 0-10 monthly sales</li>
                  <li>• Monthly payments</li>
                  <li>• Basic support</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-blue-500 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-500 text-white">Most Popular</Badge>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Professional</h3>
                <div className="text-3xl font-bold text-green-600 mb-4">20%</div>
                <p className="text-gray-600 mb-6">For established partners with steady referrals</p>
                <ul className="text-left space-y-2 text-gray-600">
                  <li>• 11-25 monthly sales</li>
                  <li>• Bi-weekly payments</li>
                  <li>• Priority support</li>
                  <li>• Marketing materials</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-purple-500">
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Elite</h3>
                <div className="text-3xl font-bold text-green-600 mb-4">25%</div>
                <p className="text-gray-600 mb-6">For high-volume partners and premium businesses</p>
                <ul className="text-left space-y-2 text-gray-600">
                  <li>• 25+ monthly sales</li>
                  <li>• Weekly payments</li>
                  <li>• Dedicated account manager</li>
                  <li>• Custom marketing support</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">What Partners Say</h2>
          <p className="text-xl text-gray-600 mb-12">Hear from successful Pawtraits partners</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 bg-gray-50 rounded-2xl">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">
                "Pawtraits has been an amazing addition to our grooming business. Our clients love 
                the portraits and we've earned over £2,000 in commissions this year!"
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <Heart className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Emma Thompson</p>
                  <p className="text-sm text-gray-600">Paws & Claws Grooming</p>
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-gray-50 rounded-2xl">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-700 mb-4">
                "The memorial portraits we offer through Pawtraits have helped so many families 
                celebrate their pets. It's a meaningful service with great returns."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <Building className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Dr. James Wilson</p>
                  <p className="text-sm text-gray-600">Wilson Veterinary Clinic</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-green-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Start Earning?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of successful partners earning commissions with Pawtraits
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup/partner">
              <Button size="lg" className="bg-white text-green-600 hover:bg-gray-100 px-12 py-4 text-lg font-semibold">
                <Briefcase className="w-5 h-5 mr-2" />
                Apply Now
              </Button>
            </Link>
            <Link href="mailto:partners@pawtraits.com">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-12 py-4 text-lg">
                <Mail className="w-5 h-5 mr-2" />
                Contact Partners Team
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Sparkles className="w-8 h-8 text-green-400" />
            <span className="text-2xl font-bold">Pawtraits Partners</span>
          </div>
          <p className="text-gray-400">
            Professional partnership program for pet service providers
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function PartnerDashboard() {
  const [stats, setStats] = useState<PartnerStats>({
    totalReferrals: 0,
    activeReferrals: 0,
    totalCommissions: 0,
    pendingCommissions: 0,
    totalOrders: 0,
    conversionRate: 0,
    recentReferrals: [],
    monthlyStats: []
  });
  const [partner, setPartner] = useState<any>(null);
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
      
      if (!userProfile || userProfile.user_type !== 'partner') {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      setUser(user);
      setIsAuthenticated(true);
      await loadPartnerStats();
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  const loadPartnerStats = async () => {
    try {
      setLoading(true);
      
      // Load partner data and stats
      const partnerData = await supabaseService.getCurrentPartner();
      setPartner(partnerData);

      if (partnerData) {
        const sessionToken = (await supabaseService.getClient().auth.getSession()).data.session?.access_token;
        
        // Load referrals and commission data concurrently
        const [referrals, commissionData] = await Promise.all([
          fetch('/api/referrals', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          }).then(res => res.ok ? res.json() : []).catch(() => []),
          
          fetch('/api/partner/commissions', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          }).then(res => res.ok ? res.json() : null).catch(() => null)
        ]);

        const activeReferrals = referrals.filter((r: any) => r.status === 'pending' || r.status === 'sent');
        
        // Get commission totals from commission API (already converted from pennies)
        const totalCommissions = commissionData ? parseFloat(commissionData.summary.totalCommissions) * 100 : 0; // Convert back to pennies for display consistency
        const pendingCommissions = commissionData ? parseFloat(commissionData.summary.unpaidTotal) * 100 : 0; // Convert back to pennies for display consistency

        setStats({
          totalReferrals: referrals.length,
          activeReferrals: activeReferrals.length,
          totalCommissions: totalCommissions,
          pendingCommissions: pendingCommissions,
          totalOrders: referrals.reduce((sum: number, r: any) => sum + (r.order_count || 0), 0),
          conversionRate: referrals.length > 0 ? (referrals.filter((r: any) => r.status === 'converted').length / referrals.length * 100) : 0,
          recentReferrals: referrals.slice(0, 5),
          monthlyStats: []
        });
      }

    } catch (error) {
      console.error('Error loading partner stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickStats = [
    {
      title: 'Total Referrals',
      value: stats.totalReferrals,
      icon: Target,
      color: 'bg-blue-500',
      href: '/referrals'
    },
    {
      title: 'Active Referrals',
      value: stats.activeReferrals,
      icon: Clock,
      color: 'bg-orange-500',
      href: '/referrals'
    },
    {
      title: 'Total Commissions',
      value: `£${(stats.totalCommissions / 100).toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-green-500',
      href: '/commissions'
    },
    {
      title: 'Pending Commissions',
      value: `£${(stats.pendingCommissions / 100).toFixed(2)}`,
      icon: Clock,
      color: 'bg-orange-500',
      href: '/commissions'
    }
  ];

  const quickActions = [
    {
      title: 'Browse Shop',
      description: 'Find portraits to recommend to clients',
      icon: ShoppingBag,
      href: '/partners/shop',
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Create Referral',
      description: 'Add a new client referral',
      icon: Plus,
      href: '/referrals/create',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'View Commissions',
      description: 'Track your earnings and payments',
      icon: DollarSign,
      href: '/commissions',
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Check Cart',
      description: `${cart.totalItems} items for clients`,
      icon: ShoppingBag,
      href: '/partners/cart',
      color: 'from-orange-500 to-red-500',
      badge: cart.totalItems > 0 ? cart.totalItems : undefined
    }
  ];

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Show marketing page if not authenticated or not a partner
  if (isAuthenticated === false) {
    return <PartnerMarketingPage />;
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
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {partner?.business_name || `${partner?.first_name} ${partner?.last_name}`}!
        </h1>
        <p className="text-gray-600 mt-2">
          {partner?.approval_status === 'approved' 
            ? "Your partner account is active. Start earning commissions by referring clients!"
            : "Your partner application is being reviewed. You'll be notified once approved."
          }
        </p>
      </div>

      {/* Account Status */}
      {partner?.approval_status !== 'approved' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Clock className="w-6 h-6 text-orange-500" />
              <div>
                <h3 className="font-semibold text-orange-900">Account Under Review</h3>
                <p className="text-orange-700 text-sm">
                  We're reviewing your partner application. This typically takes 1-2 business days.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            <Handshake className="w-5 h-5" />
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

      {/* Partner Benefits & How It Works */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <span>How Partner Referrals Work</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Create Referral</h4>
                  <p className="text-sm text-gray-600">Add client details or share images directly with QR codes</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Client Orders</h4>
                  <p className="text-sm text-gray-600">Your client receives 10% discount on their first order</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Earn Commission</h4>
                  <p className="text-sm text-gray-600">You receive 10% commission on all referred sales</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentReferrals.length > 0 ? (
                stats.recentReferrals.map((referral: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        referral.status === 'converted' ? 'bg-green-500' : 
                        referral.status === 'pending' ? 'bg-orange-500' : 'bg-gray-400'
                      }`} />
                      <div>
                        <span className="text-sm font-medium">
                          {referral.client_first_name} {referral.client_last_name}
                        </span>
                        <p className="text-xs text-gray-500">
                          {referral.status} • {new Date(referral.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {referral.total_commission_amount > 0 && (
                      <Badge variant="outline" className="text-green-600">
                        £{(referral.total_commission_amount / 100).toFixed(2)}
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <QrCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No referrals yet</p>
                  <Link href="/referrals/create">
                    <Button className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Referral
                    </Button>
                  </Link>
                </div>
              )}
            </div>
            
            {stats.recentReferrals.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Link href="/referrals">
                  <Button variant="outline" className="w-full">
                    View All Referrals
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commission Summary */}
      {stats.totalCommissions > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <span>Commission Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <DollarSign className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-700">
                  £{(stats.totalCommissions / 100).toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">Total Earned</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <Clock className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-orange-700">
                  £{(stats.pendingCommissions / 100).toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <CheckCircle className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-700">
                  £{((stats.totalCommissions - stats.pendingCommissions) / 100).toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">Paid Out</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}