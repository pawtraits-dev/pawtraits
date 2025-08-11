'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useUserRouting } from '@/hooks/use-user-routing';
import { UserType } from '@/lib/user-types';
import { Loader2, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface UserAccessControlProps {
  allowedUserTypes: UserType[];
  children: ReactNode;
  fallbackMessage?: string;
  redirectTo?: string;
}

export function UserAccessControl({ 
  allowedUserTypes, 
  children, 
  fallbackMessage,
  redirectTo 
}: UserAccessControlProps) {
  const router = useRouter();
  const { userProfile, loading, userType, isAuthenticated } = useUserRouting();

  useEffect(() => {
    if (!loading) {
      // If not authenticated, redirect to home
      if (!isAuthenticated) {
        router.push(redirectTo || '/');
        return;
      }

      // If authenticated but wrong user type, redirect to their home
      if (userType && !allowedUserTypes.includes(userType)) {
        const homeRoute = userType === 'admin' ? '/admin' 
                        : userType === 'partner' ? '/partners'
                        : userType === 'customer' ? '/customer' 
                        : '/';
        router.push(homeRoute);
        return;
      }
    }
  }, [loading, isAuthenticated, userType, allowedUserTypes, router, redirectTo]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-600" />
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Required</h1>
            <p className="text-gray-600 mb-6">
              {fallbackMessage || 'You need to be logged in to access this page.'}
            </p>
            <div className="space-y-3">
              <Link href="/auth/login">
                <Button className="w-full">Sign In</Button>
              </Link>
              <Link href="/signup/user">
                <Button variant="outline" className="w-full">Create Account</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If wrong user type
  if (userType && !allowedUserTypes.includes(userType)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              You don't have permission to access this page.
            </p>
            <Button onClick={() => router.back()} className="w-full">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user has correct access, show the content
  return <>{children}</>;
}

// Convenience components for specific user types
export function AdminOnly({ children }: { children: ReactNode }) {
  return (
    <UserAccessControl 
      allowedUserTypes={['admin']}
      fallbackMessage="This page is only accessible to administrators."
    >
      {children}
    </UserAccessControl>
  );
}

export function PartnerOnly({ children }: { children: ReactNode }) {
  return (
    <UserAccessControl 
      allowedUserTypes={['partner']}
      fallbackMessage="This page is only accessible to partners."
    >
      {children}
    </UserAccessControl>
  );
}

export function CustomerOnly({ children }: { children: ReactNode }) {
  return (
    <UserAccessControl 
      allowedUserTypes={['customer']}
      fallbackMessage="This page is only accessible to customers."
    >
      {children}
    </UserAccessControl>
  );
}

export function AuthenticatedOnly({ children }: { children: ReactNode }) {
  return (
    <UserAccessControl 
      allowedUserTypes={['admin', 'partner', 'customer']}
      fallbackMessage="You need to be logged in to access this page."
    >
      {children}
    </UserAccessControl>
  );
}