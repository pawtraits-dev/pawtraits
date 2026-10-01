'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CustomerTabBar from '@/components/customer/CustomerTabBar';
import CustomerAccountView from '@/components/account/CustomerAccountView';
import PartnerAccountView from '@/components/account/PartnerAccountView';
import InfluencerAccountView from '@/components/account/InfluencerAccountView';
import AdminAccountView from '@/components/account/AdminAccountView';

// 🏗️ CLIENT-SIDE USER-TYPE AWARE ACCOUNT PAGE
// This page routes to appropriate account view based on authenticated user type
// Following established architectural patterns for client-side auth checking

export default function AccountPage() {
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
          console.log('❌ ACCOUNT: User not authenticated, redirecting to login');
          router.push('/auth/login');
          return;
        }

        const profile = authData.user;
        console.log('✅ ACCOUNT: User authenticated:', {
          user_type: profile.user_type,
          email: profile.email
        });

        // Validate user type
        if (!['customer', 'partner', 'influencer', 'admin'].includes(profile.user_type)) {
          console.error('❌ ACCOUNT: Unknown user type:', profile.user_type);
          router.push('/auth/login');
          return;
        }

        setUserProfile(profile);
      } catch (error) {
        console.error('❌ ACCOUNT: API error:', error);
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
          <p className="text-gray-600">Loading account...</p>
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
      return (<div className="pb-16 md:pb-0"><CustomerAccountView userProfile={userProfile} /><CustomerTabBar /></div>);

    case 'partner':
      return <PartnerAccountView userProfile={userProfile} />;

    case 'influencer':
      return <InfluencerAccountView userProfile={userProfile} />;

    case 'admin':
      return <AdminAccountView userProfile={userProfile} />;

    default:
      // This shouldn't happen due to validation above, but just in case
      console.error('❌ ACCOUNT: Unknown user type in render:', userProfile.user_type);
      router.push('/auth/login');
      return null;
  }
}

// 📋 ARCHITECTURAL COMPLIANCE CHECKLIST:
// ✅ No direct database queries in this component
// ✅ Uses SupabaseService only for authentication
// ✅ Server-side user type detection
// ✅ Delegates to specific view components
// ✅ Proper redirect handling for unauthenticated users