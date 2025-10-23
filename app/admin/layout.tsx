'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield,
  BarChart3,
  Users,
  ShoppingBag,
  Image as ImageIcon,
  Palette,
  Tag,
  Settings,
  DollarSign,
  Heart,
  Share2,
  FileImage,
  Package,
  Shirt,
  Eye,
  LogOut,
  Menu,
  X,
  Home,
  Database,
  TrendingUp,
  PieChart,
  CreditCard,
  Target,
  Globe,
  QrCode,
  UserPlus,
  Mail,
  MessageSquare,
  Send
} from 'lucide-react';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';
import { PawSpinner } from '@/components/ui/paw-spinner';

// Security imports
import { SecureWrapper } from '@/components/security/SecureWrapper';
import { ClickjackingProtection } from '@/components/security/ClickjackingProtection';
import { AuditLogger } from '@/lib/audit-logger';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navigationSections = [
  {
    title: 'Dashboard',
    items: [
      { name: 'Overview', href: '/admin', icon: Home },
    ]
  },
  {
    title: 'Content Management',
    items: [
      { name: 'Breeds', href: '/admin/breeds', icon: Tag },
      { name: 'Coats', href: '/admin/coats', icon: Palette },
      { name: 'Themes', href: '/admin/themes', icon: Image },
      { name: 'Styles', href: '/admin/styles', icon: Eye },
      { name: 'Outfits', href: '/admin/outfits', icon: Shirt },
      { name: 'Formats', href: '/admin/formats', icon: FileImage },
    ]
  },
  {
    title: 'Commerce',
    items: [
      { name: 'Products', href: '/admin/products', icon: Package },
      { name: 'Countries', href: '/admin/countries', icon: Globe },
      { name: 'Media', href: '/admin/media', icon: Database },
      { name: 'Pricing', href: '/admin/pricing', icon: DollarSign },
      { name: 'Pricing Management', href: '/admin/pricing-management', icon: Settings },
      { name: 'Orders', href: '/admin/orders', icon: ShoppingBag },
    ]
  },
  {
    title: 'Users & Partners',
    items: [
      { name: 'Customers', href: '/admin/customers', icon: Users },
      { name: 'Partners', href: '/admin/partners', icon: Users },
      { name: 'Influencers', href: '/admin/influencers', icon: Heart },
      { name: 'Pre-Registration Codes', href: '/admin/partners/pre-registration', icon: QrCode },
      { name: 'Partner Referrals', href: '/admin/referrals', icon: Target },
      { name: 'Customer Referrals', href: '/admin/customer-referrals', icon: UserPlus },
      { name: 'Credit Pack Settings', href: '/admin/settings/credit-packs', icon: CreditCard },
      { name: 'Customer Customizations', href: '/admin/customer-customizations', icon: ImageIcon },
    ]
  },
  {
    title: 'Communications',
    items: [
      { name: 'Message Templates', href: '/admin/messaging', icon: Mail },
      { name: 'Message Queue', href: '/admin/messaging/queue', icon: Send },
      { name: 'Test Email', href: '/admin/messaging/test', icon: MessageSquare },
    ]
  },
  {
    title: 'Analytics',
    items: [
      { name: 'Image Analytics', href: '/admin/image-analytics', icon: BarChart3 },
      { name: 'Liked Images', href: '/admin/liked-images', icon: Heart },
      { name: 'Shared Images', href: '/admin/shared-images', icon: Share2 },
      { name: 'Share Analytics', href: '/admin/analytics/shares', icon: TrendingUp },
    ]
  },
  {
    title: 'Financial',
    items: [
      { name: 'Revenue', href: '/admin/financial/revenue', icon: DollarSign },
      { name: 'Sales', href: '/admin/financial/sales', icon: CreditCard },
      { name: 'Costs', href: '/admin/financial/costs', icon: TrendingUp },
      { name: 'Profit', href: '/admin/financial/profit', icon: PieChart },
      { name: 'Commissions', href: '/admin/financial/commissions', icon: Target },
    ]
  },
  {
    title: 'Tools',
    items: [
      { name: 'Image Catalog', href: '/admin/catalog', icon: ImageIcon },
      { name: 'Generate Images', href: '/admin/generate', icon: ImageIcon },
      { name: 'Definitions', href: '/admin/definitions', icon: Database },
    ]
  }
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const supabaseService = new SupabaseService();
  // Using SupabaseService for consistent authentication

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabaseService.getClient().auth.getUser();
      
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const profile = await supabaseService.getCurrentUserProfile();
      
      if (!profile || profile.user_type !== 'admin') {
        router.push('/auth/login');
        return;
      }

      setUser(user);
    } catch (error) {
      console.error('Error checking admin access:', error);
      router.push('/auth/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabaseService.getClient().auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <PawSpinner size="xl" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Initialize audit logging for admin actions
  const auditLogger = new AuditLogger()

  return (
    // Temporarily disable SecureWrapper to prevent false XSS alerts in admin interface
    // <SecureWrapper componentName="AdminLayout" sensitiveContent={true} config={{...}}>
      <ClickjackingProtection sensitiveAction={true}>
        <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 flex flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <div className="flex items-center space-x-2">
            <Image 
              src="/assets/logos/paw-svgrepo-200x200-gold.svg" 
              alt="Pawtraits Admin"
              width={32}
              height={32}
              className="w-8 h-8 filter brightness-0 invert"
            />
            <span className="text-xl font-bold">Admin Panel</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
          {navigationSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                        isActive
                          ? 'bg-purple-100 text-purple-700 border-r-2 border-purple-600'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
      <div className="md:ml-64">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden"
              >
                <Menu className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">Manage your Pawtraits platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.email}
              </span>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="hidden md:flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
      </ClickjackingProtection>
    // </SecureWrapper>  // Temporarily disabled
  );
}