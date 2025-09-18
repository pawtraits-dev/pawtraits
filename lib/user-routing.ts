import { UserProfile, UserType } from './user-types';

/**
 * Get the appropriate home route based on user type
 */
export function getUserHomeRoute(userType: UserType | null): string {
  switch (userType) {
    case 'admin':
      return '/admin';
    case 'partner':
      return '/partners';
    case 'customer':
      return '/customer';
    default:
      return '/'; // Landing page for unauthenticated users
  }
}

/**
 * Get the appropriate "continue shopping" route based on user type
 * For shopping flows, users should go to their appropriate shopping area
 */
export function getContinueShoppingRoute(userType: UserType | null): string {
  switch (userType) {
    case 'admin':
      return '/catalog'; // Admin can use the main catalog for shopping
    case 'partner':
      return '/browse'; // Partners now use the unified browse page
    case 'customer':
      return '/browse'; // Customers use the main browse page for shopping
    default:
      return '/browse'; // Unauthenticated users go to public browse page
  }
}

/**
 * Get route based on user profile
 */
export function getUserHomeRouteFromProfile(userProfile: UserProfile | null): string {
  return getUserHomeRoute(userProfile?.user_type || null);
}

/**
 * Get continue shopping route based on user profile
 */
export function getContinueShoppingRouteFromProfile(userProfile: UserProfile | null): string {
  return getContinueShoppingRoute(userProfile?.user_type || null);
}