'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';

interface SecureImageDisplayProps {
  imageId: string;
  variant: 'original' | 'download' | 'full_size' | 'thumbnail' | 'mid_size' | 'social_media_post';
  userId?: string;
  orderId?: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallbackUrl?: string;
}

export function SecureImageDisplay({ 
  imageId, 
  variant, 
  userId, 
  orderId, 
  alt, 
  width = 400,
  height = 500,
  className = '',
  fallbackUrl
}: SecureImageDisplayProps) {
  
  const [imageUrl, setImageUrl] = useState<string>('');
  const [socialUrls, setSocialUrls] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function fetchImageVariant() {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams({
          variant,
          ...(userId && { userId }),
          ...(orderId && { orderId })
        });

        const response = await fetch(`/api/images/${imageId}?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load image variant');
        }

        if (variant === 'social_media_post') {
          setSocialUrls(data.urls);
          setImageUrl(data.urls.instagram_post); // Default to Instagram format
        } else {
          setImageUrl(data.url);
        }

      } catch (err) {
        console.error('Error loading image variant:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        
        // Use fallback URL if provided
        if (fallbackUrl) {
          setImageUrl(fallbackUrl);
          setError('');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchImageVariant();
  }, [imageId, variant, userId, orderId, fallbackUrl]);

  if (loading) {
    return (
      <div 
        className={`bg-gray-200 animate-pulse rounded-lg flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !imageUrl) {
    return (
      <div 
        className={`bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center justify-center text-sm ${className}`}
        style={{ width, height }}
      >
        {error}
      </div>
    );
  }

  // For social media variants, show format selector
  if (variant === 'social_media_post' && socialUrls) {
    return (
      <div className={className}>
        <div className="mb-4">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setImageUrl(socialUrls.instagram_post)}
              className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              Instagram Post
            </button>
            <button
              onClick={() => setImageUrl(socialUrls.instagram_story)}
              className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              Instagram Story
            </button>
            <button
              onClick={() => setImageUrl(socialUrls.facebook_post)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Facebook
            </button>
            <button
              onClick={() => setImageUrl(socialUrls.twitter_card)}
              className="px-3 py-1 text-xs bg-sky-100 text-sky-700 rounded hover:bg-sky-200"
            >
              Twitter
            </button>
          </div>
        </div>
        <Image
          src={imageUrl}
          alt={alt}
          width={width}
          height={height}
          className="rounded-lg shadow-md"
        />
      </div>
    );
  }

  return (
    <Image
      src={imageUrl}
      alt={alt}
      width={width}
      height={height}
      className={`rounded-lg shadow-md ${className}`}
    />
  );
}

// Convenience components for common use cases
export function ThumbnailImage({ imageId, alt, className = '' }: { imageId: string; alt: string; className?: string }) {
  return (
    <SecureImageDisplay
      imageId={imageId}
      variant="thumbnail"
      alt={alt}
      width={150}
      height={150}
      className={className}
    />
  );
}

export function CardImage({ imageId, alt, className = '' }: { imageId: string; alt: string; className?: string }) {
  return (
    <SecureImageDisplay
      imageId={imageId}
      variant="mid_size"
      alt={alt}
      width={400}
      height={500}
      className={className}
    />
  );
}

export function DetailImage({ imageId, alt, className = '' }: { imageId: string; alt: string; className?: string }) {
  return (
    <SecureImageDisplay
      imageId={imageId}
      variant="full_size"
      alt={alt}
      width={1200}
      height={1500}
      className={className}
    />
  );
}

export function PurchasedDownload({ 
  imageId, 
  alt, 
  userId, 
  orderId, 
  className = '' 
}: { 
  imageId: string; 
  alt: string; 
  userId: string; 
  orderId: string; 
  className?: string;
}) {
  return (
    <SecureImageDisplay
      imageId={imageId}
      variant="download"
      userId={userId}
      orderId={orderId}
      alt={alt}
      className={className}
    />
  );
}

export function SocialMediaShare({ 
  imageId, 
  alt, 
  userId, 
  orderId, 
  className = '' 
}: { 
  imageId: string; 
  alt: string; 
  userId: string; 
  orderId: string; 
  className?: string;
}) {
  return (
    <SecureImageDisplay
      imageId={imageId}
      variant="social_media_post"
      userId={userId}
      orderId={orderId}
      alt={alt}
      className={className}
    />
  );
}