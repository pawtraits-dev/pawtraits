'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import CartIcon from '@/components/cart-icon';
import { 
  Users, 
  ShoppingBag, 
  BarChart3, 
  Target,
  Package,
  LogOut,
  Menu,
  X,
  Home,
  Plus,
  User,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Handshake,
  Search
} from 'lucide-react';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';
import { CountryProvider } from '@/lib/country-context';
import CountrySelector from '@/components/CountrySelector';

interface PartnerLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { name: 'Dashboard', href: '/partners', icon: Home },
  { name: 'Partner Shop', href: '/partners/shop', icon: ShoppingBag },
  { name: 'Referrals', href: '/partners/referrals', icon: Target },
  { name: 'Analytics', href: '/partners/analytics', icon: BarChart3 },
  { name: 'Orders', href: '/partners/orders', icon: Package },
  { name: 'Cart', href: '/partners/cart', icon: ShoppingCart },
  { name: 'Account', href: '/partners/account', icon: User },
];

export default function PartnerLayout({ children }: PartnerLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const supabaseService = new SupabaseService();

  useEffect(() => {
    checkPartnerAccess();
  }, []);

  const checkPartnerAccess = async () => {
    try {
      const { data: { user } } = await supabaseService.getClient().auth.getUser();
      
      if (!user) {
        // Allow marketing pages to show on root /partners route
        if (pathname === '/partners') {
          setLoading(false);
          return;
        }
        router.push('/auth/login');
        return;
      }

      const userProfile = await supabaseService.getCurrentUserProfile();
      
      if (!userProfile || userProfile.user_type !== 'partner') {
        // Allow marketing pages to show on root /partners route for non-partners
        if (pathname === '/partners') {
          setLoading(false);
          return;
        }
        router.push('/auth/login');
        return;
      }

      const partnerData = await supabaseService.getCurrentPartner();
      
      setUser(user);
      setUserProfile(userProfile);
      setPartner(partnerData);
    } catch (error) {
      console.error('Error checking partner access:', error);
      // Allow marketing pages to show on root /partners route even on error
      if (pathname === '/partners') {
        setLoading(false);
        return;
      }
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabaseService.getClient().auth.signOut();
    router.push('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/partners/shop?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // For marketing pages (non-authenticated users on /partners route), render children without layout
  if (!user && pathname === '/partners') {
    return (
      <CountryProvider>
        <div className="w-full">{children}</div>
      </CountryProvider>
    );
  }

  // For other routes, don't render anything if no user
  if (!user) {
    return null;
  }

  return (
    <CountryProvider userPhone={userProfile?.phone || partner?.phone}>
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
        {/* Sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Only shows when sidebarOpen is true */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
          <div className="flex items-center space-x-2">
            <Image 
              src="/assets/logos/paw-svgrepo-200x200-green.svg" 
              alt="PawTraits Partners"
              width={32}
              height={32}
              className="w-8 h-8 filter brightness-0 invert"
            />
            <span className="text-xl font-bold">Partners</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="hover:bg-white/20 rounded p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Partner Profile Section */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {partner?.business_name || `${partner?.first_name} ${partner?.last_name}`}
              </p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="mt-2">
            <Badge 
              variant={partner?.status === 'approved' ? 'default' : 'secondary'}
              className={partner?.status === 'approved' ? 'bg-green-100 text-green-800' : ''}
            >
              {partner?.status || 'Pending'}
            </Badge>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-3 py-3 text-sm rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-green-100 text-green-700 border-r-2 border-green-600'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full flex items-center justify-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>

        {/* Main Content */}
        <div className="w-full">
          {/* Top Header */}
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg p-2 transition-colors"
                >
                <Image 
                  src="/assets/logos/paw-svgrepo-200x200-green.svg" 
                  alt="PawTraits Partners"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
                <span className="text-xl font-semibold text-gray-900">PawTraits Partners</span>
              </button>
            </div>
            
            {/* Search Bar */}
            <div className="flex-1 max-w-2xl mx-4">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search pet portraits, breeds, themes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </form>
            </div>
            
            <div className="flex items-center space-x-4">
              <CountrySelector compact={true} showLabel={false} />
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Business Partner
              </Badge>
              <CartIcon />
            </div>
          </div>
          </header>

          {/* Page Content */}
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </CountryProvider>
  );
}