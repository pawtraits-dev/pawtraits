'use client';

import React from 'react';
import Image from 'next/image';
import { Heart, Share2, Eye, TrendingUp } from 'lucide-react';
import { useInteractions } from '@/hooks/use-interactions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface InteractiveImageCardProps {
  imageId: string;
  imageUrl: string;
  filename: string;
  description?: string;
  breedName?: string;
  initialLiked?: boolean;
  className?: string;
}

export function InteractiveImageCard({
  imageId,
  imageUrl,
  filename,
  description,
  breedName,
  initialLiked = false,
  className = ''
}: InteractiveImageCardProps) {
  const {
    liked,
    likeCount,
    viewCount,
    shareCount,
    isLiking,
    toggleLike,
    recordShare,
    recordView,
    analytics,
    error
  } = useInteractions(imageId, initialLiked);

  // Record view when component mounts
  React.useEffect(() => {
    recordView();
  }, [recordView]);

  const handleShare = async (platform: string) => {
    try {
      await recordShare(platform);
      
      // Actually perform the share (this would integrate with Web Share API or social platforms)
      if (navigator.share) {
        await navigator.share({
          title: `Beautiful ${breedName} Portrait`,
          text: description || `Check out this amazing ${breedName} portrait!`,
          url: window.location.href
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  return (
    <Card className={`group hover:shadow-lg transition-shadow duration-200 ${className}`}>
      <CardContent className="p-0">
        {/* Image container with view tracking */}
        <div 
          className="relative aspect-square overflow-hidden rounded-t-lg"
          data-image-id={imageId}
        >
          <Image
            src={imageUrl}
            alt={filename}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          
          {/* Overlay with breed info */}
          {breedName && (
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="bg-black/70 text-white">
                {breedName}
              </Badge>
            </div>
          )}
          
          {/* View count overlay */}
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 text-white px-2 py-1 rounded text-xs">
            <Eye className="w-3 h-3" />
            {viewCount}
          </div>
        </div>

        {/* Description */}
        {description && (
          <div className="p-4 pb-2">
            <p className="text-sm text-gray-600 line-clamp-2">
              {description}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between p-4 pt-2">
        {/* Interaction buttons */}
        <div className="flex items-center gap-3">
          {/* Like button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLike}
            disabled={isLiking}
            className={`flex items-center gap-1 ${
              liked ? 'text-red-500 hover:text-red-600' : 'text-gray-500 hover:text-red-500'
            }`}
          >
            <Heart
              className={`w-4 h-4 ${
                liked ? 'fill-current' : ''
              } ${isLiking ? 'animate-pulse' : ''}`}
            />
            <span className="text-xs font-medium">{likeCount}</span>
          </Button>

          {/* Share button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleShare('web_share')}
            className="flex items-center gap-1 text-gray-500 hover:text-blue-500"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs font-medium">{shareCount}</span>
          </Button>

          {/* Analytics indicator */}
          {analytics && analytics.detailed_unique_users > 1 && (
            <div className="flex items-center gap-1 text-gray-400">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs">{analytics.detailed_unique_users} users</span>
            </div>
          )}
        </div>

        {/* Error indicator */}
        {error && (
          <div className="text-xs text-red-500 max-w-32 truncate" title={error}>
            Error: {error}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

// Simplified version for minimal usage
export function SimpleInteractiveImage({ 
  imageId, 
  imageUrl, 
  alt 
}: { 
  imageId: string; 
  imageUrl: string; 
  alt: string; 
}) {
  const { liked, likeCount, toggleLike, isLiking, recordView } = useInteractions(imageId);

  React.useEffect(() => {
    recordView();
  }, [recordView]);

  return (
    <div className="relative group">
      <div data-image-id={imageId}>
        <Image
          src={imageUrl}
          alt={alt}
          width={300}
          height={300}
          className="rounded-lg object-cover"
        />
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLike}
        disabled={isLiking}
        className={`absolute bottom-2 right-2 ${
          liked ? 'text-red-500' : 'text-white'
        } bg-black/50 hover:bg-black/70`}
      >
        <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
        {likeCount > 0 && <span className="ml-1">{likeCount}</span>}
      </Button>
    </div>
  );
}

export default InteractiveImageCard;