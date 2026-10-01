'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import CartIcon from '@/components/cart-icon';
import {
  User,
  ShoppingBag,
  Image as ImageIcon,
  Heart,
  Package,
  LogOut,
  Menu,
  X,
  Home,
  Plus,
  Eye,
  ShoppingCart,
  Sparkles,
  Search,
  Grid3X3,
  Share2,
  Bell,
  Download
} from 'lucide-react';
import Image from 'next/image';
import { getSupabaseClient } from '@/lib/supabase-client';
import { CountryProvider } from '@/lib/country-context';
import CountrySelector from '@/components/CountrySelector';
import { ServerCartProvider } from '@/lib/server-cart-context';
import CustomerTabBar, { CUSTOMER_NAV, isActivePath } from '@/components/customer/CustomerTabBar';

// Security imports
import { SecureWrapper } from '@/components/security/SecureWrapper';
import { AuditLogger } from '@/lib/audit-logger';

interface CustomerLayoutProps {
  children: React.ReactNode;
}

// Main customer menu: four places only (round 2 UX), shared with the phone tab bar
const navigationItems = CUSTOMER_NAV;

// Smaller links under the main four in the drawer
const secondaryItems = [
  { name: 'Browse designs', href: '/browse', icon: Sparkles },
  { name: 'Downloads', href: '/customer/downloads', icon: Download },
  { name: 'My pets', href: '/customer/pets', icon: Heart },
  { name: 'Inbox', href: '/customer/inbox', icon: Bell },
];

export default function CustomerLayout({ children }: CustomerLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const supabase = getSupabaseClient();

  useEffect(() => {
    checkCustomerAccess();
  }, []);

  // Fetch unread message count
  useEffect(() => {
    if (user?.email) {
      fetchUnreadCount();
      // Refresh count every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch(
        `/api/customers/messages?email=${encodeURIComponent(user.email)}&unread_only=true`
      );
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const checkCustomerAccess = async () => {
    try {
      // Check authentication via API endpoint instead of direct database access
      const authResponse = await fetch('/api/auth/check', {
        credentials: 'include'
      });

      if (!authResponse.ok) {
        // Allow marketing pages to show on root /customer route
        if (pathname === '/customer') {
          setLoading(false);
          return;
        }
        router.push('/auth/login');
        return;
      }

      const { isAuthenticated, user: userData, profile: userProfile } = await authResponse.json();

      if (!isAuthenticated || !userData) {
        // Allow marketing pages to show on root /customer route
        if (pathname === '/customer') {
          setLoading(false);
          return;
        }
        router.push('/auth/login');
        return;
      }

      if (!userProfile || userProfile.user_type !== 'customer') {
        // Allow marketing pages to show on root /customer route for non-customers
        if (pathname === '/customer') {
          setLoading(false);
          return;
        }
        router.push('/auth/login');
        return;
      }

      setUser(userData);
      setProfile(userProfile);
    } catch (error) {
      console.error('Error checking customer access:', error);
      // Allow marketing pages to show on root /customer route even on error
      if (pathname === '/customer') {
        setLoading(false);
        return;
      }
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/browse?search=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // For marketing pages (non-authenticated users on /customer route), render children without any layout constraints
  if (!user && !loading && pathname === '/customer') {
    return (
      <CountryProvider>
        <div style={{ margin: 0, padding: 0, width: '100%', minHeight: '100vh' }}>
          {children}
        </div>
      </CountryProvider>
    );
  }

  // For other routes, don't render anything if no user (and not loading)
  if (!user && !loading) {
    return null;
  }

  // If we have a user but no profile yet, show loading
  if (user && !profile && loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Initialize audit logging for customer actions
  const auditLogger = new AuditLogger()

  return (
    // Temporarily disable SecureWrapper to prevent false positives in customer interface  
    // <SecureWrapper componentName="CustomerLayout" sensitiveContent={false} config={{...}}>
    <CountryProvider userPhone={profile?.phone}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
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
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="flex items-center space-x-2">
            <Image 
              src="/assets/logos/paw-svgrepo-200x200-purple.svg" 
              alt="Pawtraits"
              width={32}
              height={32}
              className="w-8 h-8 filter brightness-0 invert"
            />
            <span className="text-xl font-bold">Pawtraits</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="hover:bg-white/20 rounded p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* User Profile Section */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {profile?.first_name} {profile?.last_name}
              </p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav aria-label="Account menu" className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(pathname, item.match);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center px-3 py-3 text-base font-medium rounded-lg transition-colors duration-200 ${
                    isActive ? 'bg-purple-50 text-purple-800' : 'text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" aria-hidden="true" />
                  {item.name}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4 space-y-1">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                >
                  <Icon className="w-4 h-4 mr-3" aria-hidden="true" />
                  {item.name}
                  {item.href === '/customer/inbox' && unreadCount > 0 && (
                    <span className="ml-auto rounded-full bg-purple-600 px-2 text-xs font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  )}
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
                  aria-label="Open menu"
                  className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg p-2 transition-colors"
                >
                <Menu className="w-5 h-5 text-gray-700" aria-hidden="true" />
                <Image 
                  src="/assets/logos/paw-svgrepo-200x200-purple.svg" 
                  alt="Pawtraits"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
                <span className="text-xl font-semibold text-gray-900">Pawtraits</span>
              </button>
            </div>
            
            {/* Search Bar */}
            <div className="hidden md:block flex-1 max-w-2xl mx-4">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search designs, breeds, themes…"
                  aria-label="Search designs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </form>
            </div>
            
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="hidden sm:block"><CountrySelector compact={true} showLabel={false} /></div>

              {/* Inbox Icon */}
              <Link href="/customer/inbox" aria-label={unreadCount > 0 ? `Inbox, ${unreadCount} unread` : 'Inbox'} className="relative">
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>

              <CartIcon />
            </div>
          </div>
          </header>

          {/* Page Content */}
          <main className="p-4 pb-24 md:p-6">
            {children}
          </main>

          {/* Phone tab bar: the same four places as the menu */}
          <CustomerTabBar />
        </div>
      </div>
    </CountryProvider>
    // </SecureWrapper>  // Temporarily disabled
  );
}