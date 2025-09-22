import { redirect } from 'next/navigation';
import { SupabaseService } from '@/lib/supabase';
import CustomerOrdersView from '@/components/orders/CustomerOrdersView';
import PartnerOrdersView from '@/components/orders/PartnerOrdersView';
import AdminOrdersView from '@/components/orders/AdminOrdersView';

// 🏗️ USER-TYPE AWARE ORDERS PAGE
// This page routes to appropriate orders view based on authenticated user type
// Following our new architectural patterns from docs/patterns/

// Force dynamic rendering - don't attempt to prerender this auth-required page
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  // ✅ ARCHITECTURAL PATTERN: Server-side user type detection
  const supabaseService = new SupabaseService();
  const userProfile = await supabaseService.getCurrentUserProfile();

  if (!userProfile) {
    redirect('/auth/login');
  }

  console.log('🔍 ORDERS PAGE: User type:', userProfile.user_type, 'User:', userProfile.email);

  // ✅ ARCHITECTURAL PATTERN: Route to appropriate component based on user type
  switch (userProfile.user_type) {
    case 'customer':
      return <CustomerOrdersView userProfile={userProfile} />;

    case 'partner':
      return <PartnerOrdersView userProfile={userProfile} />;

    case 'admin':
      return <AdminOrdersView userProfile={userProfile} />;

    default:
      console.error('❌ ORDERS PAGE: Unknown user type:', userProfile.user_type);
      redirect('/auth/login');
  }
}

// 📋 ARCHITECTURAL COMPLIANCE CHECKLIST:
// ✅ No direct database queries in this component
// ✅ Uses SupabaseService only for authentication
// ✅ Server-side user type detection
// ✅ Delegates to specific view components
// ✅ Proper redirect handling for unauthenticated users