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
  Send,
  Coffee,
  MapPin,
  Printer,
  Sparkles,
  Instagram,
  Layers,
  ScanSearch,
  Wand2,
  ChevronRight,
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

// Grouped by job: making designs, the settings they're made from, what customers make, selling,
// stalls, people, marketing, numbers. Each group folds away (the one with the current page opens).
const overviewItem = { name: 'Overview', href: '/admin', icon: Home };
const navigationSections = [
  {
    title: 'Catalogue',
    items: [
      { name: 'Image Catalog', href: '/admin/catalog', icon: ImageIcon },
      { name: 'Generate Images', href: '/admin/generate', icon: Wand2 },
      { name: 'Variation Batches', href: '/admin/variation-batches', icon: Layers },
      { name: 'Collections', href: '/admin/collections', icon: Layers },
      { name: 'Quizzes', href: '/admin/quizzes', icon: Sparkles },
    ]
  },
  {
    title: 'Design Settings',
    items: [
      { name: 'Breeds', href: '/admin/breeds', icon: Tag },
      { name: 'Coats', href: '/admin/coats', icon: Palette },
      { name: 'Themes', href: '/admin/themes', icon: ImageIcon },
      { name: 'Styles', href: '/admin/styles', icon: Eye },
      { name: 'Outfits', href: '/admin/outfits', icon: Shirt },
      { name: 'Formats', href: '/admin/formats', icon: FileImage },
      { name: 'Definitions', href: '/admin/definitions', icon: Database },
    ]
  },
  {
    title: 'Mugs',
    items: [
      { name: 'Mug Catalog', href: '/admin/mugs/catalog', icon: Coffee },
      { name: 'Mug Colours', href: '/admin/mugs/colours', icon: Palette },
      { name: 'Mug Generations', href: '/admin/mugs/generations', icon: BarChart3 },
      { name: 'Mug Mockup Photos', href: '/admin/mugs/mockups', icon: Coffee },
    ]
  },
  {
    title: 'Customer Pictures',
    items: [
      { name: 'Customisations', href: '/admin/customisations', icon: Wand2 },
      { name: 'Customer Paintings', href: '/admin/custom-paintings', icon: ScanSearch },
      { name: 'Customer Customizations', href: '/admin/customer-customizations', icon: ImageIcon },
    ]
  },
  {
    title: 'Orders & Products',
    items: [
      { name: 'Orders', href: '/admin/orders', icon: ShoppingBag },
      { name: 'Products', href: '/admin/products', icon: Package },
      { name: 'Pricing Management', href: '/admin/pricing-management', icon: Settings },
      { name: 'Media', href: '/admin/media', icon: Database },
      { name: 'Countries', href: '/admin/countries', icon: Globe },
    ]
  },
  {
    title: 'Stock & Stalls',
    items: [
      { name: 'Trade Print Orders', href: '/admin/stock/trade-orders', icon: Printer },
      { name: 'Locations', href: '/admin/stock/locations', icon: MapPin },
      { name: 'Sticker Sheets', href: '/admin/stock/stickers', icon: Printer },
      { name: 'Sticker QR Report', href: '/admin/stock/qr-report', icon: QrCode },
      { name: 'Guest & Stall Settings', href: '/admin/settings/guest-and-stall', icon: Settings },
    ]
  },
  {
    title: 'Customers & Partners',
    items: [
      { name: 'Customers', href: '/admin/customers', icon: Users },
      { name: 'Customer Referrals', href: '/admin/customer-referrals', icon: UserPlus },
      { name: 'Credit Pack Settings', href: '/admin/settings/credit-packs', icon: CreditCard },
      { name: 'Partners', href: '/admin/partners', icon: Users },
      { name: 'Partner Referrals', href: '/admin/referrals', icon: Target },
      { name: 'Pre-Registration Codes', href: '/admin/partners/pre-registration', icon: QrCode },
      { name: 'Influencers', href: '/admin/influencers', icon: Heart },
    ]
  },
  {
    title: 'Marketing & Messages',
    items: [
      { name: 'Social', href: '/admin/social', icon: Instagram },
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
    title: 'Finance',
    items: [
      { name: 'Revenue', href: '/admin/financial/revenue', icon: DollarSign },
      { name: 'Sales', href: '/admin/financial/sales', icon: CreditCard },
      { name: 'Costs', href: '/admin/financial/costs', icon: TrendingUp },
      { name: 'AI Costs', href: '/admin/ai-costs', icon: Sparkles },
      { name: 'Profit', href: '/admin/financial/profit', icon: PieChart },
      { name: 'Commissions', href: '/admin/financial/commissions', icon: Target },
    ]
  },
  {
    title: 'Testing',
    items: [
      { name: 'Preview Size Test', href: '/admin/size-test', icon: ImageIcon },
      { name: 'Consistency Test', href: '/admin/consistency-test', icon: ScanSearch },
    ]
  },
];

/** Is this nav item the current page (or a page inside it, e.g. /admin/breeds/123)? */
const matches = (pathname: string, href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`));
const OPEN_KEY = 'pt_admin_nav_open';

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Which nav groups are open (remembered in this browser); the current page's group always opens
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  useEffect(() => {
    let saved: string[] = [];
    try { saved = JSON.parse(localStorage.getItem(OPEN_KEY) || '[]'); } catch { /* private mode */ }
    const current = navigationSections.find(sec => sec.items.some(i => matches(pathname || '', i.href)))?.title;
    setOpenGroups(Array.from(new Set([...(Array.isArray(saved) ? saved : []), ...(current ? [current] : [])])));
  }, [pathname]);
  const toggleGroup = (title: string) => setOpenGroups(prev => {
    const next = prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title];
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });
  
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
        <nav className="flex-1 overflow-y-auto p-3 min-h-0" aria-label="Admin">
          <Link
            href={overviewItem.href}
            onClick={() => setSidebarOpen(false)}
            className={`mb-2 flex items-center px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
              pathname === overviewItem.href ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Home className="w-4 h-4 mr-3" />
            {overviewItem.name}
          </Link>
          {navigationSections.map((section) => {
            const open = openGroups.includes(section.title);
            const hasCurrent = section.items.some(i => matches(pathname || '', i.href));
            const id = `nav-${section.title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
            return (
              <div key={section.title} className="border-t border-gray-100 py-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(section.title)}
                  aria-expanded={open}
                  aria-controls={id}
                  className={`flex w-full items-center rounded-md px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide hover:bg-gray-50 ${hasCurrent ? 'text-purple-700' : 'text-gray-600'}`}
                >
                  <ChevronRight className={`mr-1.5 h-4 w-4 shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} aria-hidden />
                  <span className="flex-1">{section.title}</span>
                  {!open && <span className="text-[10px] font-normal normal-case text-gray-400">{section.items.length}</span>}
                </button>
                {open && (
                  <div id={id} className="mt-0.5 space-y-0.5 pb-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = matches(pathname || '', item.href)
                        && !section.items.some(o => o.href !== item.href && o.href.length > item.href.length && matches(pathname || '', o.href));
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex items-center py-1.5 pl-8 pr-3 text-sm rounded-md transition-colors duration-200 ${
                            isActive
                              ? 'bg-purple-100 text-purple-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <Icon className="w-4 h-4 mr-2.5 shrink-0" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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