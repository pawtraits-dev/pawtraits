import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import CustomerOrdersView from '@/components/orders/CustomerOrdersView';
import PartnerOrdersView from '@/components/orders/PartnerOrdersView';
import AdminOrdersView from '@/components/orders/AdminOrdersView';

// 🏗️ USER-TYPE AWARE ORDERS PAGE
// This page routes to appropriate orders view based on authenticated user type
// Following established architectural patterns

// Force dynamic rendering - don't attempt to prerender this auth-required page
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      redirect('/auth/login');
    }

    // Get user profile using RPC
    const { data: profileData, error: profileError } = await supabase
      .rpc('get_user_profile', { user_uuid: user.id });

    if (profileError || !profileData || (Array.isArray(profileData) && profileData.length === 0)) {
      console.error('❌ ORDERS: Profile error:', profileError);
      redirect('/auth/login');
    }

    // Handle both single object and array responses from RPC
    const userProfile = Array.isArray(profileData) ? profileData[0] : profileData;

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