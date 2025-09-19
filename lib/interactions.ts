// Client-side interaction tracking utilities

// Generate a session ID for anonymous users
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = localStorage.getItem('pawtraits_session_id');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('pawtraits_session_id', sessionId);
  }
  return sessionId;
}

export interface InteractionData {
  imageId: string;
  interactionType: 'like' | 'share' | 'unlike' | 'view';
  platform?: string; // Required for shares
  metadata?: Record<string, any>;
}

export interface InteractionStats {
  like_count: number;
  share_count: number;
  view_count: number;
  unique_users: number;
  platforms?: Array<{
    platform: string;
    share_count: number;
    last_shared_at: string;
  }>;
}

// Track a single interaction
export async function trackInteraction(data: InteractionData): Promise<{
  success: boolean;
  stats?: InteractionStats;
  error?: string;
}> {
  try {
    // Use cookie-based authentication - no need for manual headers
    const response = await fetch('/api/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify({
        ...data,
        metadata: {
          ...data.metadata,
          sessionId: getSessionId(),
          timestamp: new Date().toISOString(),
          url: typeof window !== 'undefined' ? window.location.href : undefined
        }
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Interaction tracking failed:', result.error);
      return { success: false, error: result.error };
    }

    return { success: true, stats: result.stats };
  } catch (error) {
    console.error('Error tracking interaction:', error);
    return { success: false, error: 'Network error' };
  }
}

// Track multiple interactions in batch
export async function trackInteractionsBatch(interactions: InteractionData[]): Promise<{
  success: boolean;
  processed: number;
  total: number;
  updatedStats?: Record<string, InteractionStats>;
  error?: string;
}> {
  try {
    const sessionId = getSessionId();
    const timestamp = new Date().toISOString();
    const url = typeof window !== 'undefined' ? window.location.href : undefined;

    const processedInteractions = interactions.map(interaction => ({
      ...interaction,
      sessionId,
      metadata: {
        ...interaction.metadata,
        timestamp,
        url
      }
    }));

    const response = await fetch('/api/interactions/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify({ interactions: processedInteractions }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Batch interaction tracking failed:', result.error);
      return { 
        success: false, 
        processed: result.processed || 0,
        total: result.total || interactions.length,
        error: result.error 
      };
    }

    return { 
      success: true, 
      processed: result.processed,
      total: result.total,
      updatedStats: result.updatedStats
    };
  } catch (error) {
    console.error('Error tracking batch interactions:', error);
    return { 
      success: false, 
      processed: 0,
      total: interactions.length,
      error: 'Network error' 
    };
  }
}

// Get interaction stats for an image
export async function getInteractionStats(imageId: string): Promise<InteractionStats | null> {
  try {
    const response = await fetch(`/api/interactions?imageId=${encodeURIComponent(imageId)}`);
    
    if (!response.ok) {
      console.error('Failed to fetch interaction stats');
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching interaction stats:', error);
    return null;
  }
}

// Utility functions for common interactions

export function trackLike(imageId: string, metadata?: Record<string, any>) {
  return trackInteraction({
    imageId,
    interactionType: 'like',
    metadata
  });
}

export function trackUnlike(imageId: string, metadata?: Record<string, any>) {
  return trackInteraction({
    imageId,
    interactionType: 'unlike',
    metadata
  });
}

export function trackShare(imageId: string, platform: string, metadata?: Record<string, any>) {
  return trackInteraction({
    imageId,
    interactionType: 'share',
    platform,
    metadata
  });
}

export function trackView(imageId: string, metadata?: Record<string, any>) {
  return trackInteraction({
    imageId,
    interactionType: 'view',
    metadata
  });
}

// Hook for React components
export function useInteractionTracking() {
  const sessionId = getSessionId();

  return {
    trackLike: (imageId: string, metadata?: Record<string, any>) => 
      trackLike(imageId, { ...metadata, sessionId }),
    
    trackUnlike: (imageId: string, metadata?: Record<string, any>) => 
      trackUnlike(imageId, { ...metadata, sessionId }),
    
    trackShare: (imageId: string, platform: string, metadata?: Record<string, any>) => 
      trackShare(imageId, platform, { ...metadata, sessionId }),
    
    trackView: (imageId: string, metadata?: Record<string, any>) => 
      trackView(imageId, { ...metadata, sessionId }),
    
    trackBatch: (interactions: InteractionData[]) => 
      trackInteractionsBatch(interactions),
    
    getStats: (imageId: string) => 
      getInteractionStats(imageId),
    
    sessionId
  };
}

// Debounced view tracking to avoid spam
const viewTrackingCache = new Set<string>();
const VIEW_TRACKING_DEBOUNCE = 5000; // 5 seconds

export function trackViewDebounced(imageId: string, metadata?: Record<string, any>) {
  const cacheKey = `${imageId}-${Date.now() - (Date.now() % VIEW_TRACKING_DEBOUNCE)}`;
  
  if (viewTrackingCache.has(cacheKey)) {
    return Promise.resolve({ success: true, cached: true });
  }
  
  viewTrackingCache.add(cacheKey);
  
  // Clean up old cache entries
  setTimeout(() => {
    viewTrackingCache.delete(cacheKey);
  }, VIEW_TRACKING_DEBOUNCE);
  
  return trackView(imageId, metadata);
}

// Persistence layer for offline support
interface PendingInteraction extends InteractionData {
  timestamp: string;
  sessionId: string;
}

const PENDING_INTERACTIONS_KEY = 'pawtraits_pending_interactions';

export function addPendingInteraction(interaction: InteractionData) {
  if (typeof window === 'undefined') return;
  
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_INTERACTIONS_KEY) || '[]');
    pending.push({
      ...interaction,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId()
    });
    localStorage.setItem(PENDING_INTERACTIONS_KEY, JSON.stringify(pending));
  } catch (error) {
    console.error('Error saving pending interaction:', error);
  }
}

export async function syncPendingInteractions(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_INTERACTIONS_KEY) || '[]');
    
    if (pending.length === 0) return true;
    
    const result = await trackInteractionsBatch(pending);
    
    if (result.success) {
      localStorage.removeItem(PENDING_INTERACTIONS_KEY);
      console.log(`Synced ${result.processed} pending interactions`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error syncing pending interactions:', error);
    return false;
  }
}

// Auto-sync on page load and visibility change
if (typeof window !== 'undefined') {
  // Sync on page load
  window.addEventListener('load', syncPendingInteractions);
  
  // Sync when page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncPendingInteractions();
    }
  });
  
  // Sync on online event
  window.addEventListener('online', syncPendingInteractions);
}