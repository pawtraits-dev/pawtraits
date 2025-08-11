'use client';

import { useEffect, ReactNode } from 'react';
import { useUserRouting } from '@/hooks/use-user-routing';
import { UserType } from '@/lib/user-types';

interface UserThemeProviderProps {
  children: ReactNode;
}

export function UserThemeProvider({ children }: UserThemeProviderProps) {
  const { userType, loading } = useUserRouting();

  useEffect(() => {
    if (!loading) {
      // Remove any existing theme classes
      document.body.classList.remove('theme-admin', 'theme-partner', 'theme-customer');
      
      // Add the appropriate theme class
      if (userType) {
        document.body.classList.add(`theme-${userType}`);
      }
    }
  }, [userType, loading]);

  return <>{children}</>;
}

export function getThemeClass(userType: UserType | null): string {
  switch (userType) {
    case 'admin':
      return 'theme-admin';
    case 'partner':
      return 'theme-partner';
    case 'customer':
      return 'theme-customer';
    default:
      return ''; // Default theme
  }
}

export function getThemeColors(userType: UserType | null) {
  switch (userType) {
    case 'admin':
      return {
        primary: 'bg-yellow-500 hover:bg-yellow-600 text-gray-900',
        secondary: 'bg-yellow-100 text-yellow-800',
        background: 'bg-gradient-to-br from-yellow-50 to-amber-50',
        gradient: 'bg-gradient-to-r from-yellow-500 to-amber-500'
      };
    case 'partner':
      return {
        primary: 'bg-green-600 hover:bg-green-700 text-white',
        secondary: 'bg-green-100 text-green-800',
        background: 'bg-gradient-to-br from-green-50 to-emerald-50',
        gradient: 'bg-gradient-to-r from-green-600 to-emerald-600'
      };
    case 'customer':
      return {
        primary: 'bg-purple-600 hover:bg-purple-700 text-white',
        secondary: 'bg-purple-100 text-purple-800',
        background: 'bg-gradient-to-br from-purple-50 to-blue-50',
        gradient: 'bg-gradient-to-r from-purple-600 to-pink-600'
      };
    default:
      return {
        primary: 'bg-purple-600 hover:bg-purple-700 text-white',
        secondary: 'bg-purple-100 text-purple-800',
        background: 'bg-gradient-to-br from-purple-50 to-blue-50',
        gradient: 'bg-gradient-to-r from-purple-600 to-pink-600'
      };
  }
}