export type UserType = 'admin' | 'partner' | 'customer';

export interface UserProfile {
  id: string;
  user_id: string;
  user_type: UserType;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  status: 'active' | 'inactive' | 'suspended';
  permissions?: string[];
  partner_id?: string;
  customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UserPermissions {
  // Admin permissions
  canManageUsers?: boolean;
  canManagePartners?: boolean;
  canManageCustomers?: boolean;
  canViewAnalytics?: boolean;
  canManageContent?: boolean;
  
  // Partner permissions
  canCreateReferrals?: boolean;
  canViewReferralStats?: boolean;
  canManageProfile?: boolean;
  
  // Customer permissions
  canCreateOrders?: boolean;
  canViewOrderHistory?: boolean;
  canManagePets?: boolean;
}

export const DEFAULT_PERMISSIONS: Record<UserType, UserPermissions> = {
  admin: {
    canManageUsers: true,
    canManagePartners: true,
    canManageCustomers: true,
    canViewAnalytics: true,
    canManageContent: true,
  },
  partner: {
    canCreateReferrals: true,
    canViewReferralStats: true,
    canManageProfile: true,
  },
  customer: {
    canCreateOrders: true,
    canViewOrderHistory: true,
    canManagePets: true,
  },
};

export function hasPermission(userProfile: UserProfile, permission: keyof UserPermissions): boolean {
  const defaultPerms = DEFAULT_PERMISSIONS[userProfile.user_type];
  return defaultPerms[permission] === true;
}

export function getUserDisplayName(userProfile: UserProfile): string {
  if (userProfile.first_name && userProfile.last_name) {
    return `${userProfile.first_name} ${userProfile.last_name}`;
  }
  if (userProfile.first_name) {
    return userProfile.first_name;
  }
  if (userProfile.email) {
    return userProfile.email;
  }
  return 'User';
}

export function getUserTypeDisplayName(userType: UserType): string {
  switch (userType) {
    case 'admin':
      return 'Administrator';
    case 'partner':
      return 'Partner';
    case 'customer':
      return 'Customer';
    default:
      return 'User';
  }
}