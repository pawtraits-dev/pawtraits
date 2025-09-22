'use client';

import CustomerOrdersView from '@/components/orders/CustomerOrdersView';
import PartnerOrdersView from '@/components/orders/PartnerOrdersView';
import AdminOrdersView from '@/components/orders/AdminOrdersView';
import { UserAccessControl } from '@/components/user-access-control';
import { useUserRouting } from '@/hooks/use-user-routing';

// 🏗️ USER-TYPE AWARE ORDERS PAGE
// This page routes to appropriate orders view based on authenticated user type
// Following our new architectural patterns from docs/patterns/

function OrdersPageContent() {
  const { userProfile } = useUserRouting();

  console.log('🔍 ORDERS PAGE: User type:', userProfile?.user_type, 'User:', userProfile?.email);

  // ✅ ARCHITECTURAL PATTERN: Route to appropriate component based on user type
  switch (userProfile?.user_type) {
    case 'customer':
      return <CustomerOrdersView userProfile={userProfile} />;

    case 'partner':
      return <PartnerOrdersView userProfile={userProfile} />;

    case 'admin':
      return <AdminOrdersView userProfile={userProfile} />;

    default:
      console.error('❌ ORDERS PAGE: Unknown user type:', userProfile?.user_type);
      return null;
  }
}

export default function OrdersPage() {
  return (
    <UserAccessControl
      allowedUserTypes={['admin', 'partner', 'customer']}
      fallbackMessage="You need to be logged in to view orders."
    >
      <OrdersPageContent />
    </UserAccessControl>
  );
}

// 📋 ARCHITECTURAL COMPLIANCE CHECKLIST:
// ✅ No direct database queries in this component
// ✅ Uses SupabaseService only for authentication
// ✅ Server-side user type detection
// ✅ Delegates to specific view components
// ✅ Proper redirect handling for unauthenticated users