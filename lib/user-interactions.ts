'use client';

import { trackLike, trackUnlike, trackShare, getInteractionStats, addPendingInteraction, type InteractionStats } from './interactions';

export interface UserInteraction {
  imageId: string;
  type: 'liked' | 'shared' | 'purchased';
  timestamp: string;
  imageData?: {
    id: string;
    filename: string;
    public_url: string;
    prompt_text: string;
    description: string;
    tags: string[];
    breed_id?: string;
    theme_id?: string;
    style_id?: string;
    format_id?: string;
    rating?: number;
    is_featured: boolean;
    created_at: string;
    breed?: {
      id: string;
      name: string;
    };
    theme?: {
      id: string;
      name: string;
    };
    style?: {
      id: string;
      name: string;
    };
  };
  platform?: string; // For shared images
  orderId?: string; // For purchased images
}

class UserInteractionsService {
  private static readonly STORAGE_KEY_PREFIX = 'pawtraits_user_interactions';

  // Get user-specific storage key
  private static getUserStorageKey(): string {
    // Try to get user ID from various sources
    let userId = 'anonymous';
    
    try {
      // First try to get from session storage (set during auth)
      const sessionUserId = sessionStorage.getItem('current_user_id');
      if (sessionUserId) {
        userId = sessionUserId;
      } else {
        // Try to get from Supabase auth token in localStorage
        const keys = Object.keys(localStorage);
        const authKey = keys.find(key => key.startsWith('sb-') && key.includes('auth-token'));
        if (authKey) {
          const authData = JSON.parse(localStorage.getItem(authKey) || '{}');
          if (authData?.user?.id) {
            userId = authData.user.id;
            // Cache it for next time
            this.setCurrentUserId(userId);
          }
        }
      }
    } catch (error) {
      console.warn('Could not determine user ID, using anonymous storage');
    }

    return `${this.STORAGE_KEY_PREFIX}_${userId}`;
  }

  // Get all interactions for current user
  static getInteractions(): UserInteraction[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const storageKey = this.getUserStorageKey();
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading user interactions:', error);
      return [];
    }
  }

  // Save interactions for current user
  private static saveInteractions(interactions: UserInteraction[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      const storageKey = this.getUserStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(interactions));
    } catch (error) {
      console.error('Error saving user interactions:', error);
    }
  }

  // Set current user ID (called during auth)
  static setCurrentUserId(userId: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      sessionStorage.setItem('current_user_id', userId);
    } catch (error) {
      console.warn('Could not store user ID in session storage');
    }
  }

  // Clear current user data (called during logout)
  static clearCurrentUser(): void {
    if (typeof window === 'undefined') return;
    
    try {
      sessionStorage.removeItem('current_user_id');
    } catch (error) {
      console.warn('Could not clear user ID from session storage');
    }
  }

  // Migrate old global interactions to user-specific storage (one-time migration)
  static migrateOldInteractions(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const oldKey = 'pawtraits_user_interactions';
      const oldData = localStorage.getItem(oldKey);
      
      if (oldData && !localStorage.getItem('interactions_migrated')) {
        const currentUserKey = this.getUserStorageKey();
        
        // Only migrate if current user storage is empty
        if (!localStorage.getItem(currentUserKey)) {
          localStorage.setItem(currentUserKey, oldData);
          console.log('Migrated old interaction data to user-specific storage');
        }
        
        // Mark as migrated to prevent future migrations
        localStorage.setItem('interactions_migrated', 'true');
        
        // Optionally clean up old data
        localStorage.removeItem(oldKey);
      }
    } catch (error) {
      console.warn('Could not migrate old interaction data:', error);
    }
  }

  // Add a new interaction
  static addInteraction(interaction: Omit<UserInteraction, 'timestamp'>): void {
    const interactions = this.getInteractions();
    
    // Check if this interaction already exists
    const existingIndex = interactions.findIndex(
      i => i.imageId === interaction.imageId && i.type === interaction.type
    );

    const newInteraction: UserInteraction = {
      ...interaction,
      timestamp: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      // Update existing interaction
      interactions[existingIndex] = newInteraction;
    } else {
      // Add new interaction
      interactions.push(newInteraction);
    }

    this.saveInteractions(interactions);
  }

  // Remove an interaction
  static removeInteraction(imageId: string, type: 'liked' | 'shared' | 'purchased'): void {
    const interactions = this.getInteractions();
    const filtered = interactions.filter(
      i => !(i.imageId === imageId && i.type === type)
    );
    this.saveInteractions(filtered);
  }

  // Get interactions by type
  static getInteractionsByType(type: 'liked' | 'shared' | 'purchased'): UserInteraction[] {
    return this.getInteractions().filter(i => i.type === type);
  }

  // Check if an image has a specific interaction
  static hasInteraction(imageId: string, type: 'liked' | 'shared' | 'purchased'): boolean {
    const interactions = this.getInteractions();
    return interactions.some(i => i.imageId === imageId && i.type === type);
  }

  // Get liked image IDs
  static getLikedImageIds(): Set<string> {
    const likedInteractions = this.getInteractionsByType('liked');
    return new Set(likedInteractions.map(i => i.imageId));
  }

  // Get shared image IDs
  static getSharedImageIds(): Set<string> {
    const sharedInteractions = this.getInteractionsByType('shared');
    return new Set(sharedInteractions.map(i => i.imageId));
  }

  // Get purchased image IDs
  static getPurchasedImageIds(): Set<string> {
    const purchasedInteractions = this.getInteractionsByType('purchased');
    return new Set(purchasedInteractions.map(i => i.imageId));
  }

  // Toggle like with server-side tracking
  static async toggleLike(imageId: string, imageData?: any): Promise<boolean> {
    const isLiked = this.hasInteraction(imageId, 'liked');
    
    if (isLiked) {
      // Unlike the image
      this.removeInteraction(imageId, 'liked');
      
      // Track server-side (async, don't block UI)
      trackUnlike(imageId, { imageData }).catch(error => {
        console.warn('Failed to track unlike on server:', error);
        // Add to pending queue for retry
        addPendingInteraction({
          imageId,
          interactionType: 'unlike',
          metadata: { imageData }
        });
      });
      
      return false;
    } else {
      // Like the image
      this.addInteraction({
        imageId,
        type: 'liked',
        imageData
      });
      
      // Track server-side (async, don't block UI)
      trackLike(imageId, { imageData }).catch(error => {
        console.warn('Failed to track like on server:', error);
        // Add to pending queue for retry
        addPendingInteraction({
          imageId,
          interactionType: 'like',
          metadata: { imageData }
        });
      });
      
      return true;
    }
  }

  // Synchronous version for backward compatibility
  static toggleLikeSync(imageId: string, imageData?: any): boolean {
    const isLiked = this.hasInteraction(imageId, 'liked');
    
    if (isLiked) {
      this.removeInteraction(imageId, 'liked');
      // Track server-side asynchronously
      trackUnlike(imageId, { imageData }).catch(error => {
        console.warn('Failed to track unlike on server:', error);
        addPendingInteraction({
          imageId,
          interactionType: 'unlike',
          metadata: { imageData }
        });
      });
      return false;
    } else {
      this.addInteraction({
        imageId,
        type: 'liked',
        imageData
      });
      // Track server-side asynchronously
      trackLike(imageId, { imageData }).catch(error => {
        console.warn('Failed to track like on server:', error);
        addPendingInteraction({
          imageId,
          interactionType: 'like',
          metadata: { imageData }
        });
      });
      return true;
    }
  }

  // Record share with server-side tracking
  static recordShare(imageId: string, platform: string, imageData?: any): void {
    // Update local storage immediately
    this.addInteraction({
      imageId,
      type: 'shared',
      platform,
      imageData
    });
    
    // Track server-side asynchronously
    trackShare(imageId, platform, { imageData, platform }).catch(error => {
      console.warn('Failed to track share on server:', error);
      // Add to pending queue for retry
      addPendingInteraction({
        imageId,
        interactionType: 'share',
        platform,
        metadata: { imageData, platform }
      });
    });
  }

  // Record purchase
  static recordPurchase(imageId: string, orderId: string, imageData?: any): void {
    this.addInteraction({
      imageId,
      type: 'purchased',
      orderId,
      imageData
    });
  }

  // Record purchase from order completion (when an order is completed)
  static recordPurchaseFromOrder(orderItems: Array<{imageId: string, imageData?: any}>, orderId: string): void {
    orderItems.forEach(item => {
      this.recordPurchase(item.imageId, orderId, item.imageData);
    });
  }

  // Get all interactions for gallery display
  static getGalleryImages(): Array<UserInteraction & {
    interaction_type: 'liked' | 'shared' | 'purchased';
    interaction_date: string;
  }> {
    const interactions = this.getInteractions();
    
    return interactions
      .filter(i => i.imageData) // Only include interactions with image data
      .map(i => ({
        ...i,
        interaction_type: i.type,
        interaction_date: i.timestamp,
        ...i.imageData // Spread the image data to match the gallery interface
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Get server-side interaction stats for an image
  static async getServerStats(imageId: string): Promise<InteractionStats | null> {
    try {
      return await getInteractionStats(imageId);
    } catch (error) {
      console.warn('Failed to fetch server-side stats:', error);
      return null;
    }
  }

  // Sync local data with server (useful for analytics)
  static async syncWithServer(): Promise<boolean> {
    try {
      const interactions = this.getInteractions();
      console.log('Syncing', interactions.length, 'interactions with server...');
      
      // This could be expanded to push local data to server if needed
      // For now, we just ensure pending interactions are synced
      const { syncPendingInteractions } = await import('./interactions');
      return await syncPendingInteractions();
    } catch (error) {
      console.error('Failed to sync with server:', error);
      return false;
    }
  }

  // Enhanced version that combines local and server-side data
  static async getCombinedStats(imageId: string): Promise<{
    localLiked: boolean;
    localShared: boolean;
    serverStats: InteractionStats | null;
  }> {
    const localLiked = this.hasInteraction(imageId, 'liked');
    const localShared = this.hasInteraction(imageId, 'shared');
    const serverStats = await this.getServerStats(imageId);
    
    return {
      localLiked,
      localShared,
      serverStats
    };
  }
}

export default UserInteractionsService;