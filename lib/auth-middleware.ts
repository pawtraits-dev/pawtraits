import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { UserProfile, UserType } from './user-types';

export interface AuthContext {
  user: any;
  profile: UserProfile;
  isAuthenticated: boolean;
  userType: UserType;
}

/**
 * Middleware to check authentication and user type
 */
export class AuthMiddleware {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  /**
   * Get authentication context from request
   */
  async getAuthContext(request: NextRequest): Promise<AuthContext | null> {
    try {
      // Get token from Authorization header
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Get user from token using direct client
      const { data: { user }, error } = await this.supabase.auth.getUser(token);
      
      if (error || !user) {
        return null;
      }

      // Get user profile
      const { data: profile } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (!profile) {
        return null;
      }

      return {
        user,
        profile,
        isAuthenticated: true,
        userType: profile.user_type
      };
    } catch (error) {
      console.error('Error getting auth context:', error);
      return null;
    }
  }

  /**
   * Require authentication
   */
  async requireAuth(request: NextRequest): Promise<AuthContext | NextResponse> {
    const authContext = await this.getAuthContext(request);
    
    if (!authContext) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return authContext;
  }

  /**
   * Require specific user type
   */
  async requireUserType(
    request: NextRequest, 
    requiredTypes: UserType | UserType[]
  ): Promise<AuthContext | NextResponse> {
    const authResult = await this.requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const allowedTypes = Array.isArray(requiredTypes) ? requiredTypes : [requiredTypes];
    
    if (!allowedTypes.includes(authResult.userType)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return authResult;
  }

  /**
   * Require admin access
   */
  async requireAdmin(request: NextRequest): Promise<AuthContext | NextResponse> {
    return this.requireUserType(request, 'admin');
  }

  /**
   * Require partner access
   */
  async requirePartner(request: NextRequest): Promise<AuthContext | NextResponse> {
    return this.requireUserType(request, 'partner');
  }

  /**
   * Require customer access
   */
  async requireCustomer(request: NextRequest): Promise<AuthContext | NextResponse> {
    return this.requireUserType(request, 'customer');
  }

  /**
   * Require admin or partner access
   */
  async requireAdminOrPartner(request: NextRequest): Promise<AuthContext | NextResponse> {
    return this.requireUserType(request, ['admin', 'partner']);
  }

  /**
   * Check if user owns resource (for user-specific endpoints)
   */
  async requireResourceOwnership(
    request: NextRequest,
    resourceUserId: string
  ): Promise<AuthContext | NextResponse> {
    const authResult = await this.requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Admins can access any resource
    if (authResult.userType === 'admin') {
      return authResult;
    }

    // User can only access their own resources
    if (authResult.user.id !== resourceUserId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return authResult;
  }
}

// Utility functions for API routes
export const authMiddleware = new AuthMiddleware();

/**
 * Higher-order function to wrap API route handlers with authentication
 */
export function withAuth<T extends any[]>(
  handler: (authContext: AuthContext, request: NextRequest, ...args: T) => Promise<NextResponse>,
  requiredTypes?: UserType | UserType[]
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    let authResult: AuthContext | NextResponse;

    if (requiredTypes) {
      authResult = await authMiddleware.requireUserType(request, requiredTypes);
    } else {
      authResult = await authMiddleware.requireAuth(request);
    }

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    return handler(authResult, request, ...args);
  };
}

/**
 * Wrapper for admin-only routes
 */
export function withAdminAuth<T extends any[]>(
  handler: (authContext: AuthContext, request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return withAuth(handler, 'admin');
}

/**
 * Wrapper for partner-only routes
 */
export function withPartnerAuth<T extends any[]>(
  handler: (authContext: AuthContext, request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return withAuth(handler, 'partner');
}

/**
 * Wrapper for customer-only routes
 */
export function withCustomerAuth<T extends any[]>(
  handler: (authContext: AuthContext, request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return withAuth(handler, 'customer');
}