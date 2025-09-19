import { redirect } from 'next/navigation';
import { SupabaseService } from '@/lib/supabase';
import CustomerAccountView from '@/components/account/CustomerAccountView';
import PartnerAccountView from '@/components/account/PartnerAccountView';
import AdminAccountView from '@/components/account/AdminAccountView';

// 🏗️ USER-TYPE AWARE ACCOUNT PAGE
// This page routes to appropriate account view based on authenticated user type
// Following our new architectural patterns from docs/patterns/

export default async function AccountPage() {
  // ✅ ARCHITECTURAL PATTERN: Server-side user type detection
  const supabaseService = new SupabaseService();
  const userProfile = await supabaseService.getCurrentUserProfile();

  if (!userProfile) {
    redirect('/auth/login');
  }

  console.log('🔍 ACCOUNT PAGE: User type:', userProfile.user_type, 'User:', userProfile.email);

  // ✅ ARCHITECTURAL PATTERN: Route to appropriate component based on user type
  switch (userProfile.user_type) {
    case 'customer':
      return <CustomerAccountView userProfile={userProfile} />;

    case 'partner':
      return <PartnerAccountView userProfile={userProfile} />;

    case 'admin':
      return <AdminAccountView userProfile={userProfile} />;

    default:
      console.error('❌ ACCOUNT PAGE: Unknown user type:', userProfile.user_type);
      redirect('/auth/login');
  }
}

// 📋 ARCHITECTURAL COMPLIANCE CHECKLIST:
// ✅ No direct database queries in this component
// ✅ Uses SupabaseService only for authentication
// ✅ Server-side user type detection
// ✅ Delegates to specific view components
// ✅ Proper redirect handling for unauthenticated users