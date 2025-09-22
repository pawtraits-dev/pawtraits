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
  // DEBUG: Detailed authentication debugging
  console.log('🔍 ORDERS DEBUG: Starting authentication check...');

  const supabaseService = new SupabaseService();

  // Debug step 1: Check if we can get a user at all
  try {
    const { data: { user }, error: userError } = await supabaseService.getClient().auth.getUser();
    console.log('🔍 ORDERS DEBUG - Raw user check:', {
      user: user ? { id: user.id, email: user.email } : null,
      userError: userError?.message
    });

    if (!user) {
      console.log('🔍 ORDERS DEBUG: No user found, redirecting to login');
      redirect('/auth/login');
    }

    // Debug step 2: Try to get user profile
    const userProfile = await supabaseService.getCurrentUserProfile();
    console.log('🔍 ORDERS DEBUG - User profile check:', {
      userProfile: userProfile ? {
        id: userProfile.id,
        email: userProfile.email,
        user_type: userProfile.user_type,
        first_name: userProfile.first_name
      } : null
    });

    if (!userProfile) {
      console.log('🔍 ORDERS DEBUG: User exists but no profile found, redirecting to login');
      redirect('/auth/login');
    }

    console.log('🔍 ORDERS DEBUG: Authentication successful - User type:', userProfile.user_type, 'Email:', userProfile.email);

    // Continue with normal flow
    const profile = userProfile;

    // ✅ ARCHITECTURAL PATTERN: Route to appropriate component based on user type
    switch (profile.user_type) {
      case 'customer':
        return <CustomerOrdersView userProfile={profile} />;

      case 'partner':
        return <PartnerOrdersView userProfile={profile} />;

      case 'admin':
        return <AdminOrdersView userProfile={profile} />;

      default:
        console.error('❌ ORDERS DEBUG: Unknown user type:', profile.user_type);
        redirect('/auth/login');
    }

  } catch (error) {
    console.error('🔍 ORDERS DEBUG: Authentication error:', error);
    redirect('/auth/login');
  }
}

// 📋 DEBUG INVESTIGATION:
// - Check server console for detailed auth debugging logs
// - Look for "🔍 ORDERS DEBUG" messages to see where auth is failing
// - Compare with working pages to identify the pattern difference