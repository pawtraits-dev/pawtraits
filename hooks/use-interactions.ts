'use client';

import { useState, useEffect, useCallback } from 'react';
import { interactionService, InteractionAnalytics, PlatformAnalytics } from '@/lib/interaction-service';

export interface UseInteractionsReturn {
  // Current state
  liked: boolean;
  likeCount: number;
  viewCount: number;
  shareCount: number;
  
  // Loading states
  isLiking: boolean;
  isLoading: boolean;
  
  // Actions
  toggleLike: () => Promise<void>;
  recordShare: (platform: string) => Promise<void>;
  recordView: () => Promise<void>;
  
  // Analytics
  analytics: InteractionAnalytics | null;
  platformBreakdown: PlatformAnalytics[];
  refreshAnalytics: () => Promise<void>;
  
  // Error state
  error: string | null;
}

export function useInteractions(imageId: string, initialLiked: boolean = false): UseInteractionsReturn {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<InteractionAnalytics | null>(null);
  const [platformBreakdown, setPlatformBreakdown] = useState<PlatformAnalytics[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load initial analytics
  const loadAnalytics = useCallback(async () => {
    if (!imageId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await interactionService.getImageAnalytics(imageId);
      
      if (result.success && result.analytics) {
        const analyticsData = result.analytics;
        setAnalytics(analyticsData);
        setPlatformBreakdown(result.platformBreakdown || []);
        
        // Update counts from analytics
        setLikeCount(analyticsData.current_like_count || 0);
        setViewCount(analyticsData.current_view_count || 0);
        setShareCount(analyticsData.legacy_share_count || 0);
      } else {
        setError(result.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError('Network error loading analytics');
      console.error('Error loading analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [imageId]);

  // Load analytics on mount and when imageId changes
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Toggle like functionality
  const toggleLike = useCallback(async () => {
    if (!imageId || isLiking) return;
    
    setIsLiking(true);
    setError(null);
    
    try {
      const result = await interactionService.toggleLike(imageId, liked);
      
      if (result.success) {
        setLiked(result.liked);
        
        // Update counts if provided
        if (result.updatedCounts) {
          setLikeCount(result.updatedCounts.like_count);
          setViewCount(result.updatedCounts.view_count);
          setShareCount(result.updatedCounts.share_count);
        }
        
        // Refresh full analytics
        setTimeout(() => loadAnalytics(), 500);
      } else {
        setError(result.error || 'Failed to toggle like');
      }
    } catch (err) {
      setError('Network error toggling like');
      console.error('Error toggling like:', err);
    } finally {
      setIsLiking(false);
    }
  }, [imageId, liked, isLiking, loadAnalytics]);

  // Record share
  const recordShare = useCallback(async (platform: string) => {
    if (!imageId) return;
    
    setError(null);
    
    try {
      const result = await interactionService.recordShare(imageId, platform);
      
      if (result.success) {
        // Update counts if provided
        if (result.updatedCounts) {
          setLikeCount(result.updatedCounts.like_count);
          setViewCount(result.updatedCounts.view_count);
          setShareCount(result.updatedCounts.share_count);
        }
        
        // Refresh analytics to get updated platform breakdown
        setTimeout(() => loadAnalytics(), 500);
      } else {
        setError(result.error || 'Failed to record share');
      }
    } catch (err) {
      setError('Network error recording share');
      console.error('Error recording share:', err);
    }
  }, [imageId, loadAnalytics]);

  // Record view
  const recordView = useCallback(async () => {
    if (!imageId) return;
    
    try {
      const result = await interactionService.recordView(imageId);
      
      if (result.success && result.updatedCounts) {
        setLikeCount(result.updatedCounts.like_count);
        setViewCount(result.updatedCounts.view_count);
        setShareCount(result.updatedCounts.share_count);
      }
    } catch (err) {
      console.error('Error recording view:', err);
      // Don't set error state for views since they're automatic
    }
  }, [imageId]);

  // Refresh analytics
  const refreshAnalytics = useCallback(async () => {
    await loadAnalytics();
  }, [loadAnalytics]);

  return {
    // Current state
    liked,
    likeCount,
    viewCount,
    shareCount,
    
    // Loading states
    isLiking,
    isLoading,
    
    // Actions
    toggleLike,
    recordShare,
    recordView,
    
    // Analytics
    analytics,
    platformBreakdown,
    refreshAnalytics,
    
    // Error state
    error
  };
}

// Hook for automatic view tracking when component is in viewport
export function useViewTracking(imageId: string, options?: IntersectionObserverInit) {
  const [hasRecordedView, setHasRecordedView] = useState(false);

  useEffect(() => {
    if (!imageId || hasRecordedView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasRecordedView) {
            interactionService.recordView(imageId);
            setHasRecordedView(true);
          }
        });
      },
      { threshold: 0.5, ...options }
    );

    // Find elements with data-image-id attribute
    const elements = document.querySelectorAll(`[data-image-id="${imageId}"]`);
    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [imageId, hasRecordedView, options]);

  return { hasRecordedView };
}

// Hook for managing like state with optimistic updates
export function useLikeButton(imageId: string, initialLiked: boolean = false) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial like count
  useEffect(() => {
    if (!imageId) return;
    
    interactionService.getImageAnalytics(imageId).then((result) => {
      if (result.success && result.analytics) {
        setLikeCount(result.analytics.current_like_count || 0);
      }
    });
  }, [imageId]);

  const toggleLike = useCallback(async () => {
    if (!imageId || isLiking) return;
    
    // Optimistic update
    const previousLiked = liked;
    const previousCount = likeCount;
    
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    setIsLiking(true);
    setError(null);
    
    try {
      const result = await interactionService.toggleLike(imageId, previousLiked);
      
      if (result.success) {
        setLiked(result.liked);
        if (result.updatedCounts) {
          setLikeCount(result.updatedCounts.like_count);
        }
      } else {
        // Revert optimistic update on error
        setLiked(previousLiked);
        setLikeCount(previousCount);
        setError(result.error || 'Failed to toggle like');
      }
    } catch (err) {
      // Revert optimistic update on error
      setLiked(previousLiked);
      setLikeCount(previousCount);
      setError('Network error');
      console.error('Error toggling like:', err);
    } finally {
      setIsLiking(false);
    }
  }, [imageId, liked, likeCount, isLiking]);

  return {
    liked,
    likeCount,
    isLiking,
    error,
    toggleLike
  };
}