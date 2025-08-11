// Client-side service for tracking user interactions
// Integrates with the server-side user interactions system

export interface InteractionMetadata {
  [key: string]: any;
}

export interface InteractionResponse {
  success: boolean;
  interactionId?: string;
  updatedCounts?: {
    like_count: number;
    view_count: number;
    share_count: number;
  };
  error?: string;
}

export interface InteractionAnalytics {
  // Basic image data
  id: string;
  original_filename: string;
  public_url: string;
  description?: string;
  
  // Legacy share tracking (from existing system)
  legacy_share_count: number;
  legacy_last_shared_at?: string;
  
  // Current interaction counts (stored directly in image_catalog)
  current_like_count: number;
  current_view_count: number;
  current_last_liked_at?: string;
  current_last_viewed_at?: string;
  
  // Detailed analytics (from interaction_analytics table)
  detailed_total_likes: number;
  detailed_total_unlikes: number;
  detailed_net_likes: number;
  detailed_total_shares: number;
  detailed_total_views: number;
  detailed_unique_users: number;
  detailed_unique_likers: number;
  detailed_unique_sharers: number;
  detailed_unique_viewers: number;
  detailed_first_interaction_at?: string;
  detailed_last_interaction_at?: string;
  
  // Related data
  breed_name?: string;
  theme_name?: string;
  style_name?: string;
}

export interface PlatformAnalytics {
  platform: string;
  total_platform_shares: number;
  unique_platform_sharers: number;
  first_shared_at?: string;
  last_shared_at?: string;
}

class InteractionService {
  private baseUrl = '/api/interactions';
  private sessionId: string | null = null;

  constructor() {
    // Session ID will be initialized when needed (client-side only)
  }

  private getOrGenerateSessionId(): string {
    // Handle SSR - only access localStorage on client side
    if (typeof window === 'undefined') {
      return `ssr_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }

    if (this.sessionId) {
      return this.sessionId;
    }

    const storageKey = 'pawtraits_session_id';
    let sessionId = localStorage.getItem(storageKey);
    
    if (!sessionId) {
      sessionId = `anon_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      localStorage.setItem(storageKey, sessionId);
    }
    
    this.sessionId = sessionId;
    return sessionId;
  }

  /**
   * Record a user interaction (like, unlike, share, view)
   */
  async recordInteraction(
    imageId: string,
    interactionType: 'like' | 'unlike' | 'share' | 'view',
    platform?: string,
    metadata?: InteractionMetadata
  ): Promise<InteractionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageId,
          interactionType,
          platform,
          sessionId: this.getOrGenerateSessionId(),
          metadata: {
            ...metadata,
            sessionId: this.getOrGenerateSessionId()
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to record interaction'
        };
      }

      return await response.json();
    } catch (error) {
      console.error('Error recording interaction:', error);
      return {
        success: false,
        error: 'Network error'
      };
    }
  }

  /**
   * Record a like interaction
   */
  async recordLike(imageId: string, metadata?: InteractionMetadata): Promise<InteractionResponse> {
    return this.recordInteraction(imageId, 'like', undefined, metadata);
  }

  /**
   * Record an unlike interaction
   */
  async recordUnlike(imageId: string, metadata?: InteractionMetadata): Promise<InteractionResponse> {
    return this.recordInteraction(imageId, 'unlike', undefined, metadata);
  }

  /**
   * Record a share interaction
   */
  async recordShare(
    imageId: string, 
    platform: string, 
    metadata?: InteractionMetadata
  ): Promise<InteractionResponse> {
    return this.recordInteraction(imageId, 'share', platform, metadata);
  }

  /**
   * Record a view interaction
   */
  async recordView(imageId: string, metadata?: InteractionMetadata): Promise<InteractionResponse> {
    return this.recordInteraction(imageId, 'view', undefined, metadata);
  }

  /**
   * Get comprehensive analytics for an image
   */
  async getImageAnalytics(imageId: string): Promise<{
    success: boolean;
    analytics?: InteractionAnalytics;
    platformBreakdown?: PlatformAnalytics[];
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/record?imageId=${encodeURIComponent(imageId)}`);

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to fetch analytics'
        };
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return {
        success: false,
        error: 'Network error'
      };
    }
  }

  /**
   * Toggle like status for an image
   * Returns the new like status (true if liked, false if unliked)
   */
  async toggleLike(imageId: string, currentlyLiked: boolean): Promise<{
    success: boolean;
    liked: boolean;
    updatedCounts?: InteractionResponse['updatedCounts'];
    error?: string;
  }> {
    const interactionType = currentlyLiked ? 'unlike' : 'like';
    const result = await this.recordInteraction(imageId, interactionType);

    if (result.success) {
      return {
        success: true,
        liked: !currentlyLiked,
        updatedCounts: result.updatedCounts
      };
    }

    return {
      success: false,
      liked: currentlyLiked, // Keep current state on error
      error: result.error
    };
  }

  /**
   * Record a view when an image comes into viewport
   * Debounced to prevent excessive API calls
   */
  private viewTimeouts = new Map<string, NodeJS.Timeout>();

  recordViewDebounced(imageId: string, debounceMs: number = 2000): void {
    // Clear existing timeout for this image
    const existingTimeout = this.viewTimeouts.get(imageId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.recordView(imageId);
      this.viewTimeouts.delete(imageId);
    }, debounceMs);

    this.viewTimeouts.set(imageId, timeout);
  }

  /**
   * Setup intersection observer for automatic view tracking
   */
  setupViewTracking(
    selector: string = '[data-image-id]',
    options: IntersectionObserverInit = { threshold: 0.5 }
  ): IntersectionObserver {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const imageId = (entry.target as HTMLElement).dataset.imageId;
          if (imageId) {
            this.recordViewDebounced(imageId);
          }
        }
      });
    }, options);

    // Observe existing elements
    document.querySelectorAll(selector).forEach((element) => {
      observer.observe(element);
    });

    return observer;
  }

  /**
   * Clear session data (useful for testing or user logout)
   */
  clearSession(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pawtraits_session_id');
    }
    this.sessionId = null;
  }
}

// Export a singleton instance
export const interactionService = new InteractionService();

// Export the class for custom instances if needed
export default InteractionService;