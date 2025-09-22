import { redirect } from 'next/navigation';
import { SupabaseService } from '@/lib/supabase';
import CustomerOrdersView from '@/components/orders/CustomerOrdersView';
import PartnerOrdersView from '@/components/orders/PartnerOrdersView';
import AdminOrdersView from '@/components/orders/AdminOrdersView';

// 🏗️ USER-TYPE AWARE ORDERS PAGE
// This page routes to appropriate orders view based on authenticated user type
// Following established architectural patterns

// Force dynamic rendering - don't attempt to prerender this auth-required page
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const supabaseService = new SupabaseService();

  try {
    // Get authenticated user profile
    const userProfile = await supabaseService.getCurrentUserProfile();

    if (!userProfile) {
      redirect('/auth/login');
    }

    // ✅ ARCHITECTURAL PATTERN: Route to appropriate component based on user type
    switch (userProfile.user_type) {
      case 'customer':
        return <CustomerOrdersView userProfile={userProfile} />;

      case 'partner':
        return <PartnerOrdersView userProfile={userProfile} />;

      case 'admin':
        return <AdminOrdersView userProfile={userProfile} />;

      default:
        console.error('❌ ORDERS: Unknown user type:', userProfile.user_type);
        redirect('/auth/login');
    }

  } catch (error) {
    console.error('❌ ORDERS: Authentication error:', error);
    redirect('/auth/login');
  }
}

// 📋 ARCHITECTURAL COMPLIANCE CHECKLIST:
// ✅ Server-side authentication and user type detection
// ✅ Unified entry point for all user types accessing orders
// ✅ Routes to appropriate user-type specific view components
// ✅ Proper error handling and authentication redirects
// ✅ No direct database access - delegates to view components
// ✅ Follows established architectural patterns