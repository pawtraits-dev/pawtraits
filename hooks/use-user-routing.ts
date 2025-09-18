'use client';

import { useState, useEffect } from 'react';
import { UserProfile } from '@/lib/user-types';
import { getUserHomeRouteFromProfile, getContinueShoppingRouteFromProfile } from '@/lib/user-routing';

export function useUserRouting() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    loadUserProfile();
  }, []);

  const homeRoute = getUserHomeRouteFromProfile(userProfile);
  const continueShoppingRoute = getContinueShoppingRouteFromProfile(userProfile);

  return {
    userProfile,
    loading,
    homeRoute,
    continueShoppingRoute,
    userType: userProfile?.user_type || null,
    isAuthenticated: !!userProfile,
  };
}