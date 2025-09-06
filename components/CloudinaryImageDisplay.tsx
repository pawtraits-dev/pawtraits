'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { PawSpinner } from '@/components/ui/paw-spinner';

interface CloudinaryImageDisplayProps {
  imageId: string;
  variant?: 'catalog_watermarked' | 'social' | 'print_quality' | 'qr_overlay' | 'full_size' | 'thumbnail' | 'mid_size' | 'purchased';
  userId?: string;
  orderId?: string;
  className?: string;
  alt?: string;
  fallbackUrl?: string;
  onError?: (error: string) => void;
  onLoad?: (data: any) => void;
}

interface ImageResponse {
  url?: string;
  urls?: {
    instagram_post: string;
    instagram_story: string;
    facebook_post: string;
    twitter_card: string;
  };
  variant: string;
  legacy?: boolean;
  message?: string;
  error?: string;
}

export function CloudinaryImageDisplay({ 
  imageId, 
  variant = 'mid_size',
  userId,
  orderId,
  className = '',
  alt = 'Pet portrait',
  fallbackUrl,
  onError,
  onLoad
}: CloudinaryImageDisplayProps) {
  
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [imageData, setImageData] = useState<ImageResponse | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchImage() {
      if (!isMounted) return;

      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams({
          variant,
          ...(userId && { userId }),
          ...(orderId && { orderId })
        });

        console.log(`🔍 Fetching secure image: ${imageId}, variant: ${variant}`);

        // Use secure image proxy endpoint that returns actual image data
        const response = await fetch(`/api/secure-images/${imageId}?${params}`);

        if (!isMounted) return;

        if (!response.ok) {
          // Try to get error message if it's JSON
          try {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
          } catch (parseError) {
            throw new Error(`HTTP ${response.status}`);
          }
        }

        // Check if response is an image
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) {
          // Create object URL from image response
          const imageBlob = await response.blob();
          const newObjectUrl = URL.createObjectURL(imageBlob);
          
          if (!isMounted) return;
          
          // Clean up previous object URL if it exists
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          
          objectUrlRef.current = newObjectUrl;
          setObjectUrl(newObjectUrl);
          setImageUrl(newObjectUrl);
          setImageData({
            url: newObjectUrl,
            variant: variant,
            access_type: 'secured_proxy'
          });
          
          console.log('✅ Secure image loaded successfully');
          onLoad?.({
            url: newObjectUrl,
            variant: variant,
            access_type: 'secured_proxy'
          });
        } else {
          throw new Error('Invalid response type');
        }

      } catch (err) {
        if (!isMounted) return;

        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('❌ Image loading failed:', errorMsg);
        setError(errorMsg);
        onError?.(errorMsg);

        // Try fallback URL if provided
        if (fallbackUrl && isMounted) {
          console.log('🔄 Trying fallback URL...');
          setImageUrl(fallbackUrl);
          setError(''); // Clear error if fallback works
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (imageId) {
      fetchImage();
    }

    return () => {
      isMounted = false;
      // Clean up object URL when component unmounts or dependencies change
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [imageId, variant, userId, orderId]);

  if (loading) {
    return (
      <div className={`bg-gray-200 rounded-lg flex items-center justify-center ${className}`}>
        <PawSpinner size="md" />
      </div>
    );
  }

  if (error && !imageUrl) {
    return (
      <div className={`bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2 ${className}`}>
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-medium">Image Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <img
        src={imageUrl}
        alt={alt}
        className={`rounded-lg shadow-md ${className}`}
        onError={(e) => {
          console.error('❌ Image failed to load:', imageUrl);
          if (fallbackUrl && imageUrl !== fallbackUrl) {
            console.log('🔄 Switching to fallback URL...');
            setImageUrl(fallbackUrl);
          } else {
            setError('Image failed to load');
          }
        }}
        onLoad={() => {
          console.log('✅ Image rendered successfully');
        }}
      />
      
      {/* Variant indicator */}
      {imageData && (
        <div className="absolute top-2 right-2">
          {imageData.legacy && (
            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
              Legacy
            </span>
          )}
          {variant === 'print_quality' && (
            <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
              Print Quality
            </span>
          )}
          {variant === 'social' && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              Social
            </span>
          )}
          {variant === 'full_size' && (
            <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
              Full Size
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Specific components for different use cases
export function CatalogImage({ imageId, className, alt, fallbackUrl }: {
  imageId: string;
  className?: string;
  alt?: string;
  fallbackUrl?: string;
}) {
  return (
    <CloudinaryImageDisplay
      imageId={imageId}
      variant="mid_size"
      className={className}
      alt={alt}
      fallbackUrl={fallbackUrl}
    />
  );
}

export function PrintQualityImage({ imageId, userId, className, alt }: {
  imageId: string;
  userId: string;
  className?: string;
  alt?: string;
}) {
  return (
    <CloudinaryImageDisplay
      imageId={imageId}
      variant="print_quality"
      userId={userId}
      className={className}
      alt={alt}
    />
  );
}

export function SocialMediaImage({ imageId, userId, orderId, className, alt }: {
  imageId: string;
  userId: string;
  orderId: string;
  className?: string;
  alt?: string;
}) {
  return (
    <CloudinaryImageDisplay
      imageId={imageId}
      variant="social"
      userId={userId}
      orderId={orderId}
      className={className}
      alt={alt}
    />
  );
}