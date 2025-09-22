'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CustomerOrdersView from '@/components/orders/CustomerOrdersView';
import PartnerOrdersView from '@/components/orders/PartnerOrdersView';
import AdminOrdersView from '@/components/orders/AdminOrdersView';

// 🏗️ CLIENT-SIDE USER-TYPE AWARE ORDERS PAGE
// This page routes to appropriate orders view based on authenticated user type
// Following established architectural patterns for client-side auth checking

export default function OrdersPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      try {
        // ✅ ARCHITECTURAL PATTERN: Use API endpoint for authentication and user profile
        const response = await fetch('/api/auth/check', {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Auth check API error: ${response.status}`);
        }

        const authData = await response.json();

        if (!authData.isAuthenticated || !authData.user) {
          console.log('❌ ORDERS: User not authenticated, redirecting to login');
          router.push('/auth/login');
          return;
        }

        const profile = authData.user;
        console.log('✅ ORDERS: User authenticated:', {
          user_type: profile.user_type,
          email: profile.email
        });

        // Validate user type
        if (!['customer', 'partner', 'admin'].includes(profile.user_type)) {
          console.error('❌ ORDERS: Unknown user type:', profile.user_type);
          router.push('/auth/login');
          return;
        }

        setUserProfile(profile);
      } catch (error) {
        console.error('❌ ORDERS: API error:', error);
        setError('Failed to load user profile');
        router.push('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadProfile();
  }, [router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // No user profile loaded (shouldn't happen due to loading/error states above)
  if (!userProfile) {
    return null;
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
      // This shouldn't happen due to validation above, but just in case
      console.error('❌ ORDERS: Unknown user type in render:', userProfile.user_type);
      router.push('/auth/login');
      return null;
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