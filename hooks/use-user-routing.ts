'use client';

import { useState, useEffect } from 'react';
import { UserProfile } from '@/lib/user-types';
import { getUserHomeRouteFromProfile, getContinueShoppingRouteFromProfile } from '@/lib/user-routing';

export function useUserRouting() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadUserProfile = async () => {
    try {
      console.log('useUserRouting - Checking auth via API...');

      // Use the same auth check pattern as HybridCartProvider
      const authCheckResponse = await fetch('/api/auth/check', {
        credentials: 'include'
      });

      if (!authCheckResponse.ok) {
        console.log('useUserRouting - Auth check failed, user is guest');
        setUserProfile(null);
        setLoading(false);
        return;
      }

      const { isAuthenticated, user } = await authCheckResponse.json();

      if (!isAuthenticated || !user) {
        console.log('useUserRouting - User not authenticated');
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // The auth/check endpoint now returns the full user profile
      console.log('useUserRouting - Profile loaded:', user);
      setUserProfile(user);

    } catch (error) {
      console.error('useUserRouting - Error loading user profile:', error);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshAuth = () => {
    setLoading(true);
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    loadUserProfile();
  }, [refreshTrigger]);

  // Auto-refresh auth when returning from sign-in
  useEffect(() => {
    const handleFocus = () => {
      // When the window regains focus (user returns from sign-in), refresh auth
      if (!userProfile) {
        console.log('useUserRouting - Window focused, refreshing auth state...');
        refreshAuth();
      }
    };

    const handleVisibilityChange = () => {
      // When tab becomes visible again, refresh auth if needed
      if (!document.hidden && !userProfile) {
        console.log('useUserRouting - Tab visible, refreshing auth state...');
        refreshAuth();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      // Listen for auth-related storage changes
      if (e.key === 'supabase.auth.token' || e.key?.startsWith('sb-')) {
        console.log('useUserRouting - Auth storage changed, refreshing auth state...');
        refreshAuth();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [userProfile]);

  const homeRoute = getUserHomeRouteFromProfile(userProfile);
  const continueShoppingRoute = getContinueShoppingRouteFromProfile(userProfile);

  return {
    userProfile,
    loading,
    homeRoute,
    continueShoppingRoute,
    userType: userProfile?.user_type || null,
    isAuthenticated: !!userProfile,
    refreshAuth,
  };
}