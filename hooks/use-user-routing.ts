'use client';

import { useState, useEffect } from 'react';
import { SupabaseService } from '@/lib/supabase';
import { UserProfile } from '@/lib/user-types';
import { getUserHomeRouteFromProfile, getContinueShoppingRouteFromProfile } from '@/lib/user-routing';

export function useUserRouting() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const supabaseService = new SupabaseService();

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        console.log('useUserRouting - Loading profile via SupabaseService...');
        const profile = await supabaseService.getCurrentUserProfile();
        console.log('useUserRouting - Profile result:', profile);
        setUserProfile(profile);
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