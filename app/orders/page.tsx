import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import CustomerOrdersView from '@/components/orders/CustomerOrdersView';
import PartnerOrdersView from '@/components/orders/PartnerOrdersView';
import AdminOrdersView from '@/components/orders/AdminOrdersView';

// 🏗️ USER-TYPE AWARE ORDERS PAGE
// This page routes to appropriate orders view based on authenticated user type
// Following established architectural patterns

// Force dynamic rendering - don't attempt to prerender this auth-required page
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  try {
    // ✅ ARCHITECTURAL PATTERN: Use API endpoint for authentication and user profile
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/check`, {
      headers: {
        'Cookie': cookies().toString(),
      },
    });

    if (!response.ok) {
      throw new Error(`Auth check API error: ${response.status}`);
    }

    const authData = await response.json();

    if (!authData.isAuthenticated || !authData.user) {
      redirect('/auth/login');
    }

    const userProfile = authData.user;

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
    console.error('❌ ORDERS: API error:', error);
    redirect('/auth/login');
  }
}

// 📋 ARCHITECTURAL COMPLIANCE CHECKLIST:
// ✅ Server-side authentication via API endpoint (/api/auth/check)
// ✅ No direct database/RPC calls from page components
// ✅ Unified entry point for all user types accessing orders
// ✅ Routes to appropriate user-type specific view components
// ✅ Proper error handling and authentication redirects
// ✅ API-only data access pattern maintained
// ✅ Follows established architectural governance