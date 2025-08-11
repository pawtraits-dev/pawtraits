'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SupabaseService } from '@/lib/supabase';
import type { UserProfile } from '@/lib/user-types';

interface DashboardRouterProps {
  children?: React.ReactNode;
  fallbackPath?: string;
}

export default function DashboardRouter({ children, fallbackPath = '/auth/login' }: DashboardRouterProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const supabaseService = new SupabaseService();

  useEffect(() => {
    checkUserAndRedirect();
  }, []);

  const checkUserAndRedirect = async () => {
    try {
      const profile = await supabaseService.getCurrentUserProfile();
      
      if (!profile) {
        // No user profile found, redirect to login
        router.push(fallbackPath);
        return;
      }

      setUserProfile(profile);

      // If we're already on the correct dashboard, don't redirect
      const currentPath = window.location.pathname;
      const targetPath = getDashboardPath(profile.user_type);
      
      if (!currentPath.startsWith(targetPath)) {
        router.push(targetPath);
        return;
      }

      setLoading(false);
    } catch (error) {
      console.error('Error checking user profile:', error);
      router.push(fallbackPath);
    }
  };

  const getDashboardPath = (userType: string): string => {
    switch (userType) {
      case 'admin':
        return '/admin';
      case 'partner':
        return '/dashboard';
      case 'customer':
        return '/home';
      default:
        return fallbackPath;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}